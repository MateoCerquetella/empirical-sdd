use std::collections::BTreeMap;
use std::str::FromStr;

use crate::error::{Result, SddError};
use crate::model::{ControlMode, PROTOCOL, Phase, Profile, SCHEMA_VERSION, State, WorkflowStatus};

#[derive(Debug, Clone)]
pub struct ParsedState {
    pub state: State,
    pub body: String,
    pub legacy: bool,
    pub preserved_notes: Option<String>,
}

const PRESERVED_HEADING: &str = "## Preserved pre-v2 state";
const PRESERVED_NOTICE: &str =
    "> This content is retained for history. The frontmatter above is canonical.";

pub fn parse_state(text: &str, profile: Profile, project_id: String) -> Result<ParsedState> {
    if let Some((frontmatter, body)) = split_frontmatter(text) {
        let fields = parse_fields(frontmatter);
        if fields
            .get("protocol")
            .is_some_and(|value| value == PROTOCOL)
        {
            return parse_current(fields, body.to_owned());
        }
    }
    parse_legacy(text, profile, project_id)
}

pub fn render_state(state: &State, preserved_notes: Option<&str>) -> String {
    let current_spec = state.current_spec.as_deref().unwrap_or("none");
    let current_role = role_for_phase(state.phase);
    let mut output = format!(
        "---\nprotocol: {}\nschema_version: {}\nrevision: {}\nproject_id: {}\ncurrent_spec: {}\nprofile: {}\nmode: {}\nphase: {}\nstatus: {}\nrepair_attempts: {}\nspec_revision: {}\nspec_hash: {}\nlast_event: {}\nimplementation_actor: {}\nmessage: {}\n---\n\n# State\n\n## Legacy-compatible status\n\n```text\ncurrent_spec: {}\ncurrent_role: {}\ncurrent_phase: {}\nmode: {}\n```\n",
        state.protocol,
        state.schema_version,
        state.revision,
        scalar(&state.project_id),
        scalar(current_spec),
        state.profile,
        state.mode,
        state.phase,
        state.status,
        state.repair_attempts,
        state.spec_revision,
        optional_scalar(state.spec_hash.as_deref()),
        optional_scalar(state.last_event.as_deref()),
        optional_scalar(state.implementation_actor.as_deref()),
        optional_scalar(state.message.as_deref()),
        current_spec,
        current_role,
        legacy_phase(state.phase),
        state.mode,
    );
    if let Some(notes) = preserved_notes
        .map(str::trim)
        .filter(|notes| !notes.is_empty())
    {
        output.push_str(&format!("\n{PRESERVED_HEADING}\n\n{PRESERVED_NOTICE}\n\n"));
        output.push_str(notes);
        output.push('\n');
    }
    output
}

fn parse_current(fields: BTreeMap<String, String>, body: String) -> Result<ParsedState> {
    let protocol = required(&fields, "protocol")?.to_owned();
    let schema_version = parse_number::<u32>(&fields, "schema_version")?;
    let revision = parse_number::<u64>(&fields, "revision")?;
    let project_id = required(&fields, "project_id")?.to_owned();
    let profile = Profile::from_str(required(&fields, "profile")?)?;
    let mode = ControlMode::from_str(fields.get("mode").map(String::as_str).unwrap_or("hitl"))?;
    let phase = Phase::from_str(
        fields
            .get("phase")
            .or_else(|| fields.get("current_phase"))
            .map(String::as_str)
            .unwrap_or("idle"),
    )?;
    let status = WorkflowStatus::from_str(fields.get("status").map(String::as_str).unwrap_or(
        if phase == Phase::Done {
            "done"
        } else {
            "waiting"
        },
    ))?;
    let state = State {
        protocol,
        schema_version,
        revision,
        project_id,
        current_spec: optional(fields.get("current_spec")),
        profile,
        mode,
        phase,
        status,
        repair_attempts: optional_number(&fields, "repair_attempts")?.unwrap_or(0),
        spec_revision: optional_number(&fields, "spec_revision")?.unwrap_or(1),
        spec_hash: optional(fields.get("spec_hash")),
        last_event: optional(fields.get("last_event")),
        implementation_actor: optional(fields.get("implementation_actor")),
        message: optional(fields.get("message")),
    };
    state.validate()?;
    Ok(ParsedState {
        state,
        preserved_notes: extract_preserved_notes(&body).map(str::to_owned),
        body,
        legacy: false,
    })
}

