# Add Safe Empirical Uninstall

## Request

> Add a safe public empirical uninstall command that confirms destructive intent, removes every Empirical-managed global agent skill and owned selection metadata while preserving unmanaged or unsafe files, uninstalls the global empirical-sdd npm package last, works outside a repository with human and JSON reports, leaves project .empirical history and repository MCP configuration untouched, and documents the exact behavior difference from the current install/update-only version.

## Goal

A developer can remove the globally installed Empirical runtime and every
Empirical-owned global agent skill through one explicit, auditable command
without deleting repository history or user-owned configuration.

## Acceptance Criteria

- [ ] [AC-1] Public root and subcommand help expose `empirical uninstall`
  alongside Install and Update, while private workflow commands remain rejected.
- [ ] [AC-2] Interactive uninstall displays the exact removed and preserved
  scopes and defaults to cancellation; non-interactive or JSON execution refuses
  mutation unless `--yes` is present.
- [ ] [AC-3] Confirmed uninstall scans every unique global skill root, removes
  only current or obsolete marker-owned Empirical skills and valid owned
  selection metadata, preserves unmanaged, malformed, non-file, or symlinked
  targets, reports every outcome, and converges safely when repeated.
- [ ] [AC-4] After managed integration cleanup succeeds, uninstall invokes the
  platform npm executable with the exact argv `uninstall -g empirical-sdd`,
  reports package-stage failure distinctly, and works outside a repository with
  both human and structured output.
- [ ] [AC-5] Uninstall never removes project `.empirical` history or repository
  MCP/agent configuration and both confirmation and completion output say that
  those project artifacts remain preserved.
- [ ] [AC-6] Unit, CLI, bundled-distribution, clean-package, consistency, and
  full coverage gates pass, and documentation compares the prior
  Install/Update-only surface with the new uninstall behavior.

## Scope

- One new public `empirical uninstall` command with `--yes`, `-y`, `--json`,
  and `--help` behavior.
- Safe global skill and owned selection-metadata removal.
- Global npm package removal after integration cleanup.
- Human, JSON, README, demo, and packaged-smoke coverage.

## Non-goals

- Deleting `.empirical` specifications, evidence, migrations, or context.
- Finding or editing initialized repositories elsewhere on disk.
- Removing repository-local MCP entries, agent settings, branches, worktrees,
  commits, tags, releases, or published packages.
- Removing unmanaged files merely because their names resemble Empirical.

## Risks

- Self-removal can strand partially completed cleanup if npm fails, so npm runs
  last and stage-specific errors explain the retry.
- Catalog aliases may share a skill root, so removal operates once per unique
  normalized destination.
- A hostile filesystem can redirect deletion, so existing containment,
  regular-file, managed-marker, and symlink-ancestor checks remain mandatory.

## Verification

- Exercise cancel, missing confirmation, JSON confirmation, help, unknown
  arguments, success, npm failure, and outside-repository execution.
- Seed shared roots with all six managed skills, obsolete managed skills,
  unmanaged collisions, unsafe links, and valid/invalid metadata; snapshot
  project artifacts and assert only owned global targets change.
- Verify exact lifecycle argv and ordering through an injected process runner.
- Build the package, smoke the bundled CLI, install it in a clean consumer, and
  run complete CI under fresh Verify and Review receipts.

## Capability Deltas

- `agent-integrations`: safe global removal lifecycle and public discovery.
