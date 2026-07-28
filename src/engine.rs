use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::adapter::{Capability, PhaseAdapter, PhaseContext};
use crate::config::{BrowserRequirement, Config};
use crate::error::{Result, SddError};
use crate::evidence::EvidenceStore;
use crate::model::{
    ControlMode, EventKind, Phase, PhaseOutcome, PhaseResult, State, WorkflowStatus, valid_identity,
};
use crate::repository::SddRepository;
use crate::spec::{sha256_file, validate_relative_path, validate_strong_plan};
use crate::workspace::workspace_hash;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "reason", rename_all = "snake_case")]
pub enum RunStop {
    Done {
        state: State,
    },
    Blocked {
        state: State,
        message: String,
    },
    AwaitingHuman {
        state: State,
        message: String,
    },
    MissingAdapter {
        state: State,
        phase: Phase,
    },
    MissingCapabilities {
        state: State,
        phase: Phase,
        capabilities: Vec<Capability>,
    },
    ReadyForDelivery {
        state: State,
    },
    Paused {
        state: State,
    },
}

pub struct LoopEngine<'a, A: PhaseAdapter> {
    repository: &'a SddRepository,
    adapter: &'a mut A,
    actor: String,
}

impl<'a, A: PhaseAdapter> LoopEngine<'a, A> {
    pub fn new(
        repository: &'a SddRepository,
        adapter: &'a mut A,
        actor: impl Into<String>,
    ) -> Self {
        Self {
            repository,
            adapter,
            actor: actor.into(),
        }
    }

    pub fn run_until_stop(&mut self) -> Result<RunStop> {
        for _ in 0..64 {
            let stop = self.step()?;
            match stop {
                RunStop::Paused { ref state }
                    if state.status == WorkflowStatus::Waiting
                        && self.repository.load_config()?.loop_policy.auto_continue => {}
                other => return Ok(other),
            }
        }
        let state = self.repository.reconcile()?;
        let blocked = self.repository.transition(
            state.revision,
            EventKind::Blocked,
            &self.actor,
            "Loop exceeded the 64-transition safety ceiling",
            |state, _| {
                state.status = WorkflowStatus::Blocked;
                state.message = Some("Loop safety ceiling reached".into());
                Ok(())
            },
        )?;
        Ok(RunStop::Blocked {
            state: blocked,
            message: "Loop safety ceiling reached".into(),
        })
    }

    pub fn step(&mut self) -> Result<RunStop> {
        let state = self.repository.synchronize_spec_revision(&self.actor)?;
        match state.status {
            WorkflowStatus::Done => return Ok(RunStop::Done { state }),
            WorkflowStatus::Blocked => {
                let message = state
                    .message
                    .clone()
                    .unwrap_or_else(|| "Workflow is blocked".into());
                return Ok(RunStop::Blocked { state, message });
            }
            WorkflowStatus::AwaitingHuman => {
                let message = state
                    .message
                    .clone()
                    .unwrap_or_else(|| "Workflow is awaiting a human decision".into());
                return Ok(RunStop::AwaitingHuman { state, message });
            }
            _ => {}
        }
        if state.phase == Phase::Done {
            return Ok(RunStop::Done { state });
        }
        if state.phase == Phase::Deliver {
            return Ok(RunStop::ReadyForDelivery { state });
        }
        if state.phase == Phase::Idle || state.current_spec.is_none() {
            return Ok(RunStop::Paused { state });
        }
        if !self.adapter.supports(state.phase) {
            return Ok(RunStop::MissingAdapter {
                phase: state.phase,
                state,
            });
        }

        let config = self.repository.load_config()?;
        let criteria = self.repository.current_criteria(&state)?;
        let required = required_capabilities(state.phase, &criteria, &config);
        let available = self.adapter.capabilities(state.phase)?;
        let missing: Vec<_> = required.difference(&available).copied().collect();
        if !missing.is_empty() {
            return Ok(RunStop::MissingCapabilities {
                phase: state.phase,
                state,
                capabilities: missing,
            });
        }

        let phase = state.phase;
        let started = self.repository.transition(
            state.revision,
            EventKind::PhaseStarted,
            &self.actor,
            &format!("Started {phase}"),
            |state, _| {
                state.status = WorkflowStatus::Running;
                state.message = None;
                Ok(())
            },
        )?;
        let spec_id = started.current_spec.clone().ok_or_else(|| {
            SddError::InvalidState("active phase has no current specification".into())
        })?;
        let context = PhaseContext {
            root: self.repository.root().to_path_buf(),
            spec_dir: self.repository.spec_dir(&spec_id)?,
            spec_id,
            phase,
            profile: started.profile,
            revision: started.revision,
            spec_revision: started.spec_revision,
            workspace_hash: workspace_hash(self.repository.root())?,
            criteria: criteria.clone(),
            required_capabilities: required,
        };
        let result = match self.adapter.execute(&context) {
            Ok(result) => result,
            Err(SddError::MissingCapability(message)) => {
                let blocked = self.repository.transition(
                    started.revision,
                    EventKind::Blocked,
                    &self.actor,
                    &message,
                    |state, _| {
                        state.status = WorkflowStatus::Blocked;
                        state.message = Some(message.clone());
                        Ok(())
                    },
                )?;
                return Ok(RunStop::Blocked {
                    state: blocked,
                    message,
                });
            }
            Err(error) => {
                return self.handle_failure(started, &config, format!("Adapter failure: {error}"));
            }
        };
        self.apply_result(started, config, criteria, result)
    }

