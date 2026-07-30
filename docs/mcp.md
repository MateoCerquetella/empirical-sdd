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

The five globally installed agent skills own the user experience. Project
initialization preserves or creates runtime MCP configuration but does not add
project-local workflow skills.

## Tool groups

- Setup/context: `empirical_init`, `empirical_adopt`, `empirical_configure`,
  `empirical_context`.
- Discovery/routing: `empirical_explore`, `empirical_discovery`,
  `empirical_fast`, `empirical_complex`.
- Workflow: `empirical_loop`, `empirical_next`,
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
3. For genuine ambiguity or explicit Socratic use, conduct the five passes one
   at a time, save ordered progress with `empirical_discovery`, and wait for
   approval of the refined contract.
4. Route Fast only for explicit tiny low-risk non-UI work; otherwise Complex.
5. If start returns `kind: worktree_proposal`, show every field and wait for
   explicit approval before calling `empirical_worktree_create`.
6. Execute each action and complete its exact revision until Done, Blocked, or
   genuine human input is required.
7. After Complex Specify passes, call `empirical_handoff` and offer Continue,
   Save, or one detected agent. Detection and authorization never launch a
   process; the host may execute only a displayed, revalidated, explicitly
   approved argument array.

The automatic skill follows the whole contract. Init stops after step 1. Spec
starts concrete Complex and stops before completing Specify. Socratic performs
steps 1–3, drafts Specify, and stops before completion. Loop starts at step 2
for already selected work and never accepts a new feature request.

`empirical_discovery` accepts a problem, an ordered prefix of Socratic answers,
and an optional discovery ID. Calls without approval save a draft. A call with
`approved: true` requires all five passes, derives and persists the refined
request, and returns either its Complex Specify action or a non-mutating
worktree proposal. Every draft response returns exactly one next pass or
material follow-up when another answer is required.

Worktree proposal, Explain, and handoff proposal are read-only. Worktree
creation is destructive and requires literal approval. API/MCP setup uses
deterministic defaults and never opens a terminal prompt.
