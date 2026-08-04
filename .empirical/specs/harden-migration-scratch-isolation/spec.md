# Harden Migration Scratch Isolation

## Request

> Harden Schema-5 migration scratch isolation: remove staged candidates after transform or validation failure, exclude .empirical migration scratch from knowledge fingerprints, evidence tree digests, and independent source overlays, report orphan scratch read-only in Doctor, and prove the boundaries with regression tests.

## Goal

Migration scratch is never mistaken for product source, failed pre-promotion
migrations leave no orphan candidate, and any pre-existing orphan is diagnosed
without Doctor deleting or changing it.

## Acceptance Criteria

- [ ] [AC-1] A Schema-4 migration whose candidate transform or validation fails leaves the Schema-4 source unchanged and removes its unpromoted stage without creating a migration marker or backup.
- [ ] [AC-2] Repository knowledge fingerprints and immutable evidence tree digests ignore reserved top-level `.empirical.schema5-*` migration scratch while still changing for ordinary source files.
- [ ] [AC-3] Independent integration overlays never copy reserved migration scratch into the target and still restore every applied source path after validation.
- [ ] [AC-4] Doctor reports an orphan migration stage or backup with actionable remediation and proves read-only behavior by leaving its bytes and Git state unchanged.
- [ ] [AC-5] Focused migration, evidence, knowledge, Doctor, and living-spec integration regressions plus the complete CI/coverage/package gates pass.

## Scope

- Pre-marker migration candidate cleanup.
- A reserved scratch-prefix predicate at knowledge, evidence, overlay, and Doctor
  boundaries.
- Regression coverage for the real failed-migration shape discovered during
  integration cleanup.

## Non-goals

- Automatically deleting orphan scratch discovered by Doctor.
- Changing migration promotion, recovery, or rollback semantics after a durable
  marker exists.
- Pruning user worktrees or touching delivery/publication state.

## Verification

- Invalidate candidate transformation before marker creation and assert no
  stage, backup, or marker remains.
- Compare knowledge and tree digests before and after scratch and ordinary source
  creation.
- Integrate from a source containing reserved scratch and assert the target never
  receives it.
- Snapshot an orphan scratch directory around Doctor.
- Run `bun run ci` under immutable Verify and Review receipts, then validate in
  an independent detached worktree.

## Capability Deltas

- `migration-integrity`: failed-stage cleanup and read-only orphan diagnosis.
- `repository-knowledge`: reserved scratch exclusion from fingerprints.
- `verification-policy`: reserved scratch exclusion from evidence tree digests.
- `worktree-isolation`: reserved scratch exclusion from integration overlays.
