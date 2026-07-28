# Architecture

Empirical is one npm package with one source of business logic:

```text
Codex / Claude / Gemini / Cursor / Windsurf / other agents
                  |                         |
             MCP tools                 CLI + JSON
                  \                         /
                   TypeScript core library
                            |
                 committed .empirical state
```

## Package surfaces

- `src/core.ts` implements initialization, v1 adoption, state transitions,
  Quick and Strong profiles, acceptance-criterion parsing, evidence gates, and
  bounded repair routing.
- `src/cli.ts` is the global `empirical` executable.
- `src/mcp.ts` exposes the same operations as stdio MCP tools.
- `src/integrations.ts` safely adds small discovery instructions and
  project-scoped MCP configuration without replacing existing content.
- `src/storage.ts` provides atomic JSON projection, append-only transition
  events, local locking, recovery, and optimistic revisions.

The MCP server owns no state. Deleting an agent's cache or MCP configuration
does not affect the workflow because another client can resume from
`.empirical/state.json` and `.empirical/events/`.

## Portability boundary

“Works on every agent” means:

1. Native MCP tools on hosts that support and load project MCP configuration.
2. Automatic repository guidance on hosts that read `AGENTS.md`, `CLAUDE.md`,
   or `GEMINI.md`.
3. A self-guiding `empirical next --json` fallback for any terminal-capable
   agent.

An agent with neither repository/terminal access nor MCP support cannot operate
on a local checkout; that is a host limitation rather than a package adapter.
