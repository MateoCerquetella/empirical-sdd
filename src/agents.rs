//! Global command-pack installation for supported agent hosts.

use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{Result, SddError};
use crate::kit::{DISTRIBUTION_VERSION, UpgradeAction};
use crate::repository::atomic_write;
use crate::spec::sha256_bytes;

const AGENT_LOCK_PATH: &str = ".empirical/agent-packs.lock";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct AgentPackLock {
    schema_version: u32,
    version: String,
    files: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentPackEntry {
    pub host: String,
    pub path: String,
    pub action: UpgradeAction,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentPackReport {
    pub installed_version: Option<String>,
    pub target_version: String,
    pub check_only: bool,
    pub up_to_date: bool,
    pub changed: bool,
    pub conflicts: usize,
    pub entries: Vec<AgentPackEntry>,
}

pub fn default_user_home() -> Result<PathBuf> {
    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .filter(|path| path.is_dir())
        .ok_or_else(|| {
            SddError::InvalidConfig("could not determine the user home directory".into())
        })
}

/// Installs every supported global pack together. The official installer calls
/// this after installing the binary; it is also exposed for repair and checks.
pub fn sync_agent_packs(home: &Path, check_only: bool) -> Result<AgentPackReport> {
    let home = home
        .canonicalize()
        .map_err(|error| SddError::io(home, error))?;
    let lock_path = home.join(AGENT_LOCK_PATH);
    let previous = load_lock(&lock_path)?;
    let previous_version = previous.as_ref().map(|lock| lock.version.clone());
    let previous_hashes = previous
        .as_ref()
        .map(|lock| lock.files.clone())
        .unwrap_or_default();
    let mut next_hashes = BTreeMap::new();
    let mut entries = Vec::new();

    for file in destination_files() {
        let destination = home.join(&file.relative_path);
        let target_hash = sha256_bytes(file.contents.as_bytes());
        let prior_hash = previous_hashes.get(&file.relative_path);
        let current_hash = current_hash(&destination)?;
        let (action, message) = match current_hash.as_deref() {
            Some(current) if current == target_hash => {
                next_hashes.insert(file.relative_path.clone(), target_hash);
                (UpgradeAction::Unchanged, "already current".into())
            }
            Some(current) if prior_hash.is_some_and(|prior| prior == current) => {
                if !check_only {
                    atomic_write(&destination, file.contents.as_bytes())?;
                }
                next_hashes.insert(file.relative_path.clone(), target_hash);
                (
                    UpgradeAction::Update,
                    "updated Empirical-owned command".into(),
                )
            }
            Some(_) => {
                if let Some(prior) = prior_hash {
                    next_hashes.insert(file.relative_path.clone(), prior.clone());
                }
                (
                    UpgradeAction::Conflict,
                    "locally modified command was preserved".into(),
                )
            }
            None if prior_hash.is_some() => {
                next_hashes.insert(
                    file.relative_path.clone(),
                    prior_hash.cloned().unwrap_or_default(),
                );
                (
                    UpgradeAction::Conflict,
                    "previously installed command was removed; absence preserved".into(),
                )
            }
            None => {
                if !check_only {
                    atomic_write(&destination, file.contents.as_bytes())?;
                }
                next_hashes.insert(file.relative_path.clone(), target_hash);
                (
                    UpgradeAction::Create,
                    "installed global Empirical command".into(),
                )
            }
        };
        entries.push(AgentPackEntry {
            host: file.host.into(),
            path: file.relative_path,
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
        let lock = AgentPackLock {
            schema_version: 1,
            version: if conflicts == 0 {
                DISTRIBUTION_VERSION.into()
            } else {
                previous_version
                    .clone()
                    .unwrap_or_else(|| "unversioned".into())
            },
            files: next_hashes,
        };
        atomic_write(&lock_path, toml::to_string_pretty(&lock)?.as_bytes())?;
    }

    Ok(AgentPackReport {
        installed_version: previous_version,
        target_version: DISTRIBUTION_VERSION.into(),
        check_only,
        up_to_date,
        changed,
        conflicts,
        entries,
    })
}

fn load_lock(path: &Path) -> Result<Option<AgentPackLock>> {
    if !path.is_file() {
        return Ok(None);
    }
    let text = fs::read_to_string(path).map_err(|error| SddError::io(path, error))?;
    let lock: AgentPackLock = toml::from_str(&text)?;
    if lock.schema_version != 1 {
        return Err(SddError::InvalidConfig(format!(
            "unsupported agent-pack lock {}",
            path.display()
        )));
    }
    Ok(Some(lock))
}

fn current_hash(path: &Path) -> Result<Option<String>> {
    match fs::read(path) {
        Ok(bytes) => Ok(Some(sha256_bytes(&bytes))),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(SddError::io(path, error)),
    }
}

struct DestinationFile {
    host: &'static str,
    relative_path: String,
    contents: &'static str,
}

fn destination_files() -> Vec<DestinationFile> {
    let mut files = Vec::new();
    for (name, contents) in AGENT_SKILLS {
        for (host, root) in [
            ("agent-skills", ".agents/skills"),
            ("codex", ".codex/skills"),
            ("claude-code", ".claude/skills"),
        ] {
            files.push(DestinationFile {
                host,
                relative_path: format!("{root}/{name}/SKILL.md"),
                contents,
            });
        }
    }
    for (name, contents) in GEMINI_COMMANDS {
        files.push(DestinationFile {
            host: "gemini-cli",
            relative_path: format!(".gemini/commands/empirical/{name}.toml"),
            contents,
        });
    }
    files
}

const AGENT_SKILLS: &[(&str, &str)] = &[
    (
        "empirical-init",
        include_str!("../agent-packs/skills/empirical-init/SKILL.md"),
    ),
    (
        "empirical-spec",
        include_str!("../agent-packs/skills/empirical-spec/SKILL.md"),
    ),
    (
        "empirical-next",
        include_str!("../agent-packs/skills/empirical-next/SKILL.md"),
    ),
    (
        "empirical-loop",
        include_str!("../agent-packs/skills/empirical-loop/SKILL.md"),
    ),
    (
        "empirical-status",
        include_str!("../agent-packs/skills/empirical-status/SKILL.md"),
    ),
    (
        "empirical-verify",
        include_str!("../agent-packs/skills/empirical-verify/SKILL.md"),
    ),
    (
        "empirical-ship",
        include_str!("../agent-packs/skills/empirical-ship/SKILL.md"),
    ),
];

const GEMINI_COMMANDS: &[(&str, &str)] = &[
    (
        "init",
        include_str!("../agent-packs/gemini/empirical/init.toml"),
    ),
    (
        "spec",
        include_str!("../agent-packs/gemini/empirical/spec.toml"),
    ),
    (
        "next",
        include_str!("../agent-packs/gemini/empirical/next.toml"),
    ),
    (
        "loop",
        include_str!("../agent-packs/gemini/empirical/loop.toml"),
    ),
    (
        "status",
        include_str!("../agent-packs/gemini/empirical/status.toml"),
    ),
    (
        "verify",
        include_str!("../agent-packs/gemini/empirical/verify.toml"),
    ),
    (
        "ship",
        include_str!("../agent-packs/gemini/empirical/ship.toml"),
    ),
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sync_installs_every_supported_pack_and_updates_safely() {
        let home = tempfile::tempdir().unwrap();
        let report = sync_agent_packs(home.path(), false).unwrap();
        assert_eq!(report.conflicts, 0);
        assert!(
            home.path()
                .join(".agents/skills/empirical-loop/SKILL.md")
                .is_file()
        );
        assert!(
            home.path()
                .join(".codex/skills/empirical-loop/SKILL.md")
                .is_file()
        );
        assert!(
            home.path()
                .join(".claude/skills/empirical-loop/SKILL.md")
                .is_file()
        );
        assert!(
            home.path()
                .join(".gemini/commands/empirical/loop.toml")
                .is_file()
        );
        assert!(sync_agent_packs(home.path(), true).unwrap().up_to_date);
    }

    #[test]
    fn sync_preserves_a_locally_modified_global_command() {
        let home = tempfile::tempdir().unwrap();
        sync_agent_packs(home.path(), false).unwrap();
        let path = home.path().join(".codex/skills/empirical-next/SKILL.md");
        fs::write(&path, "custom\n").unwrap();
        let report = sync_agent_packs(home.path(), false).unwrap();
        assert_eq!(report.conflicts, 1);
        assert_eq!(fs::read_to_string(path).unwrap(), "custom\n");
    }
}
