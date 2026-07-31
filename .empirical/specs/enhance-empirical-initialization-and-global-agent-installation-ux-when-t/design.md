# Design: Empirical Setup Wizard And Broad Agent Installer

## Context

Empirical 0.20.2 currently uses one five-entry `SUPPORTED_AGENTS` registry for
three different concerns: global skill installation, local executable detection
for handoff, and invocation/reload reporting. `src/selector.ts` renders every
entry at once and has no search or viewport. Project configuration already
persists four evidence booleans, but `ProjectConfigurationInput`, MCP Init and
Configure, private CLI flags, and the first-run questions expose only isolation
and decision settings.

The upstream `vercel-labs/skills` repository at commit
`7cb7db64dc1201052dea305e508a2fc490f7e5e2` (`skills` 1.5.21) defines 75 agent
targets. Seventy-three have global skill roots; Eve and PromptScript are
project-only. Several ids share one physical root, including the universal
`.agents/skills` and `.config/agents/skills` destinations. Its long-list prompt
uses search, a bounded viewport, movement/selection hints, hidden-row counts,
and a selected summary.

## Architecture

### 1. Separate compatibility registries

Add `src/agent-catalog.ts` as the checked-in, runtime-local skill installation
catalog. Each immutable entry contains:

- canonical upstream id and display label;
- safe home-relative global skill path, or a project-only exclusion reason;
- legacy CLI aliases (`claude` and `gemini` for the original ids);
- conservative executable and/or configuration-directory detection hints;
- optional verified invocation and reload guidance;
- explicit booleans for separately verified project MCP and handoff support.

The module records upstream repository, package version, and commit constants.
It exports catalog validation, id/alias resolution, safe destination resolution,
and detection helpers. Runtime install performs no fetch, telemetry, or `npx`
execution.

Keep `src/agents.ts` as the smaller executable handoff registry. Rename its
primary concepts to handoff-oriented names internally while retaining the
existing `SUPPORTED_AGENTS`, `AgentIntegrationId`, and exported helpers as
compatibility aliases. Handoff schemas remain limited to Codex, Claude Code,
Cursor, Gemini CLI, and Windsurf until explicit launch metadata is added.

### 2. Remember ids and reconcile destinations

Store the last canonical explicit selection in
`~/.empirical-sdd/integrations.json`:

```json
{
  "schemaVersion": 1,
  "managedBy": "empirical-sdd",
  "catalogCommit": "7cb7db64dc1201052dea305e508a2fc490f7e5e2",
  "selected": ["claude-code", "codex"]
}
```

Read the manifest only when its ownership marker, schema, and selected ids are
valid. Preserve an unmanaged/invalid collision and fall back to conservative
legacy marker detection. Write it atomically only after installation succeeds,
and only after the same no-symlink/no-escape ancestor checks used for skills.

Canonical selection precedence is:

1. repeatable `--agent` aliases resolve to the exact canonical set;
2. `--all` selects every global-capable catalog entry;
3. `--yes` selects the union of remembered, conservatively detected, and
   legacy-managed entries and errors instead of expanding an empty set;
4. interactive install preselects that same union but requires explicit submit.

Group catalog entries by normalized absolute global root before filesystem
mutation. If any selected id references a root, write one copy of each of the
five managed skills. Remove marker-owned skills from an unselected root only
when no selected id references it. Reports retain one entry per selected id but
file outcome arrays describe unique physical paths.

### 3. Searchable bounded selector

Rewrite `src/selector.ts` around a pure `AgentSelectorState` containing cursor,
query, selected ids, and validation error. Pure helpers will:

- filter case-insensitively across label, canonical id, aliases, and displayed
  destination;
- keep detected/installed entries first while preserving stable catalog order;
- calculate a centered viewport with at most eight visible entries;
- truncate every rendered row to the supplied terminal width;
- render the rail, search cursor, status/path hints, hidden-row counts, and
  selected summary without ANSI dependence;
- reduce arrows, space, printable input, Backspace, Enter, Escape, and Ctrl-C.

The TTY adapter will emit readline keypress events, use raw mode, hide/restore
the cursor, and redraw one complete frame with a single write. It will restore
raw mode and listeners in `finally` on submit, cancel, or error. The public
`--all` flag replaces the old in-prompt `a` shortcut so normal letters remain
available for search.

### 4. Configuration parity and setup presentation

Extend `ProjectConfigurationInput` with a partial `evidence` object. Core
default, normalization, initialization, and configuration merge paths will
preserve all four booleans and default missing values to true. `required: false`
short-circuits criterion test/browser/screenshot enforcement without rewriting
the stored UI sub-policies; `codeReview` remains an independent Review gate.

