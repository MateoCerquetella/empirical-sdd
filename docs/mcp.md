# MCP usage

Empirical exposes its internal workflow API over stdio:

```json
{
  "mcpServers": {
    "empirical": {
      "command": "empirical",
      "args": ["mcp"]
    }
  }
}
```

The one globally installed agent skill owns the user experience. Project
initialization preserves or creates runtime MCP configuration but does not add
project-local Explore, Fast, Complex, or Loop commands.

## Tool groups

- Setup/context: `empirical_init`, `empirical_adopt`, `empirical_configure`,
  `empirical_context`.
- Routing/workflow: `empirical_explore`, `empirical_fast`,
  `empirical_complex`, `empirical_loop`, `empirical_next`,
  `empirical_complete`, `empirical_retry`, `empirical_verify`,
  `empirical_archive`.
- Handoff/isolation: `empirical_handoff`, `empirical_worktree_propose`,
  `empirical_worktree_create`.
- Understanding: `empirical_explain`, `empirical_status`, `empirical_doctor`.
- Project contracts: `empirical_capabilities`, `empirical_policy`,
  `empirical_integrate`, `empirical_migrate`.

## Agent contract

1. Initialize in the current runtime when needed, then retrieve only relevant
   compact repository context.
2. Resume selected non-terminal work before interpreting attached request text
   as new work.
3. For genuine ambiguity, conduct the five Socratic passes one at a time and
   wait for approval of the refined contract.
4. Route Fast only for explicit tiny low-risk non-UI work; otherwise Complex.
5. If start returns `kind: worktree_proposal`, show every field and wait for
   explicit approval before calling `empirical_worktree_create`.
6. Execute each action and complete its exact revision until Done, Blocked, or
   genuine human input is required.
7. After Complex Specify passes, call `empirical_handoff` and offer Continue,
   Save, or one detected agent. Detection and authorization never launch a
   process; the host may execute only a displayed, revalidated, explicitly
   approved argument array.

Worktree proposal, Explain, and handoff proposal are read-only. Worktree
creation is destructive and requires literal approval. API/MCP setup uses
deterministic defaults and never opens a terminal prompt.
