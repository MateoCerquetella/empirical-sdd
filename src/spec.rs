use std::collections::BTreeSet;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Component, Path};

use serde::Deserialize;
use sha2::{Digest, Sha256};

use crate::error::{Result, SddError};
use crate::model::Criterion;

pub fn parse_acceptance_criteria(markdown: &str) -> Result<Vec<Criterion>> {
    let mut in_section = false;
    let mut criteria: Vec<Criterion> = Vec::new();
    let mut ids = BTreeSet::new();

    for line in markdown.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') {
            let heading = trimmed.trim_start_matches('#').trim().to_ascii_lowercase();
            if in_section && !heading.starts_with("acceptance criter") {
                break;
            }
            if heading.starts_with("acceptance criter") {
                in_section = true;
            }
            continue;
        }
        if !in_section {
            continue;
        }
        let Some(raw) = strip_list_marker(trimmed) else {
            if !trimmed.is_empty() && line.chars().next().is_some_and(char::is_whitespace) {
                if let Some(criterion) = criteria.last_mut() {
                    criterion.text.push(' ');
                    criterion.text.push_str(trimmed);
                }
            }
            continue;
        };
        let (explicit_id, without_id) = take_tag(raw, "AC-");
        let (_, without_ui_upper) = take_exact_tag(without_id, "UI");
        let (_, text) = take_exact_tag(without_ui_upper, "ui");
        let ui = raw.to_ascii_lowercase().contains("[ui]");
        let text = text.trim().to_owned();
        if text.is_empty() {
            continue;
        }
        let id = explicit_id.unwrap_or_else(|| format!("AC-{:03}", criteria.len() + 1));
        if !ids.insert(id.clone()) {
            return Err(SddError::InvalidSpec(format!(
                "duplicate acceptance criterion id '{id}'"
            )));
        }
        criteria.push(Criterion { id, text, ui });
    }

    if criteria.is_empty() {
        return Err(SddError::InvalidSpec(
            "specification has no acceptance criteria".into(),
        ));
    }
    Ok(criteria)
}

pub fn read_acceptance_criteria(path: &Path) -> Result<Vec<Criterion>> {
    let markdown = fs::read_to_string(path).map_err(|error| SddError::io(path, error))?;
    parse_acceptance_criteria(&markdown)
}

pub fn sha256_bytes(bytes: &[u8]) -> String {
    format!("sha256:{}", hex::encode(Sha256::digest(bytes)))
}

pub fn sha256_file(path: &Path) -> Result<String> {
    let mut file = File::open(path).map_err(|error| SddError::io(path, error))?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| SddError::io(path, error))?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    Ok(format!("sha256:{}", hex::encode(digest.finalize())))
}

