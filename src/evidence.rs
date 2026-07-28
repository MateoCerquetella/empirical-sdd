use std::collections::{BTreeMap, BTreeSet};
use std::fs::{self, File, OpenOptions};
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;

use crate::config::{BrowserRequirement, EvidencePolicy};
use crate::error::{Result, SddError};
use crate::model::{
    Criterion, EvidenceKind, EvidenceRecord, SCHEMA_VERSION, State, Verdict, valid_identity,
};
use crate::repository::{SddRepository, atomic_write};
use crate::spec::{sha256_file, validate_relative_path};
use crate::workspace::workspace_hash;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EvidenceIndex {
    pub schema_version: u32,
    pub spec_id: String,
    pub spec_revision: u64,
    pub records: Vec<EvidenceRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceReport {
    pub valid: bool,
    pub current_records: usize,
    pub missing: Vec<String>,
}

pub struct EvidenceStore<'a> {
    repository: &'a SddRepository,
    state: &'a State,
    spec_id: &'a str,
}

impl<'a> EvidenceStore<'a> {
    pub fn current(repository: &'a SddRepository, state: &'a State) -> Result<Self> {
        let spec_id = state
            .current_spec
            .as_deref()
            .ok_or_else(|| SddError::InvalidState("no current spec is selected".into()))?;
        Ok(Self {
            repository,
            state,
            spec_id,
        })
    }

    pub fn evidence_dir(&self) -> Result<PathBuf> {
        Ok(self.repository.spec_dir(self.spec_id)?.join("evidence"))
    }

    pub fn index_path(&self) -> Result<PathBuf> {
        Ok(self.evidence_dir()?.join("index.json"))
    }

    pub fn load(&self) -> Result<EvidenceIndex> {
        let path = self.index_path()?;
        if !path.is_file() {
            return Ok(EvidenceIndex {
                schema_version: SCHEMA_VERSION,
                spec_id: self.spec_id.into(),
                spec_revision: self.state.spec_revision,
                records: Vec::new(),
            });
        }
        let bytes = fs::read(&path).map_err(|error| SddError::io(&path, error))?;
        let index: EvidenceIndex = serde_json::from_slice(&bytes)?;
        if index.schema_version != SCHEMA_VERSION || index.spec_id != self.spec_id {
            return Err(SddError::EvidenceGate(format!(
                "evidence index {} has the wrong protocol identity",
                path.display()
            )));
        }
        let mut ids = BTreeSet::new();
        for record in &index.records {
            self.validate_record_structure(record)?;
            if !ids.insert(record.id.as_str()) {
                return Err(SddError::EvidenceGate(format!(
                    "evidence index contains duplicate id '{}'",
                    record.id
                )));
            }
        }
        Ok(index)
    }

    pub fn add(&self, records: impl IntoIterator<Item = EvidenceRecord>) -> Result<EvidenceIndex> {
        let records: Vec<_> = records.into_iter().collect();
        self.repository.with_coherent_lock(|current| {
            if current.current_spec.as_deref() != Some(self.spec_id)
                || current.spec_revision != self.state.spec_revision
                || current.revision != self.state.revision
            {
                return Err(SddError::StaleRevision {
                    expected: self.state.revision,
                    actual: current.revision,
                });
            }
            let mut index = self.load()?;
            let mut ids: BTreeSet<String> = index
                .records
                .iter()
                .map(|record| record.id.clone())
                .collect();
            let current_workspace_hash = workspace_hash(self.repository.root())?;
            for record in records {
                self.validate_record(&record, &current_workspace_hash)?;
                if !ids.insert(record.id.clone()) {
                    return Err(SddError::EvidenceGate(format!(
                        "duplicate evidence id '{}'",
                        record.id
                    )));
                }
                index.records.push(record);
            }
            index.spec_revision = self.state.spec_revision;
            let path = self.index_path()?;
            let directory = self.evidence_dir()?;
            fs::create_dir_all(&directory).map_err(|error| SddError::io(&directory, error))?;
            atomic_write(&path, &serde_json::to_vec_pretty(&index)?)?;
            Ok(index)
        })
    }