fn parse_legacy(text: &str, profile: Profile, project_id: String) -> Result<ParsedState> {
    let fields = parse_legacy_fields(text);
    let current_spec = optional(fields.get("current_spec"));
    let mut phase = if current_spec.is_none() {
        Phase::Idle
    } else {
        let raw_phase = fields
            .get("current_phase")
            .or_else(|| fields.get("phase"))
            .or_else(|| fields.get("current_role"))
            .map(String::as_str)
            .unwrap_or("idle");
        Phase::from_str(raw_phase)?
    };
    if profile == Profile::Quick {
        phase = match phase {
            Phase::Specify | Phase::Design | Phase::Plan => Phase::Shape,
            other => other,
        };
    }
    let status = if phase == Phase::Done {
        WorkflowStatus::Done
    } else if phase == Phase::Idle {
        WorkflowStatus::Idle
    } else {
        WorkflowStatus::Waiting
    };
    let mode = fields
        .get("mode")
        .and_then(|value| optional(Some(value)))
        .map(|value| ControlMode::from_str(&value))
        .transpose()?
        .unwrap_or_default();
    Ok(ParsedState {
        state: State {
            protocol: PROTOCOL.into(),
            schema_version: SCHEMA_VERSION,
            revision: 0,
            project_id,
            current_spec,
            profile,
            mode,
            phase,
            status,
            repair_attempts: 0,
            spec_revision: 1,
            spec_hash: None,
            last_event: None,
            implementation_actor: None,
            message: Some(
                "Empirical v1 state discovered; run `empirical adopt` to enable events".into(),
            ),
        },
        body: text.to_owned(),
        legacy: true,
        preserved_notes: Some(text.to_owned()),
    })
}

fn extract_preserved_notes(body: &str) -> Option<&str> {
    let (_, preserved) = body.split_once(PRESERVED_HEADING)?;
    let preserved = preserved.trim_start();
    let preserved = preserved.strip_prefix(PRESERVED_NOTICE)?.trim();
    (!preserved.is_empty()).then_some(preserved)
}

fn split_frontmatter(text: &str) -> Option<(&str, &str)> {
    let normalized = text.strip_prefix("\u{feff}").unwrap_or(text);
    if let Some(rest) = normalized.strip_prefix("---\n") {
        let offset = rest.find("\n---\n")?;
        return Some((&rest[..offset], &rest[offset + 5..]));
    }
    let rest = normalized.strip_prefix("---\r\n")?;
    let offset = rest.find("\r\n---\r\n")?;
    Some((&rest[..offset], &rest[offset + 7..]))
}

fn parse_fields(text: &str) -> BTreeMap<String, String> {
    text.lines()
        .filter_map(|line| line.split_once(':'))
        .map(|(key, value)| (normalize_key(key), clean_value(value)))
        .filter(|(key, _)| !key.is_empty())
        .collect()
}

fn parse_legacy_fields(text: &str) -> BTreeMap<String, String> {
    let mut fields = BTreeMap::new();
    for line in text.lines() {
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        let key = normalize_key(key);
        if matches!(
            key.as_str(),
            "current_spec" | "current_role" | "current_phase" | "phase" | "mode"
        ) {
            fields.entry(key).or_insert_with(|| clean_value(value));
        }
    }
    fields
}

fn normalize_key(value: &str) -> String {
    value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || *character == '_')
        .collect::<String>()
        .to_ascii_lowercase()
}

fn clean_value(value: &str) -> String {
    let cleaned = value
        .split("<!--")
        .next()
        .unwrap_or(value)
        .trim()
        .trim_matches(|character| matches!(character, '`' | '*' | '_'))
        .trim();
    if cleaned.starts_with('"') && cleaned.ends_with('"') {
        if let Ok(decoded) = serde_json::from_str::<String>(cleaned) {
            return decoded;
        }
    }
    cleaned.trim_matches('\'').to_owned()
}

fn optional(value: Option<&String>) -> Option<String> {
    value.map(|value| clean_value(value)).filter(|value| {
        !value.is_empty()
            && !matches!(
                value.to_ascii_lowercase().as_str(),
                "none" | "null" | "<none>" | "-"
            )
            && !value.starts_with('<')
    })
}

fn required<'a>(fields: &'a BTreeMap<String, String>, key: &str) -> Result<&'a str> {
    fields
        .get(key)
        .map(String::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| SddError::InvalidState(format!("missing frontmatter field '{key}'")))
}

fn parse_number<T>(fields: &BTreeMap<String, String>, key: &str) -> Result<T>
where
    T: FromStr,
{
    required(fields, key)?.parse::<T>().map_err(|_| {
        SddError::InvalidState(format!("frontmatter field '{key}' is not a valid number"))
    })
}

