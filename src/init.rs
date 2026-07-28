//! Neutral starter initialization.

use std::fs;
use std::path::Path;

use crate::config::Config;
use crate::error::{Result, SddError};
use crate::kit::write_initial_kit_lock;
use crate::legacy::render_state;
use crate::model::{ControlMode, Profile, State};
use crate::repository::{SddRepository, atomic_write};

#[derive(Debug, Clone)]
pub struct InitOptions {
    pub profile: Profile,
    pub mode: ControlMode,
    pub actor: String,
}

impl Default for InitOptions {
    fn default() -> Self {
        Self {
            profile: Profile::Quick,
            mode: ControlMode::Autonomous,
            actor: "empirical-init".into(),
        }
    }
}

pub fn initialize(root: &Path, options: &InitOptions) -> Result<SddRepository> {
    fs::create_dir_all(root).map_err(|error| SddError::io(root, error))?;
    let root = root
        .canonicalize()
        .map_err(|error| SddError::io(root, error))?;
    let ai_directory = root.join("ai");
    if fs::symlink_metadata(&ai_directory).is_ok() {
        let canonical = ai_directory
            .canonicalize()
            .map_err(|error| SddError::io(&ai_directory, error))?;
        if canonical != ai_directory || !canonical.is_dir() {
            return Err(SddError::InvalidState(format!(
                "initializer requires ai/ to be a real directory: {}",
                ai_directory.display()
            )));
        }
    }
    let state_path = root.join("ai/STATE.md");
    if fs::symlink_metadata(&state_path).is_ok() {
        return Err(SddError::InvalidState(format!(
            "{} already exists; use `empirical adopt` for an existing repository",
            state_path.display()
        )));
    }

    let mut conflicts: Vec<_> = STARTER_FILES
        .iter()
        .map(|(relative, _)| root.join(relative))
        .filter(|path| fs::symlink_metadata(path).is_ok())
        .collect();
    let config_path = root.join("ai/empirical.toml");
    if fs::symlink_metadata(&config_path).is_ok() {
        conflicts.push(config_path.clone());
    }
    let kit_lock_path = root.join("ai/empirical.lock");
    if fs::symlink_metadata(&kit_lock_path).is_ok() {
        conflicts.push(kit_lock_path.clone());
    }
    if !conflicts.is_empty() {
        return Err(SddError::InvalidState(format!(
            "initializer will not overwrite existing files: {}",
            conflicts
                .iter()
                .map(|path| path.display().to_string())
                .collect::<Vec<_>>()
                .join(", ")
        )));
    }

    for (relative, _) in STARTER_FILES {
        ensure_safe_new_path(&root, &root.join(relative))?;
    }
    ensure_safe_new_path(&root, &config_path)?;
    ensure_safe_new_path(&root, &kit_lock_path)?;
    ensure_safe_new_path(&root, &state_path)?;

    for (relative, contents) in STARTER_FILES {
        write_new(&root, &root.join(relative), contents.as_bytes())?;
    }

    let config = Config {
        profile: options.profile,
        ..Default::default()
    };
    atomic_write(&config_path, config.to_toml()?.as_bytes())?;
    write_initial_kit_lock(&root)?;

    let mut state = State::new("pending-adoption".into(), options.profile);
    state.mode = options.mode;
    atomic_write(&state_path, render_state(&state, None).as_bytes())?;

    let repository = SddRepository::from_root(&root)?;
    repository.adopt(Some(options.profile), &options.actor)?;
    Ok(repository)
}

fn write_new(root: &Path, path: &Path, contents: &[u8]) -> Result<()> {
    if fs::symlink_metadata(path).is_ok() {
        return Err(SddError::InvalidState(format!(
            "initializer will not overwrite existing file {}",
            path.display()
        )));
    }
    ensure_safe_new_path(root, path)?;
    let parent = path
        .parent()
        .ok_or_else(|| SddError::InvalidState(format!("{} has no parent", path.display())))?;
    fs::create_dir_all(parent).map_err(|error| SddError::io(parent, error))?;
    atomic_write(path, contents)
}

fn ensure_safe_new_path(root: &Path, path: &Path) -> Result<()> {
    let mut ancestor = path
        .parent()
        .ok_or_else(|| SddError::InvalidState(format!("{} has no parent", path.display())))?;
    while fs::symlink_metadata(ancestor).is_err() {
        ancestor = ancestor.parent().ok_or_else(|| {
            SddError::InvalidState(format!(
                "{} has no existing parent inside the repository",
                path.display()
            ))
        })?;
    }
    let canonical = ancestor
        .canonicalize()
        .map_err(|error| SddError::io(ancestor, error))?;
    if canonical != ancestor || !canonical.starts_with(root) || !canonical.is_dir() {
        return Err(SddError::InvalidState(format!(
            "initializer path must have a contained non-symlink parent: {}",
            path.display()
        )));
    }
    Ok(())
}

const STARTER_FILES: &[(&str, &str)] = &[
    ("ai/README.md", include_str!("../starter/ai/README.md")),
    (
        "ai/context/project_vision.md",
        include_str!("../starter/ai/context/project_vision.md"),
    ),
    (
        "ai/context/personas.md",
        include_str!("../starter/ai/context/personas.md"),
    ),
    (
        "ai/context/tech_stack.md",
        include_str!("../starter/ai/context/tech_stack.md"),
    ),
    (
        "ai/context/architecture_principles.md",
        include_str!("../starter/ai/context/architecture_principles.md"),
    ),
    (
        "ai/context/domain_glossary.md",
        include_str!("../starter/ai/context/domain_glossary.md"),
    ),
    (
        "ai/context/current_milestone.md",
        include_str!("../starter/ai/context/current_milestone.md"),
    ),
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

    #[test]
    fn initializer_creates_a_neutral_autonomous_repository() {
        let directory = tempfile::tempdir().unwrap();
        let repository = initialize(directory.path(), &InitOptions::default()).unwrap();
        let snapshot = repository.snapshot().unwrap();
        assert!(!snapshot.legacy);
        assert_eq!(snapshot.state.mode, ControlMode::Autonomous);
        assert_eq!(snapshot.state.profile, Profile::Quick);
        assert_eq!(snapshot.state.revision, 1);
        assert!(repository.root().join("ai/roles/developer.md").is_file());
        assert!(repository.root().join("ai/empirical.lock").is_file());
        assert!(!repository.root().join(".empirical").exists());
    }

    #[test]
    fn initializer_never_overwrites_an_existing_state() {
        let directory = tempfile::tempdir().unwrap();
        fs::create_dir_all(directory.path().join("ai")).unwrap();
        fs::write(directory.path().join("ai/STATE.md"), "user data").unwrap();
        assert!(initialize(directory.path(), &InitOptions::default()).is_err());
        assert_eq!(
            fs::read_to_string(directory.path().join("ai/STATE.md")).unwrap(),
            "user data"
        );
    }

    #[cfg(unix)]
    #[test]
    fn initializer_refuses_to_write_through_nested_symlinks() {
        use std::os::unix::fs::symlink;

        let directory = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        fs::create_dir_all(directory.path().join("ai")).unwrap();
        symlink(outside.path(), directory.path().join("ai/context")).unwrap();

        assert!(initialize(directory.path(), &InitOptions::default()).is_err());
        assert!(!outside.path().join("project_vision.md").exists());
        assert!(!directory.path().join("ai/README.md").exists());
    }
}
