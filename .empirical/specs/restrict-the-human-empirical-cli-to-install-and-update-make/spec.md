# Restrict The Human CLI To Install And Update

## Request

> Expose only `empirical install` and `empirical update` to humans. Replace the
> automatic installer with an interactive multi-agent selector like `npx
> skills`, preserve explicit non-interactive selection for automation, keep the
> workflow engine available to installed agents through MCP and a private
> internal transport, and make README match the actual commands.

## Goal

A developer can run Empirical without seeing or choosing Init, Config, Explore,
Fast, Complex, Loop, Complete, or other state-machine verbs. Installation opens
a clear selector for supported agents, installs the single Empirical skill only
where selected, and Update preserves those installed targets without prompting.

## Acceptance Criteria

- [ ] [AC-1] Running `empirical` or `empirical --help` prints a concise public
  surface containing only `empirical install` and `empirical update`, plus
  standard help/version information and agent invocation guidance. It does not
  print Init, Config, Explore, Fast, Complex, Loop, Complete, Archive, Status,
  Integrate, or other workflow commands.
- [ ] [AC-2] Direct human invocations such as `empirical init`, `empirical
  config`, `empirical fast`, and `empirical loop` fail with a stable
  `UNKNOWN_COMMAND` error that directs repository work into the installed agent
  entrypoint. The stdio MCP server, TypeScript API, and a deliberately private
  `empirical __internal <operation>` compatibility transport retain the same
  workflow behavior for agents and existing package internals.
- [ ] [AC-3] In an interactive TTY, `empirical install` displays all supported
  agents in a keyboard-controlled multi-select list, visibly marks detected and
  currently managed agents, preselects those agents, supports Up/Down, Space,
  All, and Enter, and refuses an empty selection without writing anything.
- [ ] [AC-4] Non-interactive installation never hangs or guesses. Repeated
  `--agent <id>`/`-a <id>` selects exact agents, `--all` selects every supported
  agent, and `--yes` preserves detected or currently managed agents. JSON or
  non-TTY installation without one of those selections fails with actionable
  `AGENT_SELECTION_REQUIRED` guidance.
- [ ] [AC-5] Installation writes exactly one managed global `empirical` skill
  per selected agent, removes marker-owned Empirical and obsolete dedicated
  skills from deselected agents, and preserves unmanaged files, directories,
  symbolic links, unrelated configuration, and paths outside the selected
  home. Repeating the same selection converges without unnecessary writes.
- [ ] [AC-6] `empirical update` installs `empirical-sdd@latest`, then invokes the
  newly installed process with `empirical install --yes` so the existing
  detected/managed target set refreshes without an interactive prompt. Either
  stage reports a distinct failure and success is not claimed early.
- [ ] [AC-7] The generated Empirical skill uses MCP operations first and the
  private `empirical __internal` namespace only as a fallback. It never asks the
  user to run hidden workflow verbs and never references direct public Init,
  Explore, Fast, Complex, Loop, Complete, Archive, Context, or Handoff commands.
- [ ] [AC-8] README documents the current published lifecycle surface,
  interactive selector, automation flags, native agent invocations, MCP-owned
  repository workflow, and Update behavior. It contains no normal-user examples
  that invoke removed workflow commands and no temporary local-release
  troubleshooting presented as product usage.
- [ ] [AC-9] Type checking, selector reducer/rendering tests, CLI public/private
  routing tests, isolated-home reconciliation tests, lifecycle tests, the full
  suite, built CLI/MCP smoke, and package dry-run all pass.

## Scope

- Add an ANSI keyboard multi-selector with a pure state reducer and deterministic
  rendering suitable for direct unit coverage.
- Add repeated `--agent`/`-a`, `--all`, and `--yes` install modes.
- Reconcile selected and deselected managed agent targets safely.
- Route all existing workflow CLI operations behind `__internal`; keep `mcp` as
  an unlisted transport bootstrap.
- Update lifecycle refresh, generated skill guidance, tests, distribution
  smoke, README, architecture, protocol, and living capability behavior.

## Non-goals

- Removing MCP tools, the TypeScript state-machine API, Fast/Complex profiles,
  exact revisions, evidence gates, worktrees, knowledge, or handoff.
- Installing arbitrary third-party skills or supporting the full `npx skills`
  source/catalog model.
- Writing unmanaged agent files or automatically selecting every undetected
  agent.
- Publishing to npm before the implementation and package are verified.

## Risks

- TTY raw mode can leave the terminal altered after cancellation; cleanup must
  run on success, error, and Ctrl-C.
- Hiding direct verbs can break internal scripts; the explicit private namespace
  and MCP surface must preserve typed behavior.
- Deselecting an agent is destructive to managed files; marker and symlink
  checks must remain authoritative.
- Update cannot prompt after npm replacement; `--yes` must deterministically
  preserve detected and already managed targets.

## Verification

- Exercise selector initialization, navigation, toggling, select-all, empty
  submission, rendering, cancellation cleanup contract, and deterministic
  ordering with pure/injected fixtures.
- Spawn CLI help, direct rejected verbs, private operations, explicit selector
  flags, JSON/non-TTY failures, `--all`, and `--yes` outside a repository.
- Install and deselect agents in isolated homes with managed, unmanaged,
  symlink, non-file, repeat, and obsolete-skill fixtures.
- Run the full CI pipeline, built MCP smoke, and package dry-run.

## Capability Deltas

- `deltas/agent-integrations.md`