    pub fn approve(&self, expected_revision: u64, actor: &str) -> Result<State> {
        self.repository.transition(
            expected_revision,
            EventKind::HumanApproved,
            actor,
            "Human approved continuation",
            |state, _| {
                if state.status != WorkflowStatus::AwaitingHuman {
                    return Err(SddError::InvalidState(
                        "workflow is not awaiting human approval".into(),
                    ));
                }
                state.status = WorkflowStatus::Waiting;
                state.message = None;
                Ok(())
            },
        )
    }

    /// Resumes a genuinely blocked workflow after a human or external system
    /// has resolved the reported condition.
    pub fn retry(&self, expected_revision: u64, actor: &str) -> Result<State> {
        self.repository.transition(
            expected_revision,
            EventKind::RepairScheduled,
            actor,
            "Blocker resolved; retry authorized",
            |state, _| {
                if state.status != WorkflowStatus::Blocked {
                    return Err(SddError::InvalidState("workflow is not blocked".into()));
                }
                state.phase = repair_phase(state.phase, state.profile);
                state.status = WorkflowStatus::Waiting;
                state.repair_attempts = 0;
                state.message = None;
                Ok(())
            },
        )
    }

    /// Applies a result produced by an IDE, agent, MCP host, or other external
    /// client. A waiting phase is claimed first; a running phase can be resumed
    /// after the original client exits. The revision prevents a stale client
    /// from checking in against newer work.
    pub fn check_in(&self, expected_revision: u64, result: PhaseResult) -> Result<RunStop> {
        let projected = self.repository.reconcile()?;
        if projected.revision != expected_revision {
            return Err(SddError::StaleRevision {
                expected: expected_revision,
                actual: projected.revision,
            });
        }
        let state = if matches!(projected.phase, Phase::Shape | Phase::Specify) {
            // These phases own edits to spec.md. Absorb the new hash when the
            // result passes instead of classifying the agent's expected edit
            // as an out-of-band change before check-in.
            projected
        } else {
            self.repository.synchronize_spec_revision(&self.actor)?
        };
        if state.revision != expected_revision {
            return Err(SddError::StaleRevision {
                expected: expected_revision,
                actual: state.revision,
            });
        }
        if state.current_spec.is_none() || matches!(state.phase, Phase::Idle | Phase::Done) {
            return Err(SddError::InvalidState(
                "there is no active phase to check in".into(),
            ));
        }
        if state.phase == Phase::Deliver {
            return Err(SddError::InvalidState(
                "delivery must use a delivery provider".into(),
            ));
        }
        let started = match state.status {
            WorkflowStatus::Waiting | WorkflowStatus::Idle => self.repository.transition(
                state.revision,
                EventKind::PhaseStarted,
                &result.actor,
                &format!("Claimed {} for external check-in", state.phase),
                |state, _| {
                    state.status = WorkflowStatus::Running;
                    state.message = None;
                    Ok(())
                },
            )?,
            WorkflowStatus::Running => state,
            WorkflowStatus::AwaitingHuman => {
                return Err(SddError::InvalidState(
                    "human approval is required before check-in".into(),
                ));
            }
            WorkflowStatus::Blocked => {
                return Err(SddError::InvalidState(
                    "blocked workflow must be resolved before check-in".into(),
                ));
            }
            WorkflowStatus::Done => {
                return Err(SddError::InvalidState("workflow is already done".into()));
            }
        };
        let config = self.repository.load_config()?;
        let criteria = self.repository.current_criteria(&started)?;
        self.apply_result(started, config, criteria, result)
    }