Extend MCP Init/Configure with optional booleans:

- `evidenceRequired`
- `browserForUi`
- `screenshotForUi`
- `codeReview`

Add equivalent private CLI `on|off` flags:

- `--evidence`
- `--ui-browser`
- `--ui-screenshot`
- `--code-review`

The generated `empirical-init` and automatic skill bodies will require the host
to inspect current configuration, render the approved three-section summary,
offer Apply/Keep, Customize, and Cancel before calling mutating Init, customize
one section at a time, render the final effective values, and call MCP with the
explicit chosen settings only after Save.

The private TTY fallback will use the same labels and ordering. It will build a
read-only preview from strict defaults or normalized current configuration,
prompt before `EmpiricalProject.initialize`, loop through summary/customize/final
review, and abort before mutation on Cancel. Noninteractive and JSON calls keep
their deterministic behavior.

### 5. Honest reports

Broaden `AgentEntrypointReport.id` to the skill-target id type and add explicit
metadata indicating whether invocation/reload guidance is verified and whether
project MCP/handoff support exists. For entries with verified syntax, retain the
five concrete invocations. For other targets, return an empty invocation list
and a stable message that runtime guidance is unverified; never synthesize slash
commands.

The human report shows the selected agent, unique destination, installed skill
names, verified invocation/reload text when present, and otherwise an honest
skill-only compatibility note. JSON retains created/updated/removed/preserved
arrays and reports canonical selected ids and destinations deterministically.

## File-Level Changes

- `src/agent-catalog.ts`: pinned catalog, aliases, detection, validation, path
  resolution, provenance.
- `src/agents.ts`: keep executable/handoff-only definitions and compatibility
  exports.
- `src/types.ts`: evidence configuration input, distinct skill/handoff ids,
  broadened integration report metadata.
- `src/core.ts`, `src/storage.ts`: evidence defaults, normalization, and partial
  merge behavior.
- `src/mcp.ts`: evidence input schemas and mapping.
- `src/selector.ts`: searchable state, viewport renderer, width handling, TTY
  lifecycle.
- `src/integrations.ts`: generated Init guidance, selection manifest, alias
  resolution, unique-root reconciliation, broad reports.
- `src/cli.ts`: catalog-driven install modes, setup preview/customize/review,
  evidence flags, and human output.
- `tests/agent-catalog.test.ts`: provenance, count, ids, aliases, safety, shared
  roots, and capability separation.
- Existing selector/config/integration/MCP/agent tests: new behavior and
  backwards compatibility.
- README and architecture/demo/MCP documentation: visible flows and boundaries.

## Compatibility And Migration

- Repository configuration stays schema 4 because the persisted evidence shape
  already exists; normalization fills any missing booleans for older documents.
- `AgentIntegrationId` remains an exported alias for the five handoff ids.
- `claude` and `gemini` remain accepted CLI aliases and resolve to
  `claude-code` and `gemini-cli` in structured reports.
- A home without the new selection manifest falls back to marker detection for
  the original five unique roots. The first successful reconciliation writes
  canonical selection metadata.
- Existing marker ownership and project-local cleanup remain unchanged.

## Failure Handling

- Invalid/project-only agent flags fail before any filesystem mutation.
- An invalid selection manifest is preserved and reported; it is never silently
  overwritten.
- Unsafe catalog destinations fail catalog validation; runtime resolution still
  rejects escape and symbolic-link ancestry.
- Empty interactive submission stays in the selector with an error; Escape or
  Ctrl-C restores the terminal and installs nothing.
- Empty `--yes` selection fails with actionable `--agent`/`--all` guidance.
- Setup cancellation occurs before initialization/configuration writes.

## Verification Strategy

1. Pure unit tests cover all catalog and prompt transformations, including 40,
   80, and 120 columns.
2. Temporary-home integration tests cover 73 global targets, two project-only
   exclusions, shared-root reference behavior, aliases, remembered selection,
   legacy migration, symlink/unmanaged preservation, and repeated convergence.
3. Configuration tests cover strict defaults, every partial evidence field,
   existing-config preservation, dependency semantics, private flags, and
   cancel-before-write.
4. MCP tests assert Init/Configure schemas and returned effective policy.
5. Handoff tests assert that a selected skill-only target is never offered.
6. A real pseudo-terminal session exercises search, scrolling, selection,
   cancellation, and terminal cleanup.
7. `bun run ci` validates types, unit/integration tests, built MCP smoke, and npm
   package contents.
