# Empirical SDD

Agent-neutral, resumable spec-driven development for 73 global agent-skill
targets, with verified runtime guidance for Codex, Claude Code, Cursor, Gemini
CLI, Windsurf, and MCP clients.

> Empirical is alpha software. It supports one active feature per checkout and
> uses Git worktrees for isolated parallel work.

## Install

| Command | Purpose |
| --- | --- |
| `npm install -g empirical-sdd` | Install the Empirical CLI globally. |
| `empirical install` | Choose coding agents and install their five Empirical skills. |
| `empirical update` | Upgrade Empirical and refresh the installed skills. |

Restart or reload each selected agent after installation.

`empirical install` uses a searchable, scrollable local catalog pinned to a
reviewed `vercel-labs/skills` release. It remembers the exact selected ids,
deduplicates shared skill roots, and never runs `npx` or uses the network. Type
to search by agent name, id, or destination; use arrows, Space, Enter, Escape,
or Ctrl-C. Automation can use repeatable `--agent`/`-a`, `--all`, `--yes`, and
`--json`; the legacy ids `claude` and `gemini` remain aliases.

## Use

These are coding-agent skills, not shell commands:

| Agent | Automatic | Init | Spec | Socratic | Loop |
| --- | --- | --- | --- | --- | --- |
| Codex | `$empirical` | `$empirical-init` | `$empirical-spec` | `$empirical-socratic` | `$empirical-loop` |
| Claude Code | `/empirical` | `/empirical-init` | `/empirical-spec` | `/empirical-socratic` | `/empirical-loop` |
| Cursor | `empirical` | `empirical-init` | `empirical-spec` | `empirical-socratic` | `empirical-loop` |
| Gemini CLI | `empirical` | `empirical-init` | `empirical-spec` | `empirical-socratic` | `empirical-loop` |
| Windsurf | `@empirical` | `@empirical-init` | `@empirical-spec` | `@empirical-socratic` | `@empirical-loop` |

| Skill | Purpose |
| --- | --- |
| `empirical <request>` | Initialize if needed, select the workflow, and run the request through review. |
| `empirical-init` | Initialize or repair repository setup without starting work. |
| `empirical-spec <request>` | Draft a concrete specification and stop for approval. |
| `empirical-socratic <idea>` | Refine an idea through a five-pass interview, then draft a specification. |
| `empirical-loop` | Resume the active approved specification and drive it to completion. |

On first `empirical-init`, the agent shows the complete recommended setup before
writing anything. Apply the defaults, customize Verification, Parallel work,
and Decisions one section at a time, or cancel. Repair shows current values and
keeps them unless edited. Verification independently stores acceptance-test,
UI-browser, UI-screenshot, and code-review gates; all default on. Turning off
criterion evidence makes its UI sub-policies inactive without erasing them, and
does not turn off code review.

Broad catalog membership means an agent can read global `SKILL.md` files. MCP
bridging and executable handoff remain separately verified capabilities; the
installer does not infer either one.

## Development

Requires Node.js 20+ and Bun.

| Command | Purpose |
| --- | --- |
| `bun install` | Install development dependencies. |
| `bun run ci` | Run type checking, tests, build smoke tests, and package tests. |

## Documentation

[Architecture](docs/architecture.md) · [Demos](docs/demo.md) ·
[MCP](docs/mcp.md) · [Security](docs/security.md) ·
[Migration](docs/migration-v1.md)

## License

[MIT](LICENSE)