    pub fn evaluate(
        &self,
        criteria: &[Criterion],
        policy: &EvidencePolicy,
    ) -> Result<EvidenceReport> {
        let index = self.load()?;
        let current_workspace_hash = workspace_hash(self.repository.root())?;
        let current: Vec<&EvidenceRecord> = index
            .records
            .iter()
            .filter(|record| {
                record.spec_revision == self.state.spec_revision
                    && record.workspace_hash == current_workspace_hash
                    && record.verdict == Verdict::Passed
            })
            .collect();
        let mut by_criterion: BTreeMap<&str, Vec<&EvidenceRecord>> = BTreeMap::new();
        for record in &current {
            for criterion in &record.criterion_ids {
                by_criterion.entry(criterion).or_default().push(record);
            }
        }
        let known: BTreeSet<&str> = criteria
            .iter()
            .map(|criterion| criterion.id.as_str())
            .collect();
        let mut missing = Vec::new();
        if current.is_empty()
            && index.records.iter().any(|record| {
                record.spec_revision == self.state.spec_revision
                    && record.verdict == Verdict::Passed
                    && record.workspace_hash != current_workspace_hash
            })
        {
            missing.push("passing evidence belongs to an older workspace snapshot".into());
        }

        for record in &current {
            for criterion in &record.criterion_ids {
                if !known.contains(criterion.as_str()) {
                    missing.push(format!(
                        "evidence {} references unknown criterion {}",
                        record.id, criterion
                    ));
                }
            }
        }

        for criterion in criteria {
            let records = by_criterion
                .get(criterion.id.as_str())
                .cloned()
                .unwrap_or_default();
            if policy.require_per_criterion
                && !records
                    .iter()
                    .any(|record| record.kind != EvidenceKind::CodeReview)
            {
                missing.push(format!("{} has no passing evidence", criterion.id));
            }
            if criterion.ui {
                if matches!(
                    policy.browser,
                    BrowserRequirement::RequiredForUi | BrowserRequirement::Required
                ) && !records
                    .iter()
                    .any(|record| record.kind == EvidenceKind::BrowserAssertion)
                {
                    missing.push(format!("{} has no passing browser assertion", criterion.id));
                }
                if policy.screenshots_for_ui
                    && !records.iter().any(|record| {
                        record.kind == EvidenceKind::ScreenshotReview
                            && record.artifact_path.is_some()
                            && record.artifact_hash.is_some()
                    })
                {
                    missing.push(format!("{} has no screenshot evidence", criterion.id));
                }
                if policy.screenshot_review_for_ui
                    && !records.iter().any(|record| {
                        record.kind == EvidenceKind::ScreenshotReview
                            && record
                                .reviewer
                                .as_deref()
                                .is_some_and(|value| !value.is_empty())
                    })
                {
                    missing.push(format!("{} screenshot has no agent review", criterion.id));
                }
            }
        }

        if policy.tests
            && !current.iter().any(|record| {
                record.kind == EvidenceKind::Test
                    && record.exit_code == Some(0)
                    && record.output_hash.is_some()
            })
        {
            missing.push("no passing test evidence with output hash".into());
        }

        if policy.code_review {
            let reviews: Vec<_> = current
                .iter()
                .filter(|record| record.kind == EvidenceKind::CodeReview)
                .collect();
            if reviews.is_empty() {
                missing.push("no passing code review evidence".into());
            } else if policy.independent_code_review {
                if let Some(implementation_actor) = self.state.implementation_actor.as_deref() {
                    if !reviews.iter().any(|record| {
                        record.producer != implementation_actor
                            && record.reviewer.as_deref() != Some(implementation_actor)
                    }) {
                        missing.push(format!(
                            "code review is not independent from implementation actor {implementation_actor}"
                        ));
                    }
                }
            }
        }

        if policy.browser == BrowserRequirement::Required
            && !current
                .iter()
                .any(|record| record.kind == EvidenceKind::BrowserAssertion)
        {
            missing.push("browser evidence is required for this repository".into());
        }

        missing.sort();
        missing.dedup();
        Ok(EvidenceReport {
            valid: missing.is_empty(),
            current_records: current.len(),
            missing,
        })
    }

