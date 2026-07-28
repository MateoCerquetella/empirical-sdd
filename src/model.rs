use std::collections::BTreeMap;
use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

use crate::error::{Result, SddError};

pub const PROTOCOL: &str = "empirical-sdd";
pub const SCHEMA_VERSION: u32 = 2;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum Profile {
    #[default]
    Quick,
    Strong,
}

impl fmt::Display for Profile {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Quick => "quick",
            Self::Strong => "strong",
        })
    }
}

impl FromStr for Profile {
    type Err = SddError;

    fn from_str(value: &str) -> Result<Self> {
        match normalize(value).as_str() {
            "quick" => Ok(Self::Quick),
            "strong" => Ok(Self::Strong),
            other => Err(SddError::InvalidConfig(format!(
                "unknown profile '{other}'"
            ))),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Phase {
    Idle,
    Shape,
    Specify,
    Design,
    Plan,
    Implement,
    Verify,
    Review,
    Deliver,
    Done,
}

impl Phase {
    pub const QUICK: [Self; 4] = [Self::Shape, Self::Implement, Self::Verify, Self::Review];
    pub const STRONG: [Self; 6] = [
        Self::Specify,
        Self::Design,
        Self::Plan,
        Self::Implement,
        Self::Verify,
        Self::Review,
    ];

    pub fn first(profile: Profile) -> Self {
        match profile {
            Profile::Quick => Self::Shape,
            Profile::Strong => Self::Specify,
        }
    }

    pub fn sequence(profile: Profile) -> &'static [Self] {
        match profile {
            Profile::Quick => &Self::QUICK,
            Profile::Strong => &Self::STRONG,
        }
    }

    pub fn next(self, profile: Profile, delivery_enabled: bool) -> Option<Self> {
        if self == Self::Idle {
            return Some(Self::first(profile));
        }
        if self == Self::Deliver {
            return Some(Self::Done);
        }
        if self == Self::Done {
            return None;
        }
        let sequence = Self::sequence(profile);
        let index = sequence.iter().position(|phase| *phase == self)?;
        if let Some(next) = sequence.get(index + 1) {
            Some(*next)
        } else if delivery_enabled {
            Some(Self::Deliver)
        } else {
            Some(Self::Done)
        }
    }

    pub fn is_execution(self) -> bool {
        matches!(self, Self::Implement | Self::Verify | Self::Review)
    }
}

impl fmt::Display for Phase {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Idle => "idle",
            Self::Shape => "shape",
            Self::Specify => "specify",
            Self::Design => "design",
            Self::Plan => "plan",
            Self::Implement => "implement",
            Self::Verify => "verify",
            Self::Review => "review",
            Self::Deliver => "deliver",
            Self::Done => "done",
        })
    }
}

impl FromStr for Phase {
    type Err = SddError;

    fn from_str(value: &str) -> Result<Self> {
        match normalize(value).as_str() {
            "idle" | "none" => Ok(Self::Idle),
            "shape" => Ok(Self::Shape),
            "analyst" | "pm" | "specification" | "specify" | "authoring" => Ok(Self::Specify),
            "architect" | "architecture" | "design" => Ok(Self::Design),
            "planning" | "plan" | "decompose" => Ok(Self::Plan),
            "dev" | "developer" | "implementation" | "implement" | "executing" => {
                Ok(Self::Implement)
            }
            "test" | "tester" | "verification" | "verify" | "qa" => Ok(Self::Verify),
            "reviewer" | "review" => Ok(Self::Review),
            "delivery" | "deliver" => Ok(Self::Deliver),
            "complete" | "completed" | "done" | "ready" => Ok(Self::Done),
            other => Err(SddError::InvalidState(format!("unknown phase '{other}'"))),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowStatus {
    #[default]
    Idle,
    Running,
    Waiting,
    AwaitingHuman,
    Blocked,
    Done,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ControlMode {
    #[default]
    Hitl,
    Autonomous,
}

impl fmt::Display for ControlMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Hitl => "hitl",
            Self::Autonomous => "autonomous",
        })
    }
}

impl FromStr for ControlMode {
    type Err = SddError;

