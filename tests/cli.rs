use std::fs;
use std::process::Command;

#[test]
fn cli_initializes_and_reports_product_neutral_health() {
    let directory = tempfile::tempdir().unwrap();
    let binary = env!("CARGO_BIN_EXE_empirical");

    let initialized = Command::new(binary)
        .args(["--root", directory.path().to_str().unwrap(), "init"])
        .output()
        .unwrap();
    assert!(
        initialized.status.success(),
        "{}",
        String::from_utf8_lossy(&initialized.stderr)
    );

    let health = Command::new(binary)
        .args([
            "--root",
            directory.path().to_str().unwrap(),
            "--json",
            "doctor",
        ])
        .output()
        .unwrap();
    assert!(
        health.status.success(),
        "{}",
        String::from_utf8_lossy(&health.stderr)
    );
    let value: serde_json::Value = serde_json::from_slice(&health.stdout).unwrap();
    assert_eq!(value["canonicalStore"], "filesystem");
    assert_eq!(value["externalDatabaseRequired"], false);
    assert_eq!(value["hostRuntimeRequired"], false);
    assert_eq!(value["ideRequired"], false);
}

#[test]
fn cli_status_does_not_mutate_a_v1_repository() {
    let directory = tempfile::tempdir().unwrap();
    fs::create_dir_all(directory.path().join("ai/specs/001-test")).unwrap();
    fs::write(
        directory.path().join("ai/STATE.md"),
        "current_spec: 001-test\ncurrent_phase: dev\n",
    )
    .unwrap();
    fs::write(
        directory.path().join("ai/specs/001-test/spec.md"),
        "## Acceptance Criteria\n- [ ] It works\n",
    )
    .unwrap();
    let before = fs::read(directory.path().join("ai/STATE.md")).unwrap();

    let status = Command::new(env!("CARGO_BIN_EXE_empirical"))
        .args([
            "--root",
            directory.path().to_str().unwrap(),
            "--json",
            "status",
        ])
        .output()
        .unwrap();
    assert!(
        status.status.success(),
        "{}",
        String::from_utf8_lossy(&status.stderr)
    );
    let value: serde_json::Value = serde_json::from_slice(&status.stdout).unwrap();
    assert_eq!(value["legacy"], true);
    assert_eq!(
        fs::read(directory.path().join("ai/STATE.md")).unwrap(),
        before
    );
    assert!(!directory.path().join("ai/empirical.toml").exists());
}