    fn validate_record(&self, record: &EvidenceRecord, current_workspace_hash: &str) -> Result<()> {
        self.validate_record_structure(record)?;
        if record.spec_revision != self.state.spec_revision {
            return Err(SddError::EvidenceGate(format!(
                "evidence {} is not bound to the current spec revision",
                record.id
            )));
        }
        if record.workspace_hash != current_workspace_hash {
            return Err(SddError::EvidenceGate(format!(
                "evidence {} is not bound to the current workspace snapshot",
                record.id
            )));
        }
        Ok(())
    }

    fn validate_record_structure(&self, record: &EvidenceRecord) -> Result<()> {
        if record.schema_version != SCHEMA_VERSION {
            return Err(SddError::EvidenceGate(format!(
                "evidence {} uses unsupported schema {}",
                record.id, record.schema_version
            )));
        }
        if record.spec_id != self.spec_id || record.spec_revision == 0 {
            return Err(SddError::EvidenceGate(format!(
                "evidence {} has the wrong spec identity or revision",
                record.id
            )));
        }
        validate_sha256(&record.workspace_hash, "workspaceHash")?;
        if record.id.trim().is_empty()
            || record.id.trim() != record.id
            || record.id.len() > 256
            || record.id.chars().any(char::is_control)
            || !valid_identity(&record.producer)
            || record
                .reviewer
                .as_deref()
                .is_some_and(|reviewer| !valid_identity(reviewer))
            || record.summary.trim().is_empty()
        {
            return Err(SddError::EvidenceGate(
                "evidence id/summary must not be blank and identities must be trimmed, bounded, and control-free".into(),
            ));
        }
        OffsetDateTime::parse(&record.created_at, &Rfc3339).map_err(|_| {
            SddError::EvidenceGate(format!(
                "evidence {} has an invalid RFC 3339 timestamp",
                record.id
            ))
        })?;
        let unique_criteria: BTreeSet<_> = record.criterion_ids.iter().collect();
        if unique_criteria.len() != record.criterion_ids.len() {
            return Err(SddError::EvidenceGate(format!(
                "evidence {} repeats a criterion id",
                record.id
            )));
        }
        if record.criterion_ids.is_empty() && record.kind != EvidenceKind::CodeReview {
            return Err(SddError::EvidenceGate(format!(
                "evidence {} must name at least one criterion",
                record.id
            )));
        }
        if record.kind == EvidenceKind::Test {
            if record.command.as_ref().is_none_or(Vec::is_empty)
                || record.exit_code.is_none()
                || record.output_hash.is_none()
            {
                return Err(SddError::EvidenceGate(format!(
                    "test evidence {} must include command, exitCode, and outputHash",
                    record.id
                )));
            }
            validate_sha256(
                record.output_hash.as_deref().unwrap_or_default(),
                "outputHash",
            )?;
        }
        if let Some(relative) = record.artifact_path.as_deref() {
            validate_relative_path(relative)?;
            let required_prefix = format!("ai/specs/{}/evidence/", self.spec_id);
            if !relative.starts_with(&required_prefix) {
                return Err(SddError::EvidenceGate(format!(
                    "evidence artifact must live below {required_prefix}"
                )));
            }
            let path = self.repository.root().join(relative);
            let canonical = path
                .canonicalize()
                .map_err(|error| SddError::io(&path, error))?;
            if !canonical.starts_with(self.repository.root()) || !canonical.is_file() {
                return Err(SddError::EvidenceGate(format!(
                    "evidence artifact is not a contained regular file: {relative}"
                )));
            }
            let expected = record.artifact_hash.as_deref().ok_or_else(|| {
                SddError::EvidenceGate(format!(
                    "evidence {} has an artifact without an artifactHash",
                    record.id
                ))
            })?;
            validate_sha256(expected, "artifactHash")?;
            let actual = sha256_file(&canonical)?;
            if expected != actual {
                return Err(SddError::EvidenceGate(format!(
                    "evidence artifact hash mismatch for {relative}"
                )));
            }
        } else if record.artifact_hash.is_some() {
            return Err(SddError::EvidenceGate(format!(
                "evidence {} has artifactHash without artifactPath",
                record.id
            )));
        }
        Ok(())
    }
}

