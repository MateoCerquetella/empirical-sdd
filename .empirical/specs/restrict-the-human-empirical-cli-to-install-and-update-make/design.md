# Design: Two-Command CLI And Agent Selector

## Public and private dispatch

`src/cli.ts` parses global options, then classifies the first command before
entering the existing operation switch:

- Public: `install`, `update`, standard help/version.
- Transport: `mcp`, accepted but never printed as a human command.
- Private: `__internal <operation>`, which dispatches the existing workflow
  verbs for the generated agent fallback and package tests.
- Everything else: stable `UNKNOWN_COMMAND`, with guidance to invoke Empirical
  inside the coding agent.

No-argument execution always renders public help. Direct verbs are rejected
before project discovery, so they cannot initialize or mutate repository state.
Existing operation implementations remain behind the private dispatcher and
MCP/TypeScript boundaries.

## Selector model

Add `src/selector.ts` with a pure state model:

```text
items[] + selected set + cursor
        │ key
        ▼
next state | submit | cancel
```

The reducer recognizes Up/Down (including `k`/`j`), Space, `a` for all, Enter,
and Ctrl-C/Escape. Rendering shows a cursor, `[x]`/`[ ]`, agent name, and
`detected` / `installed` badges. Detected and currently managed agents are
selected initially; all supported agents remain visible.

The TTY adapter uses raw keypress events, hides the cursor only while active,
and restores raw mode, listeners, and cursor visibility in `finally`. Empty
Enter does not submit and displays an inline requirement. The pure reducer and
renderer carry most behavioral coverage without needing a real terminal.

## Install selection resolution

Install flags mirror the useful `npx skills` conventions:

- repeated `--agent <id>` or `-a <id>`: exact set;
- `--all`: every supported agent;
- `--yes` / `-y`: detected plus currently managed agents;
- no selection in TTY: interactive selector;
- no selection with JSON or non-TTY: `AGENT_SELECTION_REQUIRED`.

Conflicting modes and unknown/duplicate agent IDs are validated before writes.
The selected IDs are passed explicitly into integration reconciliation.

## Safe reconciliation

`installGlobalAgentSkills` accepts an exact target set. It iterates the entire
supported-agent catalog:

- selected: write/update one marker-owned `empirical/SKILL.md`, remove obsolete
  dedicated managed skills;
- deselected: remove marker-owned generic and obsolete skills if present;
- unmanaged, symlink, and non-file collisions: preserve and report.

The report lists only selected installed entrypoints while created, updated,
removed, and preserved paths cover reconciliation across all agents.

## Update and generated skill

`src/lifecycle.ts` runs npm update, then the new binary with `install --yes`.
This reuses detected and currently managed targets and cannot enter raw TTY
selection from a child update process.

The generated skill replaces every direct fallback with the private namespace,
for example `empirical __internal init`, and continues to prefer the typed MCP
tool. User-facing guidance never exposes the private namespace.

## Documentation and compatibility

README's normal usage contains only installation, selection, update, and the
native in-agent invocation. An explicitly labeled internal API section explains
MCP/TypeScript ownership without presenting direct workflow shell examples.
Architecture/protocol docs describe private dispatch for maintainers.

Tests and distribution smoke migrate their low-level CLI calls to `__internal`.
That verifies compatibility rather than accidentally preserving public access.

## Failure behavior

- Non-TTY missing selection: no writes, `AGENT_SELECTION_REQUIRED`.
- Empty interactive submission: remain in selector, no writes.
- Ctrl-C/Escape: restore terminal, return a cancellation error, no writes.
- Invalid/mixed flags: no writes, `INVALID_ARGUMENT`.
- Managed deselection collision: preserve unsafe/unmanaged target and report.
- MCP/private operation error: retain existing stable Empirical error.
