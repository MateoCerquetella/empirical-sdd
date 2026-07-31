# Add GoEmpirical Branding To The CLI

## Request

> Add the GoEmpirical logo and current Empirical version to the human-facing CLI, modeled on the Hermes CLI presentation referenced by the user, while preserving machine-readable CLI behavior; publish this work as the next patch version.

## Goal

Give the public Empirical CLI a recognizable startup identity modeled on
Hermes: a terminal-safe rendering of GoEmpirical's official three-color mark,
the Empirical wordmark, and the exact running product version. Prepare the
package as version `0.20.4` without contaminating automation-oriented output.

## Acceptance Criteria

- [ ] [AC-UI-1] [UI] Running `empirical`, `empirical help`, `empirical --help`,
  or `empirical -h` renders one startup banner containing a terminal-native
  GoEmpirical mark, the `empirical` wordmark, and `v0.20.4` before the existing
  lifecycle and agent-skill help.
- [ ] [AC-2] The banner is readable on narrow and wide terminals, uses the
  official red (`#F43737`), yellow (`#FFCD15`), and blue (`#4A5CFF`) mark colors
  only when color is supported, honors `NO_COLOR`, and emits no ANSI escapes
  when output is redirected.
- [ ] [AC-3] `empirical --version`, `empirical -v`, and `empirical version`
  continue to emit exactly `0.20.4` plus one newline, public `--json` output
  remains directly parseable JSON, and MCP/private automation stdout receives
  no banner.
- [ ] [AC-4] The npm manifest, runtime `PRODUCT_VERSION`, version assertions,
  built CLI smoke checks, and release-facing help all consistently identify
  the prepared package as `0.20.4`.
- [ ] [AC-5] Type checking, unit/integration tests, built-distribution smoke
  tests, npm package inspection, and `git diff --check` all pass.

## Scope

- Add a small, dependency-free CLI branding renderer derived from the official
  GoEmpirical symbol and wordmark.
- Show the branding on the public no-command/help entrypoints with responsive,
  color-safe rendering.
- Update focused and distribution-level regression coverage.
- Advance repository-owned version surfaces from `0.20.3` to `0.20.4`.

## Non-goals

- Copying Hermes artwork, its caduceus, Rich-based panel implementation,
  theming/skins, update checker, or full-screen TUI.
- Adding banners to JSON, MCP, private agent transport, errors, or the exact
  version command.
- Redesigning the installer selector or changing the two-command public CLI.
- Publishing to npm, pushing commits/tags, or creating a GitHub release.

## Verification

- Unit-test wide, compact, colored, `NO_COLOR`, and redirected banner output.
- Spawn the source and built CLIs for all help/version aliases and assert the
  exact automation boundaries.
- Capture the final CLI banner at representative wide and narrow widths for
  visual review against the official GoEmpirical mark.
- Run `bun run ci` and `git diff --check`.

## Capability Deltas

- `deltas/cli-branding.md` adds the public startup identity and
  automation-safe rendering contract.
