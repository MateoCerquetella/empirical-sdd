use std::collections::{BTreeMap, BTreeSet};
use std::fs;

use empirical_sdd::{
    Capability, Config, EvidenceKind, EvidenceRecord, LoopEngine, Phase, PhaseAdapter,
    PhaseContext, PhaseOutcome, PhaseResult, Profile, Result, RunStop, SddError, SddRepository,
    Verdict, workspace_hash,
};
use tempfile::TempDir;

struct ExternalClient;

impl PhaseAdapter for ExternalClient {
    fn supports(&self, _phase: Phase) -> bool {
        false
    }

    fn capabilities(&self, _phase: Phase) -> Result<BTreeSet<Capability>> {
        Ok(BTreeSet::new())
    }

    fn execute(&mut self, _context: &PhaseContext) -> Result<PhaseResult> {
        Err(SddError::Adapter("not used by external check-in".into()))
    }
}

fn v1_fixture(profile: Profile) -> (TempDir, SddRepository) {
    let directory = tempfile::tempdir().unwrap();
    fs::create_dir_all(directory.path().join("ai/specs/001-portable")).unwrap();
    fs::write(
        directory.path().join("ai/STATE.md"),
        "# State\n\n```text\ncurrent_spec: 001-portable\ncurrent_role: pm\ncurrent_phase: pm\nmode: autonomous\n```\n\n## Decisions\n\n- Preserve this.\n",
    )
    .unwrap();
    fs::write(
        directory.path().join("ai/specs/001-portable/spec.md"),
        "# Portable feature\n\n## Acceptance Criteria\n\n- [ ] [AC-1] Command returns the requested value\n",
    )
    .unwrap();
    let repository = SddRepository::from_root(directory.path()).unwrap();
    if profile == Profile::Quick {
        let config = Config {
            profile: Profile::Quick,
            ..Default::default()
        };
        repository.write_config(&config).unwrap();
    }
    (directory, repository)
}

fn passed(actor: &str, evidence: Vec<EvidenceRecord>) -> PhaseResult {
    PhaseResult {
        schema_version: 2,
        outcome: PhaseOutcome::Passed,
        actor: actor.into(),
        summary: "phase passed".into(),
        evidence,
        artifacts: Vec::new(),
    }
}

fn evidence(
    workspace_hash: &str,
    kind: EvidenceKind,
    producer: &str,
    criterion_ids: &[&str],
) -> EvidenceRecord {
    EvidenceRecord {
        schema_version: 2,
        id: format!("EV-{}", ulid::Ulid::new()),
        spec_id: "001-portable".into(),
        spec_revision: 1,
        workspace_hash: workspace_hash.into(),
        criterion_ids: criterion_ids.iter().map(|value| (*value).into()).collect(),
        kind,
        verdict: Verdict::Passed,
        producer: producer.into(),
        reviewer: (kind == EvidenceKind::CodeReview).then(|| producer.into()),
        summary: "observable behavior passed".into(),
        command: None,
        exit_code: None,
        output_hash: None,
        artifact_path: None,
        artifact_hash: None,
        created_at: "2026-07-28T12:00:00Z".into(),
        metadata: BTreeMap::new(),
    }
}

fn check_in_from_new_client(root: &std::path::Path, result: PhaseResult) -> RunStop {
    let repository = SddRepository::discover(root.join("ai/specs/001-portable")).unwrap();
    let expected = repository.load_state().unwrap().state.revision;
    let mut client = ExternalClient;
    LoopEngine::new(&repository, &mut client, "client-b")
        .check_in(expected, result)
        .unwrap()
}

#[test]
fn unchanged_v1_is_read_only_then_adopts_without_renaming() {
    let (directory, repository) = v1_fixture(Profile::Strong);
    let state_path = directory.path().join("ai/STATE.md");
    let before = fs::read(&state_path).unwrap();

    let snapshot = SddRepository::discover(directory.path().join("ai/context"))
        .unwrap()
        .snapshot()
        .unwrap();
    assert!(snapshot.legacy);
    assert_eq!(fs::read(&state_path).unwrap(), before);

    let adopted = repository.adopt(None, "migration-client").unwrap();
    assert_eq!(adopted.profile, Profile::Strong);
    assert!(
        directory
            .path()
            .join("ai/specs/001-portable/spec.md")
            .is_file()
    );
    let rendered = fs::read_to_string(&state_path).unwrap();
    assert!(rendered.contains("Preserved pre-v2 state"));
    assert!(rendered.contains("Preserve this"));
}

