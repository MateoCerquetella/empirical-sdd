# Plan: Release 0.22.0

## 1. Freeze scope and bump the release identity

- Snapshot branch, base commit, remote, npm, GitHub, and candidate file list.
- Confirm `0.22.0` is unused across local/remote tags, GitHub releases, and npm.
- Classify every `0.21` occurrence as a current release surface or historical
  record; update only current surfaces to `0.22.0`.
- Refresh bounded context after the version changes and confirm the manifest is
  current.
- Inspect the final diff for credentials, generated output, temporary files,
  unexplained paths, and whitespace errors.

Criteria: AC-1, AC-2

## 2. Validate the frozen candidate locally

- Run `bun run ci` with its typecheck, source suite, coverage, distribution
  smoke, clean packed consumer, and consistency gates.
- Run `npm pack --dry-run --json`; assert exact version and declared file
  allowlist.
- Build once more and assert exact captured `empirical --version`, lifecycle
  help ordering, Uninstall discovery, and absence of ANSI in captured output.
- Quarantine generated `coverage/` and `dist/` artifacts outside the checkout.
- Collect an immutable Implement receipt covering AC-1, AC-2, AC-5, and AC-6.

Criteria: AC-1, AC-2, AC-5, AC-6

## 3. Independently review and integrate

- Complete Implement at its exact revision with the local release receipt.
- Re-run full CI as independent Review evidence and inspect package/version
  surfaces and source scope.
- Complete Verify and Review with immutable receipts covering every locally
  provable criterion.
- Seed a disposable detached worktree with the candidate source overlay and the
  captured package-distribution base, then run Integrate Policy v2 CI.
- Promote the package-distribution delta and preserve the exact integration
  receipt; remove the detached worktree non-force and quarantine its artifacts.

Criteria: AC-1, AC-2, AC-5, AC-6, AC-7

## 4. Deliver through protected GitHub pull requests

- Record bounded standing authorization through `delivered` for this repository,
  feature, and `main` branch.
- Create/switch to `agent/release-0.22.0` from the inspected main base.
- Give Empirical delivery explicit source and evidence path allowlists, commit
  messages, PR titles, and review bodies.
- Let the delivery state machine commit, push, open the source PR, wait for all
  configured required checks, merge normally, bind the observed merge, create
  the evidence branch/PR, wait for the same checks, and merge normally.
- Verify the immutable delivery receipt and remote default-branch ancestry.

Criteria: AC-3, AC-7

## 5. Publish the exact immutable version

- Fast-forward/switch to the delivered evidence merge commit and rerun release
  CI/package inspection if the delivery tree changed.
- Construct and display the exact publication binding:
  `empirical-sdd@0.22.0`, `latest`, `v0.22.0`, and the evidence merge commit.
- Require exact publication authorization, then inspect existing remote/npm
  state and execute only missing non-conflicting actions.
- If npm lacks legitimate authority, stop at that boundary and preserve/report
  exact partial state; retry only the identical plan after authentication.
- Verify the publication receipt and all public artifact identities.

Criteria: AC-4, AC-6, AC-7

## 6. Verify public consumption and preserve final evidence

- Download/inspect public registry metadata and tarball contents/integrity.
- Install the exact registry version in a new temporary consumer; test version,
  public help including Uninstall, supported exports, and rejected internals.
- Verify `latest`, annotated tag target, GitHub release target and notes.
- Commit post-publication receipts/context in a focused final evidence PR if they
  were created after the protected delivery evidence merge; wait for checks and
  merge normally.
- Synchronize local `main`, quarantine temporary artifacts, run Doctor and
  `git diff --check`, and report exact implemented/verified/integrated/
  delivered/published completion levels.

Criteria: AC-3, AC-4, AC-5, AC-6, AC-7
