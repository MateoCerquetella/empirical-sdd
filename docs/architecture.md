# Architecture

Empirical is one npm package with one source of business logic:

```text
Codex / Claude / Gemini / Cursor / Windsurf / other agents
          |                    |                    |
    project skills         MCP tools               CLI
          \                    |                    /
                   TypeScript core library
                            |
                 committed .empirical state
```

## Package surfaces

- `src/core.ts` implements initialization, v1 adoption, state transitions,
  the Fast and Complex public workflows, Quick legacy-state compatibility,
  Explore, workstream management, acceptance-criterion parsing, evidence gates,
  Archive, and bounded repair routing.
- `src/cli.ts` is the global `empirical` executable.
- `src/mcp.ts` exposes the same operations as stdio MCP tools.
- `src/integrations.ts` safely adds discovery instructions, project skills,
  native manual commands, and project-scoped MCP configuration without
  replacing unmanaged content.
- `src/storage.ts` provides atomic JSON projection, append-only transition
  events, workstream-scoped state, shared-resource locking, recovery, rollback
  effects, and optimistic revisions.
- `src/specifications.ts` parses and preflights requirement deltas, projects
  canonical capability specifications, and prepares reversible archive writes.

The MCP server owns no state. Deleting an agent's cache or MCP configuration
does not affect the workflow because another client can resume from
`.empirical/state.json` and `.empirical/events/` for the default workstream or
the equivalent named-workstream paths.

Protocol schema 3 adds living capability specs, project policy, and independent
named workstreams. The current engine reads schema-1 and schema-2 projects and
upgrades them non-destructively on migration or the next state mutation.

## Cooperative execution loop

The CLI and MCP server coordinate state; they do not embed a coding model. The
interactive Explore flow may explicitly launch an installed Codex runtime after
an approved workflow is created. Otherwise the current host agent edits files,
runs tests, uses a browser when required, and submits evidence.

```text
ordinary user request
         |
  vague? -- yes --> Socratic interview ---------+
         \ no       five passes + approval     |
          +-------------------------------------+
                         |
                project skill chooses
                    /           \
                 Fast          Complex
                   |               |
empirical_fast  empirical_complex      (MCP)
empirical fast  empirical complex      (CLI)
     \           /
   current action packet
            |
   host agent does the work
            |
 empirical complete / empirical archive
            |
   returned next action packet
            +---- repeat until done, blocked, or awaiting human input
```

Fast and Complex start new work. `loop` is deliberately smaller: it only returns
the current action for an existing workflow and takes no request or profile.
Every start and completion response is itself the next action packet, which
avoids a redundant state round trip between phases. A later session can resume
through `empirical_loop()` or `empirical loop`.

Fast reduces model round trips further by combining implementation,
verification, and review into one revision. It does not weaken the evidence
gate: all criterion evidence, required UI evidence, and review evidence arrive
in the same completion. Complex retains explicit specification, design,
planning, verification, and review gates. Quick is not a public workflow for
new work; it remains only so older project state can be resumed safely.

After Complex Review, the workflow enters Archive. All capability deltas are
preflighted before mutation. Capability writes happen as a reversible effect
inside the exact-revision state transaction; a failed event/state projection
restores the previous living specs. The Archive operation is idempotent after
Done.

## Shared project state and workstreams

```text
project-wide                          independently revisioned
config + policy                      default: state.json + events/
feature specs + deltas               named: workstreams/<id>/state.json + events/
living capability specs
        |                                      |
        +-- shared resource locks     per-workstream state lock --+
```

Feature numbering and capability archive are globally serialized because their
files are shared. Routine transitions in different workstreams use independent
locks and revisions. Selection changes only the default addressed by a fresh
command; action packets always preserve immutable workstream identity.

## Portability boundary

“Works on every agent” means:

1. Native MCP tools on hosts that support and load project MCP configuration.
2. Automatic project skills and repository guidance on hosts that support
   them.
3. Self-guiding `empirical fast "<request>"` and
   `empirical complex "<request>"` fallbacks for any terminal-capable agent,
   plus `empirical explore` for genuine ambiguity and `empirical loop` for resume.

The integrations are committed project files. Empirical installs no lifecycle
hooks and writes no skills or commands into a developer's home directory.

The low-level start operation and machine-readable JSON remain programmatic
integration surfaces, but neither is part of normal agent use. Legacy profile
values are accepted only when loading persisted state.

An agent with neither repository/terminal access nor MCP support cannot operate
on a local checkout; that is a host limitation rather than a package adapter.