    fn from_str(value: &str) -> Result<Self> {
        match normalize(value).as_str() {
            "hitl" | "human" | "interactive" => Ok(Self::Hitl),
            "autonomous" | "auto" | "autopilot" => Ok(Self::Autonomous),
            other => Err(SddError::InvalidState(format!(
                "unknown control mode '{other}'"
            ))),
        }
    }
}

impl fmt::Display for WorkflowStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Idle => "idle",
            Self::Running => "running",
            Self::Waiting => "waiting",
            Self::AwaitingHuman => "awaiting_human",
            Self::Blocked => "blocked",
            Self::Done => "done",
        })
    }
}

impl FromStr for WorkflowStatus {
    type Err = SddError;

    fn from_str(value: &str) -> Result<Self> {
        match normalize(value).as_str() {
            "idle" => Ok(Self::Idle),
            "running" => Ok(Self::Running),
            "waiting" | "paused" => Ok(Self::Waiting),
            "awaiting_human" | "awaitinghuman" | "awaiting_confirm" => Ok(Self::AwaitingHuman),
            "blocked" | "failed" => Ok(Self::Blocked),
            "done" | "completed" | "succeeded" => Ok(Self::Done),
            other => Err(SddError::InvalidState(format!(
                "unknown workflow status '{other}'"
            ))),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct State {
    pub protocol: String,
    pub schema_version: u32,
    pub revision: u64,
    pub project_id: String,
    pub current_spec: Option<String>,
    pub profile: Profile,
    pub mode: ControlMode,
    pub phase: Phase,
    pub status: WorkflowStatus,
    pub repair_attempts: u8,
    pub spec_revision: u64,
    pub spec_hash: Option<String>,
    pub last_event: Option<String>,
    pub implementation_actor: Option<String>,
    pub message: Option<String>,
}

impl State {
    pub fn new(project_id: String, profile: Profile) -> Self {
        Self {
            protocol: PROTOCOL.into(),
            schema_version: SCHEMA_VERSION,
            revision: 0,
            project_id,
            current_spec: None,
            profile,
            mode: ControlMode::Hitl,
            phase: Phase::Idle,
            status: WorkflowStatus::Idle,
            repair_attempts: 0,
            spec_revision: 1,
            spec_hash: None,
            last_event: None,
            implementation_actor: None,
            message: None,
        }
    }

    pub fn validate(&self) -> Result<()> {
        if self.protocol != PROTOCOL {
            return Err(SddError::InvalidState(format!(
                "unsupported protocol '{}'",
                self.protocol
            )));
        }
        if self.schema_version != SCHEMA_VERSION {
            return Err(SddError::InvalidState(format!(
                "unsupported state schema {}",
                self.schema_version
            )));
        }
        if (self.phase == Phase::Done) != (self.status == WorkflowStatus::Done) {
            return Err(SddError::InvalidState(
                "phase done and status done must occur together".into(),
            ));
        }
        if self.project_id.trim().is_empty()
            || self.project_id.trim() != self.project_id
            || self.project_id.chars().any(char::is_control)
        {
            return Err(SddError::InvalidState("invalid project_id".into()));
        }
        if self.spec_revision == 0 {
            return Err(SddError::InvalidState(
                "spec_revision must be at least one".into(),
            ));
        }
        if self.repair_attempts > 20 {
            return Err(SddError::InvalidState(
                "repair_attempts exceeds the protocol maximum".into(),
            ));
        }
        if (self.revision == 0) != self.last_event.is_none() {
            return Err(SddError::InvalidState(
                "revision zero must have no last_event and later revisions must have one".into(),
            ));
        }
        if self
            .spec_hash
            .as_deref()
            .is_some_and(|hash| !valid_sha256(hash))
        {
            return Err(SddError::InvalidState(
                "spec_hash must use sha256:<64 hex characters>".into(),
            ));
        }
        if self
            .current_spec
            .as_deref()
            .is_some_and(|spec| spec.trim().is_empty() || spec.trim() != spec)
        {
            return Err(SddError::InvalidState("invalid current_spec".into()));
        }
        if self.phase != Phase::Idle && self.current_spec.is_none() {
            return Err(SddError::InvalidState(
                "a non-idle phase requires a current spec".into(),
            ));
        }
        if (self.phase == Phase::Idle) != (self.status == WorkflowStatus::Idle) {
            return Err(SddError::InvalidState(
                "idle phase and idle status must occur together".into(),
            ));
        }
        if self
            .implementation_actor
            .as_deref()
            .is_some_and(|actor| !valid_identity(actor))
        {
            return Err(SddError::InvalidState(
                "implementation_actor is not a valid identity".into(),
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    Adopted,
    SpecSelected,
    SpecChanged,
    PhaseStarted,
    PhasePassed,
    PhaseFailed,
    RepairScheduled,
    HumanRequested,
    HumanApproved,
    Blocked,
    EvidenceRecorded,
    DeliveryCompleted,
    Completed,
    Recovered,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Event {
    pub schema_version: u32,
    pub id: String,
    pub occurred_at: String,
    pub expected_revision: u64,
    pub revision: u64,
    pub kind: EventKind,
    pub actor: String,
    pub summary: String,
    pub previous_event: Option<String>,
    pub state: State,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Criterion {
    pub id: String,
    pub text: String,
    pub ui: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EvidenceKind {
    Test,
    BrowserAssertion,
    ScreenshotReview,
    HumanVerification,
    CodeReview,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Verdict {
    Passed,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EvidenceRecord {
    pub schema_version: u32,
    pub id: String,
    pub spec_id: String,
    pub spec_revision: u64,
    pub workspace_hash: String,
    pub criterion_ids: Vec<String>,
    pub kind: EvidenceKind,
    pub verdict: Verdict,
    pub producer: String,
    pub reviewer: Option<String>,
    pub summary: String,
    pub command: Option<Vec<String>>,
    pub exit_code: Option<i32>,
    pub output_hash: Option<String>,
    pub artifact_path: Option<String>,
    pub artifact_hash: Option<String>,
    pub created_at: String,
    #[serde(default)]
    pub metadata: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PhaseOutcome {
    Passed,
    Failed,
    AwaitingHuman,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PhaseResult {
    pub schema_version: u32,
    pub outcome: PhaseOutcome,
    pub actor: String,
    pub summary: String,
    #[serde(default)]
    pub evidence: Vec<EvidenceRecord>,
    #[serde(default)]
    pub artifacts: Vec<String>,
}

fn normalize(value: &str) -> String {
    value
        .trim()
        .trim_matches(|character| matches!(character, '`' | '"' | '\'' | '<' | '>'))
        .to_ascii_lowercase()
        .replace(['-', ' '], "_")
}

pub(crate) fn valid_identity(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 256
        && value.trim() == value
        && !value.chars().any(char::is_control)
}

fn valid_sha256(value: &str) -> bool {
    value
        .strip_prefix("sha256:")
        .is_some_and(|hex| hex.len() == 64 && hex.bytes().all(|byte| byte.is_ascii_hexdigit()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profiles_have_distinct_short_and_strong_sequences() {
        assert_eq!(Phase::sequence(Profile::Quick), &Phase::QUICK);
        assert_eq!(Phase::sequence(Profile::Strong), &Phase::STRONG);
        assert!(Phase::STRONG.len() > Phase::QUICK.len());
    }

    #[test]
    fn legacy_phase_names_parse() {
        assert_eq!("pm".parse::<Phase>().unwrap(), Phase::Specify);
        assert_eq!("architect".parse::<Phase>().unwrap(), Phase::Design);
        assert_eq!("dev".parse::<Phase>().unwrap(), Phase::Implement);
        assert_eq!("test".parse::<Phase>().unwrap(), Phase::Verify);
        assert_eq!("reviewer".parse::<Phase>().unwrap(), Phase::Review);
    }

    #[test]
    fn delivery_is_optional_after_review() {
        assert_eq!(Phase::Review.next(Profile::Quick, false), Some(Phase::Done));
        assert_eq!(
            Phase::Review.next(Profile::Quick, true),
            Some(Phase::Deliver)
        );
    }
}
