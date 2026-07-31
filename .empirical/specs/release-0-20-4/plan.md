# Plan: Release 0.20.4

## 1. Freeze and validate the release candidate

- Reconfirm that `main` equals `origin/main`, npm `latest` is `0.20.3`, and no
  `v0.20.4` local/remote tag or GitHub release exists.
- Inspect every modified/untracked path and classify the completed CLI-branding
  paths separately from `.empirical/specs/release-0-20-4/`.
- Run `git diff --check`, `bun run ci`, a version-surface scan, built version and
  captured-help checks, and `npm pack --dry-run --json`.
- Save concise command outputs under the release feature's evidence directory.

Criteria: AC-1, AC-2

## 2. Publish and merge the source pull request

- Create `agent/release-0.20.4` from current `main`.
- Stage only the completed CLI-branding code, tests, version/context updates,
  archived capability, and completed CLI-branding feature record; explicitly
  exclude `.empirical/specs/release-0-20-4/`.
- Commit as `chore: release 0.20.4`, push with tracking, and open a draft PR
  describing what, why, impact, and local validation.
- Verify the PR file list, mark it ready, wait for Ubuntu/macOS/Windows checks,
  and merge normally without bypassing protection.
- Switch to `main`, fast-forward, and record the merge SHA.

Criteria: AC-1

## 3. Bind and publish the immutable release

- Rerun `bun run ci`, exact version checks, and package inspection from the
  merged `main` source.
- Create annotated tag `v0.20.4` at the merge SHA and verify its peeled commit
  before pushing the exact tag to `origin`.
- Publish with `npm publish --access public --tag latest` from that source.
- Query npm until the exact version and `latest` dist-tag resolve to `0.20.4`.
- Create a GitHub release for the existing verified tag with explicit release
  notes, then verify it is published and neither draft nor prerelease.

Criteria: AC-2, AC-3, AC-4

## 4. Verify as a public consumer

- Download/inspect the registry tarball metadata and file list; compare its
  version and integrity metadata to npm's public metadata.
- In a new temporary directory, initialize a consumer and install the exact
  `empirical-sdd@0.20.4` version from npm.
- Invoke the installed binary for `--version` and captured `help`; assert exact
  version output, visible branding before lifecycle help, public command surface,
  and absence of ANSI escapes.
- Confirm the remote tag peels to the source merge SHA and the GitHub release
  references the same tag.

Criteria: AC-3, AC-4, AC-5

## 5. Preserve release evidence and synchronize

- Complete Empirical implement, verify, and review revisions with criterion-level
  evidence, then archive the package-distribution delta.
- Refresh bounded repository context if archival changes it.
- Create `agent/release-0.20.4-evidence`, commit only the final release workflow,
  archived capability/context updates, and evidence artifacts.
- Push, open a focused evidence PR, run required checks, merge, switch to `main`,
  fast-forward, and confirm a clean synchronized worktree.
- Requery npm and GitHub once more after the evidence merge.

Criteria: AC-6