fn optional_number<T>(fields: &BTreeMap<String, String>, key: &str) -> Result<Option<T>>
where
    T: FromStr,
{
    fields
        .get(key)
        .filter(|value| !value.is_empty())
        .map(|value| {
            value.parse::<T>().map_err(|_| {
                SddError::InvalidState(format!("frontmatter field '{key}' is not a valid number"))
            })
        })
        .transpose()
}

fn scalar(value: &str) -> String {
    if value
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || "-_./".contains(character))
    {
        value.to_owned()
    } else {
        serde_json::to_string(value).unwrap_or_else(|_| "\"invalid\"".into())
    }
}

fn optional_scalar(value: Option<&str>) -> String {
    value.map(scalar).unwrap_or_else(|| "none".into())
}

fn role_for_phase(phase: Phase) -> &'static str {
    match phase {
        Phase::Idle => "none",
        Phase::Shape | Phase::Specify => "pm",
        Phase::Design | Phase::Plan => "architect",
        Phase::Implement => "developer",
        Phase::Verify => "tester",
        Phase::Review => "reviewer",
        Phase::Deliver => "delivery",
        Phase::Done => "none",
    }
}

fn legacy_phase(phase: Phase) -> &'static str {
    match phase {
        Phase::Idle => "idle",
        Phase::Shape | Phase::Specify => "pm",
        Phase::Design | Phase::Plan => "architect",
        Phase::Implement => "dev",
        Phase::Verify => "test",
        Phase::Review => "review",
        Phase::Deliver => "review",
        Phase::Done => "done",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const V1: &str = r#"# State

```
current_spec:    014-small-feature
current_role:    developer
current_phase:   dev
mode:            autonomous
```

## Recent decisions

- Keep this history.
"#;

    #[test]
    fn reads_v1_without_requiring_frontmatter() {
        let parsed = parse_state(V1, Profile::Strong, "legacy".into()).unwrap();
        assert!(parsed.legacy);
        assert_eq!(
            parsed.state.current_spec.as_deref(),
            Some("014-small-feature")
        );
        assert_eq!(parsed.state.phase, Phase::Implement);
        assert_eq!(parsed.state.mode, ControlMode::Autonomous);
        assert_eq!(parsed.state.revision, 0);
        assert_eq!(parsed.body, V1);
    }

    #[test]
    fn reads_the_untouched_v1_starter_placeholders_as_idle() {
        let template = r#"# State

```
current_spec:    <none | NNN-spec-name>
current_role:    <none | analyst | pm | architect | developer | tester | reviewer>
current_phase:   <idle | analyst | pm | architect | dev | test | review | done>
mode:            <hitl | autonomous>
started_at:      <YYYY-MM-DD>
```
"#;
        let parsed = parse_state(template, Profile::Strong, "legacy".into()).unwrap();
        assert!(parsed.legacy);
        assert_eq!(parsed.state.current_spec, None);
        assert_eq!(parsed.state.phase, Phase::Idle);
        assert_eq!(parsed.state.status, WorkflowStatus::Idle);
        assert_eq!(parsed.state.mode, ControlMode::Hitl);
    }

    #[test]
    fn v1_early_phases_compress_into_quick_shape() {
        let parsed = parse_state(
            &V1.replace("dev", "architect"),
            Profile::Quick,
            "legacy".into(),
        )
        .unwrap();
        assert_eq!(parsed.state.phase, Phase::Shape);
    }

    #[test]
    fn current_state_round_trips() {
        let mut state = State::new("project-1".into(), Profile::Quick);
        state.current_spec = Some("001-example".into());
        state.phase = Phase::Verify;
        state.status = WorkflowStatus::Waiting;
        state.revision = 7;
        state.last_event = Some("EVT-round-trip".into());
        let rendered = render_state(&state, Some("old notes"));
        let parsed = parse_state(&rendered, Profile::Strong, "ignored".into()).unwrap();
        assert!(!parsed.legacy);
        assert_eq!(parsed.state, state);
        assert!(rendered.contains("old notes"));
        assert_eq!(parsed.preserved_notes.as_deref(), Some("old notes"));

        let crlf = rendered.replace('\n', "\r\n");
        let parsed = parse_state(&crlf, Profile::Strong, "ignored".into()).unwrap();
        assert!(!parsed.legacy);
        assert_eq!(parsed.state, state);
        assert_eq!(parsed.preserved_notes.as_deref(), Some("old notes"));
    }
}
