# Design: Safe Empirical Uninstall

Add `uninstallGlobalAgentSkills(home)` beside the existing global installer.
It resolves and validates the home once, snapshots remembered or discovered
managed target ids for reporting, groups all catalog targets by normalized
skill root, and applies the existing containment, symlink-ancestor,
regular-file, and managed-marker checks to every current and obsolete Empirical
skill. It removes valid owner-stamped selection metadata separately and prunes
only directories made empty by those exact removals. It never accepts a project
root and never inspects project MCP or `.empirical` paths.

The public CLI admits exactly one additional command. `empirical uninstall
--help` is read-only. A normal invocation prints a fixed scope statement before
asking `Remove Empirical? [y/N]`; blank, EOF, and every answer except `y` or
`yes` cancel without mutation. `--json` and non-terminal execution require
`--yes`/`-y` before filesystem inspection or npm execution.

After confirmation, the CLI awaits global skill cleanup and then calls a small
package-lifecycle function. That function uses `spawnSync` with `shell: false`
through the existing injectable runner and invokes the platform npm executable
with exactly `uninstall -g empirical-sdd`. The package step runs last so a
cleanup error leaves the CLI installed for safe retry. If npm fails after skill
cleanup, its distinct error states that managed skills may already be removed.

Human output shows removed and preserved paths, confirms package removal, and
repeats that project histories and repository integrations remain. JSON output
contains the same integration report plus explicit package and preservation
fields. Documentation includes a previous-versus-new command-surface table.

Verification combines direct ownership-bound filesystem fixtures, injected
lifecycle ordering/argv tests, public CLI confirmation and fake-npm tests,
bundled help smoke, clean-package consumption, full coverage, and detached
integration replay.
