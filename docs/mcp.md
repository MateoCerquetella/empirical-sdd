# MCP integration

`empirical mcp` starts the bundled stdio server. It exits with its host and does
not run as a background daemon.

The server coordinates durable workflow state; it does not launch or embed an
AI runtime. The coding agent that called the tool remains responsible for
editing, testing, browser work, review, and evidence collection.

## Workflow tools

Genuinely vague work has a read-only entry point:

```text
empirical_explore(problem="Make report sharing easier")
```

It returns discovery questions and committed context without creating workflow
state. Concrete new work has two entry points:

```text
empirical_fast(request="Fix the heading typo")
empirical_complex(request="Add dark mode")
```

The repository skill chooses Fast only for an explicit, tiny, localized,
reversible, low-risk non-UI change. It chooses Complex for everything else,
including UI, security-sensitive, destructive, architectural, and
cross-cutting work. The user only describes the requested change normally.

`empirical_loop()` is resume-only. It accepts no request or profile and returns
the current action without changing its revision. It never creates new work.
Quick has no new-work MCP entry point; it remains only so legacy project state
can be resumed through the loop.

The agent executes the returned action and calls `empirical_complete` at the
exact revision. After Complex Review, the returned action names
`empirical_archive`, which atomically applies the validated capability deltas at
that exact revision. A successful response already contains the next action
packet, so the agent continues from it rather than calling `empirical_next`
redundantly. It stops at Done, Blocked, or awaiting human input.

Every workflow tool accepts an optional `workstream`, and every action packet
returns an explicit workstream. `empirical_workstreams` lists, creates, or selects
named workstreams; selection is a convenience for future calls and cannot retarget
an issued packet. `empirical_capabilities` lists or reads current living specs,
and `empirical_policy` returns committed project context and phase guidance.

When MCP is unavailable, the equivalent CLI entry points are
`empirical fast "<request>"`, `empirical complex "<request>"`, and the
request-free `empirical loop` for resume. JSON output and the older
low-level start tool remain programmatic compatibility surfaces, not part of
routine agent calls. Legacy profile values load only from persisted state and
cannot start new work.

The full workflow surface is:

- read-only: `empirical_explore`, `empirical_loop`, `empirical_status`,
  `empirical_next`, `empirical_verify`, `empirical_capabilities`, and
  `empirical_policy`;
- setup/start: `empirical_init`, `empirical_adopt`, `empirical_fast`, and
  `empirical_complex`;
- transition: `empirical_complete`, `empirical_archive`, and `empirical_retry`;
- project management: `empirical_workstreams` and `empirical_integrate`; and
- compatibility: `empirical_start`.

`empirical init` safely merges project MCP configuration for:

- Codex: `.codex/config.toml`
- Claude Code: `.mcp.json`
- Gemini CLI: `.gemini/settings.json`
- Cursor: `.cursor/mcp.json`

Windsurf currently uses a user-level MCP configuration, so Empirical does not
silently modify the user's home directory. Windsurf automatically reads the
generated root `AGENTS.md` and `.agents` skill and can use the CLI fallback. A
user may optionally add this server through Windsurf's MCP settings:

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

Project MCP configurations are code execution requests. Hosts may require the
developer to trust the repository before starting the server. That approval is
intentional and must not be bypassed.

No integration uses a lifecycle or session-start hook.