    fn apply_result(
        &self,
        started: State,
        config: Config,
        criteria: Vec<crate::model::Criterion>,
        result: PhaseResult,
    ) -> Result<RunStop> {
        if result.schema_version != crate::model::SCHEMA_VERSION {
            return self.handle_failure(
                started,
                &config,
                format!(
                    "Adapter returned unsupported schema {}",
                    result.schema_version
                ),
            );
        }
        if !valid_identity(&result.actor) || result.summary.trim().is_empty() {
            return self.handle_failure(
                started,
                &config,
                "Adapter result omitted actor or summary".into(),
            );
        }
        if result.outcome == PhaseOutcome::AwaitingHuman {
            let summary = result.summary;
            let waiting = self.repository.transition(
                started.revision,
                EventKind::HumanRequested,
                &result.actor,
                &summary,
                |state, _| {
                    state.status = WorkflowStatus::AwaitingHuman;
                    state.message = Some(summary.clone());
                    Ok(())
                },
            )?;
            return Ok(RunStop::AwaitingHuman {
                state: waiting,
                message: summary,
            });
        }
        if result.outcome == PhaseOutcome::Failed {
            return self.handle_failure(started, &config, result.summary);
        }

        if let Err(error) = validate_phase_artifacts(self.repository, &started, &criteria, &result)
        {
            return self.handle_failure(started, &config, error.to_string());
        }
        let shaped_spec_hash = if matches!(started.phase, Phase::Shape | Phase::Specify) {
            let spec_id = started.current_spec.as_deref().ok_or_else(|| {
                SddError::InvalidState("shaping phase has no current specification".into())
            })?;
            // A shaping phase is the one place where editing the behavioral
            // contract is expected. Validate it and absorb its new hash into
            // the same transition so the next loop does not restart.
            self.repository.current_criteria(&started)?;
            Some(sha256_file(&self.repository.spec_path(spec_id)?)?)
        } else {
            None
        };
        if !result.evidence.is_empty() {
            if let Err(error) =
                EvidenceStore::current(self.repository, &started)?.add(result.evidence)
            {
                return self.handle_failure(started, &config, error.to_string());
            }
        }
        if started.phase == Phase::Verify {
            let mut verify_policy = config.evidence.clone();
            verify_policy.code_review = false;
            verify_policy.independent_code_review = false;
            let report = match EvidenceStore::current(self.repository, &started)?
                .evaluate(&criteria, &verify_policy)
            {
                Ok(report) => report,
                Err(error) => return self.handle_failure(started, &config, error.to_string()),
            };
            if !report.valid {
                return self.handle_failure(
                    started,
                    &config,
                    format!(
                        "Verification evidence incomplete: {}",
                        report.missing.join("; ")
                    ),
                );
            }
        }
        if started.phase == Phase::Review {
            let report = match EvidenceStore::current(self.repository, &started)?
                .evaluate(&criteria, &config.evidence)
            {
                Ok(report) => report,
                Err(error) => return self.handle_failure(started, &config, error.to_string()),
            };
            if !report.valid {
                return self.handle_failure(
                    started,
                    &config,
                    format!("Review evidence incomplete: {}", report.missing.join("; ")),
                );
            }
        }

        let delivery_enabled = config.delivery_enabled();
        let next = started
            .phase
            .next(started.profile, delivery_enabled)
            .ok_or_else(|| SddError::InvalidState("phase has no valid successor".into()))?;
        let pause_for_human = started.mode == ControlMode::Hitl && next != Phase::Done;
        let kind = if next == Phase::Done {
            EventKind::Completed
        } else {
            EventKind::PhasePassed
        };
        let summary = result.summary;
        let actor = result.actor;
        let advanced =
            self.repository
                .transition(started.revision, kind, &actor, &summary, |state, _| {
                    if started.phase == Phase::Implement {
                        state.implementation_actor = Some(actor.clone());
                    }
                    if let Some(hash) = shaped_spec_hash.as_ref() {
                        if state.spec_hash.as_ref() != Some(hash) {
                            state.spec_hash = Some(hash.clone());
                            state.spec_revision =
                                state.spec_revision.checked_add(1).ok_or_else(|| {
                                    SddError::InvalidState("spec revision counter overflow".into())
                                })?;
                        }
                    }
                    state.repair_attempts = 0;
                    state.phase = next;
                    state.status = if next == Phase::Done {
                        WorkflowStatus::Done
                    } else if pause_for_human {
                        WorkflowStatus::AwaitingHuman
                    } else {
                        WorkflowStatus::Waiting
                    };
                    state.message =
                        pause_for_human.then(|| format!("Approve continuation to {next}"));
                    Ok(())
                })?;

        if next == Phase::Done {
            return Ok(RunStop::Done { state: advanced });
        }
        if pause_for_human {
            let message = advanced.message.clone().unwrap_or_default();
            return Ok(RunStop::AwaitingHuman {
                state: advanced,
                message,
            });
        }
        if next == Phase::Deliver {
            return Ok(RunStop::ReadyForDelivery { state: advanced });
        }
        Ok(RunStop::Paused { state: advanced })
    }

