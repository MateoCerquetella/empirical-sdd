//! Feature-spec creation using the neutral repository template.

use std::fs;

use crate::error::{Result, SddError};
use crate::model::{Profile, State};
use crate::repository::{SddRepository, atomic_write};

#[derive(Debug, Clone)]
pub struct NewSpecOptions {
    pub spec_id: String,
    pub title: Option<String>,
    pub profile: Option<Profile>,
    pub actor: String,
}

pub fn create_spec(repository: &SddRepository, options: &NewSpecOptions) -> Result<State> {
    if !repository.config_path().is_file() {
        return Err(SddError::InvalidState(
            "adopt the v1 repository before creating a v2 spec".into(),
        ));
    }
    let current = repository.reconcile()?;
    let directory = repository.spec_dir(&options.spec_id)?;
    if directory.exists() {
        return Err(SddError::InvalidSpec(format!(
            "spec directory already exists: {}",
            directory.display()
        )));
    }
    fs::create_dir_all(&directory).map_err(|error| SddError::io(&directory, error))?;
    let title = options
        .title
        .clone()
        .unwrap_or_else(|| title_from_id(&options.spec_id));
    let spec = include_str!("../starter/ai/specs/_template/spec.md").replacen(
        "# Feature title",
        &format!("# {title}"),
        1,
    );
    atomic_write(&directory.join("spec.md"), spec.as_bytes())?;

    repository.select_spec(
        &options.spec_id,
        options.profile,
        current.revision,
        &options.actor,
    )
}

fn title_from_id(spec_id: &str) -> String {
    let name = spec_id
        .split_once('-')
        .map(|(_, remainder)| remainder)
        .unwrap_or(spec_id);
    let words = name.replace(['-', '_'], " ");
    let mut characters = words.chars();
    match characters.next() {
        Some(first) => first.to_uppercase().collect::<String>() + characters.as_str(),
        None => "Feature".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::init::{InitOptions, initialize};
    use crate::model::Phase;

    #[test]
    fn new_spec_uses_a_neutral_template_and_selects_the_profile() {
        let directory = tempfile::tempdir().unwrap();
        let repository = initialize(directory.path(), &InitOptions::default()).unwrap();
        let state = create_spec(
            &repository,
            &NewSpecOptions {
                spec_id: "001-save-report".into(),
                title: None,
                profile: Some(Profile::Quick),
                actor: "test".into(),
            },
        )
        .unwrap();
        assert_eq!(state.phase, Phase::Shape);
        assert_eq!(state.current_spec.as_deref(), Some("001-save-report"));
        let spec =
            fs::read_to_string(directory.path().join("ai/specs/001-save-report/spec.md")).unwrap();
        assert!(spec.starts_with("# Save report"));
    }
}
