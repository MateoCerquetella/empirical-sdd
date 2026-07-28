//! Versioned, non-destructive repository starter updates.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::{Result, SddError};
use crate::repository::atomic_write;
use crate::spec::sha256_bytes;

pub const DISTRIBUTION_VERSION: &str = env!("CARGO_PKG_VERSION");
const KIT_LOCK_PATH: &str = "ai/empirical.lock";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct KitLock {
    pub schema_version: u32,
    pub distribution: String,
    pub version: String,
    pub managed_files: BTreeMap<String, String>,
    #[serde(default)]
    pub preserved_files: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UpgradeAction {
    Unchanged,
    Create,
    Update,
    Preserved,
    Conflict,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpgradeEntry {
    pub path: String,
    pub action: UpgradeAction,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpgradeReport {
    pub installed_version: Option<String>,
    pub target_version: String,
    pub check_only: bool,
    pub up_to_date: bool,
    pub changed: bool,
    pub conflicts: usize,
    pub entries: Vec<UpgradeEntry>,
}

/// Checks or updates only files owned by the distributed kit. Project context,
/// real specs, configuration, state, events, and evidence are never candidates.
pub fn upgrade_kit(root: &Path, check_only: bool) -> Result<UpgradeReport> {
    let root = root
        .canonicalize()
        .map_err(|error| SddError::io(root, error))?;
    let lock_path = root.join(KIT_LOCK_PATH);
    ensure_safe_managed_path(&root, &lock_path)?;
    let previous = load_lock(&lock_path)?;
    let previous_version = previous.as_ref().map(|lock| lock.version.clone());
    let previous_hashes = previous
        .as_ref()
        .map(|lock| lock.managed_files.clone())
        .unwrap_or_default();
    let preserved_files: BTreeSet<String> = previous
        .as_ref()
        .map(|lock| lock.preserved_files.iter().cloned().collect())
        .unwrap_or_default();
    let mut next_hashes = BTreeMap::new();
    let mut next_preserved = BTreeSet::new();
    let mut entries = Vec::new();

    for (relative, contents) in MANAGED_FILES {
        let path = root.join(relative);
        ensure_safe_managed_path(&root, &path)?;
        let target_hash = sha256_bytes(contents.as_bytes());
        let prior_hash = previous_hashes.get(*relative);
        let current_hash = current_hash(&path)?;
        let (action, message) = match current_hash.as_deref() {
            Some(current) if current == target_hash => {
                next_hashes.insert((*relative).into(), target_hash);
                (
                    UpgradeAction::Unchanged,
                    "already matches this distribution".into(),
                )
            }
            Some(_) | None if preserved_files.contains(*relative) => {
                next_preserved.insert((*relative).into());
                (
                    UpgradeAction::Preserved,
                    "project-owned compatibility file was preserved".into(),
                )
            }
            Some(current) if prior_hash.is_some_and(|prior| prior == current) => {
                if !check_only {
                    atomic_write(&path, contents.as_bytes())?;
                }
                next_hashes.insert((*relative).into(), target_hash);
                (UpgradeAction::Update, "safe managed-file update".into())
            }
            Some(_) if prior_hash.is_some() => {
                if let Some(prior) = prior_hash {
                    next_hashes.insert((*relative).into(), prior.clone());
                }
                (
                    UpgradeAction::Conflict,
                    "local content differs from its managed baseline; preserved".into(),
                )
            }
            Some(_) => {
                next_preserved.insert((*relative).into());
                (
                    UpgradeAction::Preserved,
                    "pre-existing file registered as project-owned and preserved".into(),
                )
            }
            None if prior_hash.is_some() => {
                next_hashes.insert((*relative).into(), prior_hash.cloned().unwrap_or_default());
                (
                    UpgradeAction::Conflict,
                    "managed file was removed locally; absence preserved".into(),
                )
            }
            None => {
                if !check_only {
                    atomic_write(&path, contents.as_bytes())?;
                }
                next_hashes.insert((*relative).into(), target_hash);
                (UpgradeAction::Create, "new managed file".into())
            }
        };
        entries.push(UpgradeEntry {
            path: (*relative).into(),
            action,
            message,
        });
    }

    let conflicts = entries
        .iter()
        .filter(|entry| entry.action == UpgradeAction::Conflict)
        .count();
    let file_changes = entries
        .iter()
        .any(|entry| matches!(entry.action, UpgradeAction::Create | UpgradeAction::Update));
    let metadata_change = previous_version.as_deref() != Some(DISTRIBUTION_VERSION);
    let changed = file_changes || metadata_change;
    let up_to_date = !changed && conflicts == 0;

    if !check_only {
        let version = if conflicts == 0 {
            DISTRIBUTION_VERSION.into()
        } else {
            previous_version
                .clone()
                .unwrap_or_else(|| "unversioned".into())
        };
        let next = KitLock {
            schema_version: 1,
            distribution: "empirical-sdd".into(),
            version,
            managed_files: next_hashes,
            preserved_files: next_preserved.into_iter().collect(),
        };
        atomic_write(&lock_path, toml::to_string_pretty(&next)?.as_bytes())?;
    }

    Ok(UpgradeReport {
        installed_version: previous_version,
        target_version: DISTRIBUTION_VERSION.into(),
        check_only,
        up_to_date,
        changed,
        conflicts,
        entries,
    })
}

pub(crate) fn write_initial_kit_lock(root: &Path) -> Result<()> {
    let managed_files = MANAGED_FILES
        .iter()
        .map(|(path, contents)| ((*path).into(), sha256_bytes(contents.as_bytes())))
        .collect();
    let lock = KitLock {
        schema_version: 1,
        distribution: "empirical-sdd".into(),
        version: DISTRIBUTION_VERSION.into(),
        managed_files,
        preserved_files: Vec::new(),
    };
    atomic_write(
        &root.join(KIT_LOCK_PATH),
        toml::to_string_pretty(&lock)?.as_bytes(),
    )
}

fn current_hash(path: &Path) -> Result<Option<String>> {
    match fs::read(path) {
        Ok(bytes) => Ok(Some(sha256_bytes(&bytes))),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(SddError::io(path, error)),
    }
}

fn load_lock(path: &Path) -> Result<Option<KitLock>> {
    if !path.is_file() {
        return Ok(None);
    }
    let text = fs::read_to_string(path).map_err(|error| SddError::io(path, error))?;
    let lock: KitLock = toml::from_str(&text)?;
    if lock.schema_version != 1 || lock.distribution != "empirical-sdd" {
        return Err(SddError::InvalidConfig(format!(
            "unsupported kit lock {}",
            path.display()
        )));
    }
    Ok(Some(lock))
}

fn ensure_safe_managed_path(root: &Path, path: &Path) -> Result<()> {
    if fs::symlink_metadata(path).is_ok_and(|metadata| metadata.file_type().is_symlink()) {
        return Err(SddError::InvalidState(format!(
            "managed file cannot be a symlink: {}",
            path.display()
        )));
    }
    let mut ancestor = path.parent().ok_or_else(|| {
        SddError::InvalidState(format!("managed path has no parent: {}", path.display()))
    })?;
    while !ancestor.exists() {
        ancestor = ancestor.parent().ok_or_else(|| {
            SddError::InvalidState(format!(
                "managed path has no existing ancestor: {}",
                path.display()
            ))
        })?;
    }
    let canonical = ancestor
        .canonicalize()
        .map_err(|error| SddError::io(ancestor, error))?;
    if canonical != ancestor || !canonical.starts_with(root) || !canonical.is_dir() {
        return Err(SddError::InvalidState(format!(
            "managed path parent must be a contained non-symlink directory: {}",
            ancestor.display()
        )));
    }
    Ok(())
}

pub(crate) const MANAGED_FILES: &[(&str, &str)] = &[
    ("ai/README.md", include_str!("../starter/ai/README.md")),
    (
        "ai/contracts/templates/handoff_contract.md",
        include_str!("../starter/ai/contracts/templates/handoff_contract.md"),
    ),
    (
        "ai/contracts/templates/feedback_contract.md",
        include_str!("../starter/ai/contracts/templates/feedback_contract.md"),
    ),
    (
        "ai/contracts/templates/question_contract.md",
        include_str!("../starter/ai/contracts/templates/question_contract.md"),
    ),
    (
        "ai/orchestration/workflow.md",
        include_str!("../starter/ai/orchestration/workflow.md"),
    ),
    (
        "ai/orchestration/orchestrator.md",
        include_str!("../starter/ai/orchestration/orchestrator.md"),
    ),
    (
        "ai/orchestration/context_policy.md",
        include_str!("../starter/ai/orchestration/context_policy.md"),
    ),
    (
        "ai/orchestration/handoff_rules.md",
        include_str!("../starter/ai/orchestration/handoff_rules.md"),
    ),
    (
        "ai/orchestration/hitl_policy.md",
        include_str!("../starter/ai/orchestration/hitl_policy.md"),
    ),
    (
        "ai/roles/analyst.md",
        include_str!("../starter/ai/roles/analyst.md"),
    ),
    ("ai/roles/pm.md", include_str!("../starter/ai/roles/pm.md")),
    (
        "ai/roles/architect.md",
        include_str!("../starter/ai/roles/architect.md"),
    ),
    (
        "ai/roles/developer.md",
        include_str!("../starter/ai/roles/developer.md"),
    ),
    (
        "ai/roles/tester.md",
        include_str!("../starter/ai/roles/tester.md"),
    ),
    (
        "ai/roles/reviewer.md",
        include_str!("../starter/ai/roles/reviewer.md"),
    ),
    (
        "ai/skills/write_spec.md",
        include_str!("../starter/ai/skills/write_spec.md"),
    ),
    (
        "ai/skills/write_spec_socratic.md",
        include_str!("../starter/ai/skills/write_spec_socratic.md"),
    ),
    (
        "ai/skills/create_handoff_contract.md",
        include_str!("../starter/ai/skills/create_handoff_contract.md"),
    ),
    (
        "ai/skills/validate_handoff.md",
        include_str!("../starter/ai/skills/validate_handoff.md"),
    ),
    (
        "ai/skills/write_tests.md",
        include_str!("../starter/ai/skills/write_tests.md"),
    ),
    (
        "ai/skills/browser_qa.md",
        include_str!("../starter/ai/skills/browser_qa.md"),
    ),
    (
        "ai/skills/review_code_quality.md",
        include_str!("../starter/ai/skills/review_code_quality.md"),
    ),
    (
        "ai/skills/orchestrate.md",
        include_str!("../starter/ai/skills/orchestrate.md"),
    ),
    (
        "ai/specs/README.md",
        include_str!("../starter/ai/specs/README.md"),
    ),
    (
        "ai/specs/_template/spec.md",
        include_str!("../starter/ai/specs/_template/spec.md"),
    ),
    (
        "ai/specs/_template/architecture.md",
        include_str!("../starter/ai/specs/_template/architecture.md"),
    ),
    (
        "ai/specs/_template/plan.json",
        include_str!("../starter/ai/specs/_template/plan.json"),
    ),
    (
        "ai/specs/_template/tasks.md",
        include_str!("../starter/ai/specs/_template/tasks.md"),
    ),
    (
        "ai/specs/_template/review.md",
        include_str!("../starter/ai/specs/_template/review.md"),
    ),
    (
        "ai/templates/project_setup_prompt.md",
        include_str!("../starter/ai/templates/project_setup_prompt.md"),
    ),
    (
        "ai/templates/spec_generation_prompt.md",
        include_str!("../starter/ai/templates/spec_generation_prompt.md"),
    ),
    (
        "ai/templates/orchestration_prompt.md",
        include_str!("../starter/ai/templates/orchestration_prompt.md"),
    ),
    (
        "ai/events/README.md",
        include_str!("../starter/ai/events/README.md"),
    ),
];

#[cfg(test)]
mod tests {
    use super::*;
    use crate::init::{InitOptions, initialize};

    #[test]
    fn clean_managed_file_updates_but_project_context_is_never_managed() {
        let directory = tempfile::tempdir().unwrap();
        initialize(directory.path(), &InitOptions::default()).unwrap();
        let lock = load_lock(&directory.path().join(KIT_LOCK_PATH))
            .unwrap()
            .unwrap();
        assert!(lock.managed_files.contains_key("ai/roles/developer.md"));
        assert!(
            !lock
                .managed_files
                .contains_key("ai/context/project_vision.md")
        );
        let report = upgrade_kit(directory.path(), true).unwrap();
        assert!(report.up_to_date);
    }

    #[test]
    fn customized_managed_file_is_preserved_and_reported() {
        let directory = tempfile::tempdir().unwrap();
        initialize(directory.path(), &InitOptions::default()).unwrap();
        let path = directory.path().join("ai/roles/developer.md");
        fs::write(&path, "team-specific role\n").unwrap();
        let report = upgrade_kit(directory.path(), false).unwrap();
        assert_eq!(report.conflicts, 1);
        assert_eq!(fs::read_to_string(path).unwrap(), "team-specific role\n");
    }

    #[test]
    fn first_upgrade_registers_v1_files_as_project_owned_overrides() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("ai/roles/developer.md");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, "v1 team playbook\n").unwrap();

        let report = upgrade_kit(directory.path(), false).unwrap();
        assert_eq!(report.conflicts, 0);
        assert!(report.entries.iter().any(|entry| {
            entry.path == "ai/roles/developer.md" && entry.action == UpgradeAction::Preserved
        }));
        assert_eq!(fs::read_to_string(&path).unwrap(), "v1 team playbook\n");

        let check = upgrade_kit(directory.path(), true).unwrap();
        assert!(check.up_to_date);
        assert_eq!(fs::read_to_string(path).unwrap(), "v1 team playbook\n");
    }

    #[cfg(unix)]
    #[test]
    fn updater_refuses_to_follow_a_managed_file_symlink() {
        use std::os::unix::fs::symlink;

        let directory = tempfile::tempdir().unwrap();
        initialize(directory.path(), &InitOptions::default()).unwrap();
        let path = directory.path().join("ai/roles/developer.md");
        let outside = directory.path().join("outside.md");
        fs::write(&outside, "outside\n").unwrap();
        fs::remove_file(&path).unwrap();
        symlink(&outside, &path).unwrap();

        assert!(upgrade_kit(directory.path(), false).is_err());
        assert_eq!(fs::read_to_string(outside).unwrap(), "outside\n");
    }
}