    fn handle_failure(&self, started: State, config: &Config, message: String) -> Result<RunStop> {
        let can_repair = started.repair_attempts < config.loop_policy.max_repair_attempts;
        let kind = if can_repair {
            EventKind::RepairScheduled
        } else {
            EventKind::Blocked
        };
        let failed = self.repository.transition(
            started.revision,
            kind,
            &self.actor,
            &message,
            |state, _| {
                state.message = Some(message.clone());
                if can_repair {
                    state.repair_attempts = state.repair_attempts.saturating_add(1);
                    state.phase = repair_phase(started.phase, started.profile);
                    state.status = WorkflowStatus::Waiting;
                } else {
                    state.status = WorkflowStatus::Blocked;
                }
                Ok(())
            },
        )?;
        if can_repair {
            Ok(RunStop::Paused { state: failed })
        } else {
            Ok(RunStop::Blocked {
                state: failed,
                message,
            })
        }
    }
}

pub fn required_capabilities(
    phase: Phase,
    criteria: &[crate::model::Criterion],
    config: &Config,
) -> BTreeSet<Capability> {
    let mut required = BTreeSet::new();
    if phase == Phase::Verify {
        if config.evidence.tests {
            required.insert(Capability::Tests);
        }
        let ui = criteria.iter().any(|criterion| criterion.ui);
        if config.evidence.browser == BrowserRequirement::Required
            || (ui && config.evidence.browser == BrowserRequirement::RequiredForUi)
        {
            required.insert(Capability::Browser);
        }
        if ui && config.evidence.screenshots_for_ui {
            required.insert(Capability::Screenshots);
        }
        if ui && config.evidence.screenshot_review_for_ui {
            required.insert(Capability::ScreenshotReview);
        }
    }
    if phase == Phase::Review && config.evidence.code_review {
        required.insert(Capability::CodeReview);
    }
    required
}

fn repair_phase(failed: Phase, profile: crate::model::Profile) -> Phase {
    match failed {
        Phase::Verify | Phase::Review => Phase::Implement,
        Phase::Design | Phase::Plan => Phase::Specify,
        Phase::Shape | Phase::Specify | Phase::Implement => failed,
        Phase::Idle | Phase::Deliver | Phase::Done => Phase::first(profile),
    }
}

