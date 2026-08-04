# Fix The 0 22 0 Windows Release Gate By Making

## Request

> Fix the 0.22.0 Windows release gate by making capability base/replay hashing newline-stable, returning portable migration receipt paths, and making cross-platform symlink/worktree assertions robust without weakening safety.

## Goal

Make the 0.22.0 release candidate behave identically on Windows, macOS, and
Linux when Git or the operating system presents equivalent paths and Markdown
with platform-specific spelling or line endings.

## Acceptance Criteria

- [ ] [AC-1] Capability base capture and replay treat LF and CRLF forms of the
  same requirement as equivalent, while still rejecting a real requirement
  change.
- [ ] [AC-2] Schema migration reports the receipt as the portable repository
  path `.empirical/migrations/schema-4-to-5.json` on every supported platform.
- [ ] [AC-3] Symlink refusal and stale-worktree diagnostics remain covered
  without tests depending on Windows short-path, separator, or symlink-removal
  quirks.
- [ ] [AC-4] The focused regression tests pass locally and the GitHub Actions
  matrix passes on Node 22, 24, and 26 on Linux plus Node 24 on macOS and
  Windows.

## Scope

- Canonical newline hashing for capability snapshots and replay checks.
- Portable migration receipt paths.
- Cross-platform cleanup and assertions in the affected tests.
- Exact release-branch validation and repush to PR #10.

## Non-goals

- Changing semantic conflict detection or weakening symlink/path safety.
- Changing the public install, update, or uninstall contract.
- Merging the pull request, creating a tag or GitHub release, or publishing to
  npm without separate authorization and credentials.

## Verification

- Run focused capability, coordination, migration, core, and Doctor tests.
- Run the repository check, coverage, distribution, package, and consistency
  release gates.
- Observe every required GitHub Actions matrix job pass for the pushed commit.

## Capability Deltas

- `deltas/living-specifications.md`
- `deltas/migration-integrity.md`