#[test]
fn quick_feature_finishes_across_fresh_clients_with_evidence_and_review() {
    let (directory, repository) = v1_fixture(Profile::Quick);
    let adopted = repository.adopt(Some(Profile::Quick), "client-a").unwrap();
    assert_eq!(adopted.phase, Phase::Shape);

    assert!(matches!(
        check_in_from_new_client(directory.path(), passed("shaper", Vec::new())),
        RunStop::Paused { .. }
    ));
    assert!(matches!(
        check_in_from_new_client(directory.path(), passed("builder", Vec::new())),
        RunStop::Paused { .. }
    ));

    let workspace = workspace_hash(directory.path()).unwrap();
    let mut test = evidence(&workspace, EvidenceKind::Test, "tester", &["AC-1"]);
    test.command = Some(vec!["project-test".into(), "--focused".into()]);
    test.exit_code = Some(0);
    test.output_hash = Some(format!("sha256:{}", "0".repeat(64)));
    assert!(matches!(
        check_in_from_new_client(directory.path(), passed("tester", vec![test])),
        RunStop::Paused { .. }
    ));

    let review = evidence(
        &workspace,
        EvidenceKind::CodeReview,
        "independent-reviewer",
        &[],
    );
    let stopped = check_in_from_new_client(
        directory.path(),
        passed("independent-reviewer", vec![review]),
    );
    assert!(matches!(stopped, RunStop::Done { .. }));

    let final_state = SddRepository::discover(directory.path())
        .unwrap()
        .load_state()
        .unwrap()
        .state;
    assert_eq!(final_state.phase, Phase::Done);
    assert_eq!(final_state.implementation_actor.as_deref(), Some("builder"));
}

#[test]
fn shaping_can_refine_the_spec_without_restarting_the_loop() {
    let (directory, repository) = v1_fixture(Profile::Quick);
    let adopted = repository.adopt(Some(Profile::Quick), "client-a").unwrap();
    let spec_path = directory.path().join("ai/specs/001-portable/spec.md");
    fs::write(
        &spec_path,
        "# Portable feature\n\n## Acceptance Criteria\n\n- [ ] [AC-1] Command returns the requested value\n- [ ] [AC-2] Errors are reported clearly\n",
    )
    .unwrap();
    let mut client = ExternalClient;
    let stopped = LoopEngine::new(&repository, &mut client, "client-a")
        .check_in(adopted.revision, passed("shaper", Vec::new()))
        .unwrap();
    let RunStop::Paused { state } = stopped else {
        panic!("shape did not advance");
    };
    assert_eq!(state.phase, Phase::Implement);
    assert_eq!(state.spec_revision, adopted.spec_revision + 1);
    let synchronized = repository.synchronize_spec_revision("client-b").unwrap();
    assert_eq!(synchronized.phase, Phase::Implement);
    assert_eq!(synchronized.revision, state.revision);
}

#[test]
fn another_client_recovers_even_when_state_projection_and_local_cache_are_deleted() {
    let (directory, repository) = v1_fixture(Profile::Quick);
    let adopted = repository.adopt(Some(Profile::Quick), "client-a").unwrap();
    let advanced = repository
        .transition(
            adopted.revision,
            empirical_sdd::EventKind::PhaseStarted,
            "client-a",
            "claimed shape",
            |state, _| {
                state.status = empirical_sdd::WorkflowStatus::Running;
                Ok(())
            },
        )
        .unwrap();

    fs::write(directory.path().join("client-cache.sqlite"), b"disposable").unwrap();
    fs::remove_file(directory.path().join("client-cache.sqlite")).unwrap();
    fs::remove_file(directory.path().join("ai/STATE.md")).unwrap();

    let other_client = SddRepository::discover(directory.path().join("ai/events")).unwrap();
    let recovered = other_client.recover().unwrap();
    assert_eq!(recovered, advanced);
    assert_eq!(other_client.load_state().unwrap().state, advanced);
    assert!(!directory.path().join(".empirical").exists());
}

#[test]
fn reference_runtime_has_no_sqlite_dependency() {
    let manifest = include_str!("../Cargo.toml").to_ascii_lowercase();
    assert!(!manifest.contains("sqlite"));
    assert!(!manifest.contains("rusqlite"));
}