fn validate_sha256(value: &str, field: &str) -> Result<()> {
    let Some(hex) = value.strip_prefix("sha256:") else {
        return Err(SddError::EvidenceGate(format!(
            "{field} must use the sha256:<hex> form"
        )));
    };
    if hex.len() != 64 || !hex.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(SddError::EvidenceGate(format!(
            "{field} must contain a 64-character SHA-256 digest"
        )));
    }
    Ok(())
}

pub fn copy_evidence_artifact(
    repository: &SddRepository,
    state: &State,
    source: &Path,
    name: &str,
) -> Result<(String, String)> {
    if source.is_symlink() || !source.is_file() {
        return Err(SddError::EvidenceGate(format!(
            "evidence source must be a regular non-symlink file: {}",
            source.display()
        )));
    }
    validate_relative_path(name)?;
    if name.contains('/') || name.contains('\\') {
        return Err(SddError::EvidenceGate(
            "evidence artifact name must be a single file name".into(),
        ));
    }
    repository.with_coherent_lock(|current| {
        if current.revision != state.revision
            || current.spec_revision != state.spec_revision
            || current.current_spec != state.current_spec
        {
            return Err(SddError::StaleRevision {
                expected: state.revision,
                actual: current.revision,
            });
        }
        let spec_id = state
            .current_spec
            .as_deref()
            .ok_or_else(|| SddError::InvalidState("no current spec is selected".into()))?;
        let expected_directory = repository.spec_dir(spec_id)?.join("evidence");
        fs::create_dir_all(&expected_directory)
            .map_err(|error| SddError::io(&expected_directory, error))?;
        let directory = expected_directory
            .canonicalize()
            .map_err(|error| SddError::io(&expected_directory, error))?;
        if directory != expected_directory
            || !directory.starts_with(repository.root())
            || !directory.is_dir()
        {
            return Err(SddError::EvidenceGate(format!(
                "evidence directory escaped repository: {}",
                directory.display()
            )));
        }
        let destination = directory.join(name);
        let mut input = File::open(source).map_err(|error| SddError::io(source, error))?;
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&destination)
            .map_err(|error| {
                if error.kind() == io::ErrorKind::AlreadyExists {
                    SddError::EvidenceGate(format!(
                        "evidence artifact already exists: {}",
                        destination.display()
                    ))
                } else {
                    SddError::io(&destination, error)
                }
            })?;
        if let Err(error) = io::copy(&mut input, &mut output) {
            drop(output);
            let _ = fs::remove_file(&destination);
            return Err(SddError::io(&destination, error));
        }
        output
            .sync_all()
            .map_err(|error| SddError::io(&destination, error))?;
        let relative = destination
            .strip_prefix(repository.root())
            .map_err(|_| SddError::EvidenceGate("evidence destination escaped repository".into()))?
            .to_string_lossy()
            .replace('\\', "/");
        let hash = sha256_file(&destination)?;
        Ok((relative, hash))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;
    use crate::legacy::render_state;
    use crate::model::{ControlMode, PROTOCOL, Phase, Profile, WorkflowStatus};
    use crate::repository::now;

    fn repository_fixture() -> (tempfile::TempDir, SddRepository, State) {
        let directory = tempfile::tempdir().unwrap();
        fs::create_dir_all(directory.path().join("ai/specs/001-ui/evidence")).unwrap();
        fs::write(
            directory.path().join("ai/STATE.md"),
            "# State\ncurrent_spec: 001-ui\ncurrent_phase: test\n",
        )
        .unwrap();
        fs::write(
            directory.path().join("ai/specs/001-ui/spec.md"),
            "## Acceptance Criteria\n- [ ] [AC-UI] [UI] Page displays saved value\n",
        )
        .unwrap();
        let repository = SddRepository::from_root(directory.path()).unwrap();
        repository.write_config(&Config::default()).unwrap();
        let state = State {
            protocol: PROTOCOL.into(),
            schema_version: SCHEMA_VERSION,
            revision: 1,
            project_id: "PRJ-test".into(),
            current_spec: Some("001-ui".into()),
            profile: Profile::Quick,
            mode: ControlMode::Autonomous,
            phase: Phase::Verify,
            status: WorkflowStatus::Waiting,
            repair_attempts: 0,
            spec_revision: 1,
            spec_hash: None,
            last_event: Some("EVT-fixture".into()),
            implementation_actor: Some("builder".into()),
            message: None,
        };
        fs::write(repository.state_path(), render_state(&state, None)).unwrap();
        (directory, repository, state)
    }

    fn record(
        workspace_hash: &str,
        kind: EvidenceKind,
        criterion_ids: &[&str],
        producer: &str,
    ) -> EvidenceRecord {
        EvidenceRecord {
            schema_version: SCHEMA_VERSION,
            id: format!("EV-{}", ulid::Ulid::new()),
            spec_id: "001-ui".into(),
            spec_revision: 1,
            workspace_hash: workspace_hash.into(),
            criterion_ids: criterion_ids.iter().map(|value| (*value).into()).collect(),
            kind,
            verdict: Verdict::Passed,
            producer: producer.into(),
            reviewer: None,
            summary: "passed".into(),
            command: None,
            exit_code: None,
            output_hash: None,
            artifact_path: None,
            artifact_hash: None,
            created_at: now().unwrap(),
            metadata: BTreeMap::new(),
        }
    }

    #[test]
    fn ui_cannot_pass_with_only_a_test() {
        let (_directory, repository, state) = repository_fixture();
        let store = EvidenceStore::current(&repository, &state).unwrap();
        let workspace = workspace_hash(repository.root()).unwrap();
        let mut test = record(&workspace, EvidenceKind::Test, &["AC-UI"], "builder");
        test.command = Some(vec!["test-runner".into()]);
        test.exit_code = Some(0);
        test.output_hash = Some(format!("sha256:{}", "0".repeat(64)));
        store.add([test]).unwrap();
        let criteria = repository.current_criteria(&state).unwrap();
        let report = store
            .evaluate(&criteria, &EvidencePolicy::default())
            .unwrap();
        assert!(!report.valid);
        assert!(
            report
                .missing
                .iter()
                .any(|item| item.contains("browser assertion"))
        );
        assert!(
            report
                .missing
                .iter()
                .any(|item| item.contains("screenshot"))
        );
        assert!(
            report
                .missing
                .iter()
                .any(|item| item.contains("code review"))
        );
    }

    #[test]
    fn complete_ui_evidence_passes_and_review_is_independent() {
        let (directory, repository, state) = repository_fixture();
        let screenshot = directory.path().join("capture.png");
        fs::write(&screenshot, b"not-a-real-png-but-portable-test-bytes").unwrap();
        let (path, hash) =
            copy_evidence_artifact(&repository, &state, &screenshot, "AC-UI-capture.png").unwrap();
        let store = EvidenceStore::current(&repository, &state).unwrap();
        let workspace = workspace_hash(repository.root()).unwrap();
        let mut test = record(&workspace, EvidenceKind::Test, &["AC-UI"], "builder");
        test.command = Some(vec!["test-runner".into()]);
        test.exit_code = Some(0);
        test.output_hash = Some(format!("sha256:{}", "0".repeat(64)));
        let browser = record(
            &workspace,
            EvidenceKind::BrowserAssertion,
            &["AC-UI"],
            "browser",
        );
        let mut screenshot_review = record(
            &workspace,
            EvidenceKind::ScreenshotReview,
            &["AC-UI"],
            "visual-reviewer",
        );
        screenshot_review.reviewer = Some("visual-reviewer".into());
        screenshot_review.artifact_path = Some(path.clone());
        screenshot_review.artifact_hash = Some(hash.clone());
        let mut review = record(&workspace, EvidenceKind::CodeReview, &[], "reviewer");
        review.reviewer = Some("reviewer".into());
        store
            .add([test, browser, screenshot_review, review])
            .unwrap();
        let criteria = repository.current_criteria(&state).unwrap();
        let report = store
            .evaluate(&criteria, &EvidencePolicy::default())
            .unwrap();
        assert!(report.valid, "{:?}", report.missing);

        fs::write(&screenshot, b"source changed after verification").unwrap();
        let stale = store
            .evaluate(&criteria, &EvidencePolicy::default())
            .unwrap();
        assert!(!stale.valid, "source edits must invalidate prior evidence");

        let refreshed_workspace = workspace_hash(repository.root()).unwrap();
        let mut refreshed_test = record(
            &refreshed_workspace,
            EvidenceKind::Test,
            &["AC-UI"],
            "builder",
        );
        refreshed_test.command = Some(vec!["test-runner".into()]);
        refreshed_test.exit_code = Some(0);
        refreshed_test.output_hash = Some(format!("sha256:{}", "1".repeat(64)));
        let refreshed_browser = record(
            &refreshed_workspace,
            EvidenceKind::BrowserAssertion,
            &["AC-UI"],
            "browser",
        );
        let mut refreshed_screenshot = record(
            &refreshed_workspace,
            EvidenceKind::ScreenshotReview,
            &["AC-UI"],
            "visual-reviewer",
        );
        refreshed_screenshot.reviewer = Some("visual-reviewer".into());
        refreshed_screenshot.artifact_path = Some(path);
        refreshed_screenshot.artifact_hash = Some(hash);
        let mut refreshed_review = record(
            &refreshed_workspace,
            EvidenceKind::CodeReview,
            &[],
            "reviewer",
        );
        refreshed_review.reviewer = Some("reviewer".into());
        store
            .add([
                refreshed_test,
                refreshed_browser,
                refreshed_screenshot,
                refreshed_review,
            ])
            .unwrap();
        let refreshed = store
            .evaluate(&criteria, &EvidencePolicy::default())
            .unwrap();
        assert!(
            refreshed.valid,
            "fresh evidence must supersede retained history: {:?}",
            refreshed.missing
        );
    }

    #[test]
    fn tampered_artifact_invalidates_existing_evidence() {
        let (directory, repository, state) = repository_fixture();
        let screenshot = directory.path().join("capture.png");
        fs::write(&screenshot, b"original screenshot bytes").unwrap();
        let (path, hash) =
            copy_evidence_artifact(&repository, &state, &screenshot, "capture.png").unwrap();
        let store = EvidenceStore::current(&repository, &state).unwrap();
        let workspace = workspace_hash(repository.root()).unwrap();
        let mut review = record(
            &workspace,
            EvidenceKind::ScreenshotReview,
            &["AC-UI"],
            "visual-reviewer",
        );
        review.reviewer = Some("visual-reviewer".into());
        review.artifact_path = Some(path.clone());
        review.artifact_hash = Some(hash);
        store.add([review]).unwrap();

        fs::write(repository.root().join(path), b"tampered screenshot bytes").unwrap();

        assert!(matches!(
            store.load(),
            Err(SddError::EvidenceGate(message)) if message.contains("hash mismatch")
        ));
    }
}