fn validate_phase_artifacts(
    repository: &SddRepository,
    state: &State,
    criteria: &[crate::model::Criterion],
    result: &PhaseResult,
) -> Result<()> {
    let spec_id = state
        .current_spec
        .as_deref()
        .ok_or_else(|| SddError::InvalidState("no current spec is selected".into()))?;
    let spec_dir = repository.spec_dir(spec_id)?;
    let required = match (state.profile, state.phase) {
        (_, Phase::Shape | Phase::Specify) => Some(spec_dir.join("spec.md")),
        (crate::model::Profile::Strong, Phase::Design) => Some(spec_dir.join("architecture.md")),
        (crate::model::Profile::Strong, Phase::Plan) => Some(spec_dir.join("plan.json")),
        (crate::model::Profile::Strong, Phase::Review) => Some(spec_dir.join("review.md")),
        _ => None,
    };
    if let Some(path) = required {
        require_nonempty(&path)?;
        if state.phase == Phase::Plan {
            validate_strong_plan(&path, spec_id, criteria)?;
        }
    }
    let mut artifacts = BTreeSet::new();
    for relative in &result.artifacts {
        if !artifacts.insert(relative) {
            return Err(SddError::InvalidSpec(format!(
                "phase result repeats artifact path: {relative}"
            )));
        }
        validate_relative_path(relative)?;
        let path = repository.root().join(relative);
        let canonical = path
            .canonicalize()
            .map_err(|error| SddError::io(&path, error))?;
        if !canonical.starts_with(repository.root()) {
            return Err(SddError::InvalidSpec(format!(
                "adapter artifact escaped repository: {relative}"
            )));
        }
        require_nonempty(&canonical)?;
    }
    Ok(())
}