pub fn validate_strong_plan(path: &Path, spec_id: &str, criteria: &[Criterion]) -> Result<()> {
    let bytes = fs::read(path).map_err(|error| SddError::io(path, error))?;
    let plan: StrongPlan = serde_json::from_slice(&bytes)?;
    if plan.schema_version != 1 {
        return Err(SddError::InvalidSpec(format!(
            "plan uses unsupported schema {}",
            plan.schema_version
        )));
    }
    if plan.spec_id != spec_id {
        return Err(SddError::InvalidSpec(format!(
            "plan specId '{}' does not match current spec '{spec_id}'",
            plan.spec_id
        )));
    }
    if plan.tasks.is_empty() {
        return Err(SddError::InvalidSpec("plan has no tasks".into()));
    }
    let known_criteria: BTreeSet<_> = criteria.iter().map(|item| item.id.as_str()).collect();
    let mut covered_criteria = BTreeSet::new();
    let mut task_ids = BTreeSet::new();
    for task in &plan.tasks {
        if task.id.trim().is_empty()
            || task.id.trim() != task.id
            || task.id.chars().any(char::is_control)
            || task.objective.trim().is_empty()
            || task.objective.trim() != task.objective
        {
            return Err(SddError::InvalidSpec(
                "plan task id and objective must not be blank".into(),
            ));
        }
        if !task_ids.insert(task.id.as_str()) {
            return Err(SddError::InvalidSpec(format!(
                "duplicate plan task id '{}'",
                task.id
            )));
        }
        if task.write_scopes.is_empty() || task.acceptance_criteria.is_empty() {
            return Err(SddError::InvalidSpec(format!(
                "plan task {} needs writeScopes and acceptanceCriteria",
                task.id
            )));
        }
        reject_duplicates(
            &task.dependencies,
            &format!("task {} dependencies", task.id),
        )?;
        reject_duplicates(&task.write_scopes, &format!("task {} writeScopes", task.id))?;
        reject_duplicates(
            &task.acceptance_criteria,
            &format!("task {} acceptanceCriteria", task.id),
        )?;
        for scope in &task.write_scopes {
            validate_relative_path(scope)?;
        }
        for criterion in &task.acceptance_criteria {
            if !known_criteria.contains(criterion.as_str()) {
                return Err(SddError::InvalidSpec(format!(
                    "plan task {} references unknown criterion {criterion}",
                    task.id
                )));
            }
            covered_criteria.insert(criterion.as_str());
        }
    }
    for task in &plan.tasks {
        for dependency in &task.dependencies {
            if dependency == &task.id || !task_ids.contains(dependency.as_str()) {
                return Err(SddError::InvalidSpec(format!(
                    "plan task {} has invalid dependency {dependency}",
                    task.id
                )));
            }
        }
    }
    if covered_criteria != known_criteria {
        let missing = known_criteria
            .difference(&covered_criteria)
            .copied()
            .collect::<Vec<_>>()
            .join(", ");
        return Err(SddError::InvalidSpec(format!(
            "plan does not cover acceptance criteria: {missing}"
        )));
    }

    let mut resolved = BTreeSet::new();
    while resolved.len() < plan.tasks.len() {
        let before = resolved.len();
        for task in &plan.tasks {
            if !resolved.contains(task.id.as_str())
                && task
                    .dependencies
                    .iter()
                    .all(|dependency| resolved.contains(dependency.as_str()))
            {
                resolved.insert(task.id.as_str());
            }
        }
        if resolved.len() == before {
            return Err(SddError::InvalidSpec(
                "plan dependency graph contains a cycle".into(),
            ));
        }
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StrongPlan {
    schema_version: u32,
    spec_id: String,
    tasks: Vec<PlanTask>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PlanTask {
    id: String,
    objective: String,
    dependencies: Vec<String>,
    write_scopes: Vec<String>,
    acceptance_criteria: Vec<String>,
}

fn reject_duplicates(values: &[String], field: &str) -> Result<()> {
    let mut seen = BTreeSet::new();
    for value in values {
        if value.trim().is_empty()
            || value.trim() != value
            || value.chars().any(char::is_control)
            || !seen.insert(value.as_str())
        {
            return Err(SddError::InvalidSpec(format!(
                "{field} contains a blank or duplicate value"
            )));
        }
    }
    Ok(())
}

pub fn validate_relative_path(value: &str) -> Result<()> {
    let path = Path::new(value);
    if value.is_empty()
        || path.is_absolute()
        || value.contains('\\')
        || value.contains(':')
        || value.chars().any(char::is_control)
    {
        return Err(SddError::InvalidSpec(format!(
            "artifact path must be relative: '{value}'"
        )));
    }
    if path
        .components()
        .any(|component| !matches!(component, Component::Normal(part) if part.to_str().is_some()))
    {
        return Err(SddError::InvalidSpec(format!(
            "artifact path contains traversal or a non-normal component: '{value}'"
        )));
    }
    Ok(())
}

fn strip_list_marker(line: &str) -> Option<&str> {
    for prefix in ["- [ ] ", "- [x] ", "- [X] ", "* [ ] ", "* [x] ", "* [X] "] {
        if let Some(rest) = line.strip_prefix(prefix) {
            return Some(rest);
        }
    }
    if let Some(rest) = line.strip_prefix("- ").or_else(|| line.strip_prefix("* ")) {
        return Some(rest);
    }
    let digits = line.chars().take_while(char::is_ascii_digit).count();
    if digits > 0 {
        let rest = &line[digits..];
        return rest
            .strip_prefix('.')
            .or_else(|| rest.strip_prefix(')'))
            .map(str::trim_start);
    }
    if line.starts_with("[ ] ") || line.starts_with("[x] ") || line.starts_with("[X] ") {
        return Some(&line[4..]);
    }
    None
}

fn take_tag<'a>(value: &'a str, prefix: &str) -> (Option<String>, &'a str) {
    let trimmed = value.trim_start();
    let Some(rest) = trimmed.strip_prefix('[') else {
        return (None, value);
    };
    let Some(end) = rest.find(']') else {
        return (None, value);
    };
    let tag = &rest[..end];
    if !tag.to_ascii_uppercase().starts_with(prefix) {
        return (None, value);
    }
    (Some(tag.to_ascii_uppercase()), rest[end + 1..].trim_start())
}

fn take_exact_tag<'a>(value: &'a str, tag: &str) -> (bool, &'a str) {
    let needle = format!("[{tag}]");
    if let Some(index) = value.find(&needle) {
        let mut end = index + needle.len();
        while value
            .as_bytes()
            .get(end)
            .is_some_and(u8::is_ascii_whitespace)
        {
            end += 1;
        }
        // Tags are conventionally leading. Removing an inline tag would need
        // allocation, so preserve inline text while still marking it as UI.
        if index == 0 {
            return (true, &value[end..]);
        }
        return (true, value);
    }
    (false, value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_v1_checkboxes_and_versioned_ui_criteria() {
        let criteria = parse_acceptance_criteria(
            "# Spec\n\n## Acceptance Criteria\n\n- [ ] Existing criterion\n- [ ] [AC-UI-2] [UI] Dashboard displays the result\n\n## Risks\n",
        )
        .unwrap();
        assert_eq!(criteria[0].id, "AC-001");
        assert!(!criteria[0].ui);
        assert_eq!(criteria[1].id, "AC-UI-2");
        assert!(criteria[1].ui);
        assert_eq!(criteria[1].text, "Dashboard displays the result");
    }

    #[test]
    fn joins_indented_multiline_criterion_text() {
        let criteria = parse_acceptance_criteria(
            "## Acceptance Criteria\n1. [AC-1] Command continues until Done,\n   including after a process restart.\n2. [AC-2] Errors are visible.\n",
        )
        .unwrap();

        assert_eq!(
            criteria[0].text,
            "Command continues until Done, including after a process restart."
        );
        assert_eq!(criteria[1].text, "Errors are visible.");
    }

    #[test]
    fn rejects_missing_or_duplicate_criteria() {
        assert!(parse_acceptance_criteria("# Spec\n").is_err());
        assert!(
            parse_acceptance_criteria(
                "## Acceptance Criteria\n- [ ] [AC-1] First\n- [ ] [AC-1] Second\n"
            )
            .is_err()
        );
    }

    #[test]
    fn paths_are_traversal_free() {
        assert!(validate_relative_path("ai/specs/001/evidence/a.png").is_ok());
        for invalid in [
            "",
            "/tmp/a",
            "../a",
            "a/../../b",
            "./a",
            "a\\..\\b",
            "C:\\temp\\a",
        ] {
            assert!(
                validate_relative_path(invalid).is_err(),
                "accepted {invalid}"
            );
        }
    }

    #[test]
    fn strong_plan_is_typed_acyclic_and_covers_every_criterion() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("plan.json");
        fs::write(
            &path,
            r#"{
              "schemaVersion": 1,
              "specId": "001-test",
              "tasks": [
                {"id":"T-1","objective":"Build","dependencies":[],"writeScopes":["src"],"acceptanceCriteria":["AC-1"]},
                {"id":"T-2","objective":"Wire","dependencies":["T-1"],"writeScopes":["tests"],"acceptanceCriteria":["AC-2"]}
              ]
            }"#,
        )
        .unwrap();
        let criteria = vec![
            Criterion {
                id: "AC-1".into(),
                text: "one".into(),
                ui: false,
            },
            Criterion {
                id: "AC-2".into(),
                text: "two".into(),
                ui: false,
            },
        ];
        validate_strong_plan(&path, "001-test", &criteria).unwrap();

        let cyclic = fs::read_to_string(&path)
            .unwrap()
            .replace(r#""dependencies":[]"#, r#""dependencies":["T-2"]"#);
        fs::write(&path, cyclic).unwrap();
        assert!(validate_strong_plan(&path, "001-test", &criteria).is_err());
    }
}
