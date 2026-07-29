# MCP usage

Empirical exposes the same core workflow over stdio:

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

`empirical init` installs project discovery for supported agents. Run
`empirical integrate` to refresh it.

## Tool groups

- Discovery/setup: `empirical_explore`, `empirical_init`, `empirical_adopt`,
  `empirical_configure`.
- Workflow: `empirical_fast`, `empirical_complex`, `empirical_loop`,
  `empirical_next`, `empirical_complete`, `empirical_retry`,
  `empirical_verify`, `empirical_archive`.
- Isolation: `empirical_worktree_propose`, `empirical_worktree_create`.
- Understanding: `empirical_explain`, `empirical_status`, `empirical_doctor`.
- Project context: `empirical_capabilities`, `empirical_policy`,
  `empirical_integrate`, `empirical_migrate`.

## Agent contract

1. Use Explore only for genuine ambiguity.
2. Conduct the five Socratic passes in the current conversation, one question at
   a time, and wait for approval of the complete refined contract.
3. Choose Fast only for explicit tiny low-risk non-UI work; otherwise Complex.
4. If start returns `kind: worktree_proposal`, show every field and wait for
   explicit approval. Then echo its `baseCommit`, `activeFeature`, and
   `approvalToken` into `empirical_worktree_create` with `approved: true`.
5. Execute the ActionPacket and call Complete or Archive at its exact revision.
6. Consume the response as the next action until Done, Blocked, or awaiting
   human input.
7. Use Explain when the user needs the current state, next-action reason, context
   gaps, gate, or accepted decisions.

The proposal and Explain tools are read-only. Worktree creation is the only tool
that intentionally mutates Git and is annotated accordingly. API/MCP setup uses
deterministic defaults and never opens a terminal prompt.