fn require_nonempty(path: &Path) -> Result<()> {
    let metadata = fs::metadata(path).map_err(|error| SddError::io(path, error))?;
    if !metadata.is_file() || metadata.len() == 0 {
        return Err(SddError::InvalidSpec(format!(
            "required artifact is empty or not a regular file: {}",
            path.display()
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;
    use crate::model::{EvidenceRecord, Profile, SCHEMA_VERSION};
    use std::collections::VecDeque;

    struct ScriptedAdapter {
        capabilities: BTreeSet<Capability>,
        results: VecDeque<PhaseResult>,
    }

    impl PhaseAdapter for ScriptedAdapter {
        fn supports(&self, _phase: Phase) -> bool {
            true
        }

        fn capabilities(&self, _phase: Phase) -> Result<BTreeSet<Capability>> {
            Ok(self.capabilities.clone())
        }

        fn execute(&mut self, _context: &PhaseContext) -> Result<PhaseResult> {
            self.results
                .pop_front()
                .ok_or_else(|| SddError::Adapter("script exhausted".into()))
        }
    }

    fn fixture(profile: Profile, ui: bool) -> (tempfile::TempDir, SddRepository, State) {
        let directory = tempfile::tempdir().unwrap();
        let spec_id = "001-test";
        fs::create_dir_all(directory.path().join(format!("ai/specs/{spec_id}"))).unwrap();
        let criterion = if ui {
            "- [ ] [AC-1] [UI] Page renders value"
        } else {
            "- [ ] [AC-1] Command returns value"
        };
        fs::write(
            directory.path().join(format!("ai/specs/{spec_id}/spec.md")),
            format!("# Test\n\n## Acceptance Criteria\n\n{criterion}\n"),
        )
        .unwrap();
        fs::write(
            directory.path().join("ai/STATE.md"),
            format!(
                "# State\ncurrent_spec: {spec_id}\ncurrent_phase: {}\nmode: autonomous\n",
                if profile == Profile::Quick {
                    "shape"
                } else {
                    "pm"
                }
            ),
        )
        .unwrap();
        let repository = SddRepository::from_root(directory.path()).unwrap();
        let config = Config {
            profile,
            ..Default::default()
        };
        repository.write_config(&config).unwrap();
        let state = repository.adopt(Some(profile), "test").unwrap();
        (directory, repository, state)
    }

    fn passed(actor: &str, evidence: Vec<EvidenceRecord>) -> PhaseResult {
        PhaseResult {
            schema_version: SCHEMA_VERSION,
            outcome: PhaseOutcome::Passed,
            actor: actor.into(),
            summary: "passed".into(),
            evidence,
            artifacts: Vec::new(),
        }
    }

    #[test]
    fn quick_and_strong_require_different_phase_counts() {
        assert_eq!(Phase::sequence(Profile::Quick).len(), 4);
        assert_eq!(Phase::sequence(Profile::Strong).len(), 6);
    }

    #[test]
    fn ui_verify_stops_resumably_when_browser_capabilities_are_missing() {
        let (_directory, repository, _state) = fixture(Profile::Quick, true);
        let mut adapter = ScriptedAdapter {
            capabilities: BTreeSet::new(),
            results: VecDeque::new(),
        };
        let mut engine = LoopEngine::new(&repository, &mut adapter, "runner");
        // Shape passes first.
        engine
            .adapter
            .results
            .push_back(passed("builder", Vec::new()));
        let first = engine.step().unwrap();
        assert!(matches!(first, RunStop::Paused { .. }));
        // Implement passes second.
        engine
            .adapter
            .results
            .push_back(passed("builder", Vec::new()));
        let second = engine.step().unwrap();
        let RunStop::Paused { state: ready } = second else {
            panic!("implement should advance to verify");
        };
        let stopped = engine.step().unwrap();
        let RunStop::MissingCapabilities { state, .. } = stopped else {
            panic!("missing browser capability should stop resumably");
        };
        assert_eq!(state.revision, ready.revision);
        assert_eq!(state.status, WorkflowStatus::Waiting);
    }

    #[test]
    fn repeated_failures_block_after_two_repairs() {
        let (_directory, repository, _state) = fixture(Profile::Quick, false);
        let failed = PhaseResult {
            schema_version: SCHEMA_VERSION,
            outcome: PhaseOutcome::Failed,
            actor: "builder".into(),
            summary: "not yet".into(),
            evidence: Vec::new(),
            artifacts: Vec::new(),
        };
        let mut adapter = ScriptedAdapter {
            capabilities: BTreeSet::new(),
            results: VecDeque::from([failed.clone(), failed.clone(), failed]),
        };
        let mut engine = LoopEngine::new(&repository, &mut adapter, "runner");
        assert!(matches!(engine.step().unwrap(), RunStop::Paused { .. }));
        assert!(matches!(engine.step().unwrap(), RunStop::Paused { .. }));
        let blocked = engine.step().unwrap();
        let RunStop::Blocked { state, .. } = blocked else {
            panic!("third failure should block");
        };
        let retried = engine.retry(state.revision, "operator").unwrap();
        assert_eq!(retried.status, WorkflowStatus::Waiting);
        assert_eq!(retried.repair_attempts, 0);
    }

    #[test]
    fn successful_repair_resets_attempt_budget_for_the_next_phase() {
        let (_directory, repository, _state) = fixture(Profile::Quick, false);
        let failed = PhaseResult {
            schema_version: SCHEMA_VERSION,
            outcome: PhaseOutcome::Failed,
            actor: "builder".into(),
            summary: "repair needed".into(),
            evidence: Vec::new(),
            artifacts: Vec::new(),
        };
        let mut adapter = ScriptedAdapter {
            capabilities: BTreeSet::new(),
            results: VecDeque::from([failed, passed("builder", Vec::new())]),
        };
        let mut engine = LoopEngine::new(&repository, &mut adapter, "runner");

        assert!(matches!(engine.step().unwrap(), RunStop::Paused { .. }));
        let repaired = engine.step().unwrap();
        let RunStop::Paused { state } = repaired else {
            panic!("successful repair should advance the workflow");
        };
        assert_eq!(state.phase, Phase::Implement);
        assert_eq!(state.repair_attempts, 0);
    }
}
