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
  acceptance-criterion parsing, evidence gates, and bounded repair routing.
- `src/cli.ts` is the global `empirical` executable.
- `src/mcp.ts` exposes the same operations as stdio MCP tools.
- `src/integrations.ts` safely adds discovery instructions, project skills,
  native manual commands, and project-scoped MCP configuration without
  replacing unmanaged content.
- `src/storage.ts` provides atomic JSON projection, append-only transition
  events, local locking, recovery, and optimistic revisions.

The MCP server owns no state. Deleting an agent's cache or MCP configuration
does not affect the workflow because another client can resume from
`.empirical/state.json` and `.empirical/events/`.

Protocol schema 2 adds the Fast capability guard. The current engine reads
schema-1 projects and upgrades them non-destructively on migration or the next
state mutation. Older engines reject schema 2 before completing a Fast action.

## Cooperative execution loop

The CLI and MCP server coordinate state; they do not run a coding model. The
current host agent edits files, runs tests, uses a browser when required, and
submits evidence.

```text
ordinary user request
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
     empirical complete
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

## Portability boundary

“Works on every agent” means:

1. Native MCP tools on hosts that support and load project MCP configuration.
2. Automatic project skills and repository guidance on hosts that support
   them.
3. Self-guiding `empirical fast "<request>"` and
   `empirical complex "<request>"` fallbacks for any terminal-capable agent,
   plus `empirical loop` for resume.

The integrations are committed project files. Empirical installs no lifecycle
hooks and writes no skills or commands into a developer's home directory.

The low-level start operation and machine-readable JSON remain programmatic
integration surfaces, but neither is part of normal agent use. Legacy profile
values are accepted only when loading persisted state.

An agent with neither repository/terminal access nor MCP support cannot operate
on a local checkout; that is a host limitation rather than a package adapter.
