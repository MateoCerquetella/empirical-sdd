# Empirical SDD

One npm package that gives any terminal-capable coding agent the same resumable,
evidence-backed development workflow.

```bash
npm install -g @empirical/sdd
cd your-project
empirical init
```

Then open Codex, Claude Code, Gemini CLI, Cursor, Windsurf, or another coding
agent and say:

```text
Use Empirical to add dark mode.
```

That is the normal user experience. There is no Rust toolchain, daemon, GUI,
database, IDE plug-in, mandatory MCP server, or per-agent command installation.

For a complete run with real commands and output, see the
[hello-command demo](https://github.com/MateoCerquetella/empirical-sdd/blob/main/docs/demo.md).

## How it works everywhere

`empirical init` performs one safe project setup:

- creates committed, portable workflow state under `.empirical/`;
- adds a managed Empirical section to `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`
  without replacing existing instructions;
- configures the bundled `empirical mcp` stdio server for project-scoped Codex,
  Claude Code, Gemini CLI, and Cursor where supported; and
- leaves a self-guiding CLI fallback for every agent that can use a terminal.

Agents prefer MCP tools when connected. Otherwise they run:

```bash
empirical next --json
```

Both interfaces use the same TypeScript library and `.empirical/` state. MCP is
progressive enhancement, never a dependency.

| Agent | Automatic project guidance | Native project MCP | Fallback |
|---|---|---|---|
| Codex | `AGENTS.md` | `.codex/config.toml` | CLI |
| Claude Code | `CLAUDE.md` | `.mcp.json` | CLI |
| Gemini CLI | `GEMINI.md` | `.gemini/settings.json` | CLI |
| Cursor | `AGENTS.md` | `.cursor/mcp.json` | CLI |
| Windsurf | `AGENTS.md` | Host currently uses user-level MCP config | CLI |
| Other terminal agents | Managed repository guidance when supported | If the host supports MCP | CLI |

## Simple workflow

Start a feature directly or let the agent call the same operation:

```bash
empirical start "Add dark mode"
```

See the current work:

```bash
empirical
empirical status
empirical next --json
```

Quick features follow:

```text
Shape → Implement → Verify → Review → Done
```

Strong features add explicit design and planning:

```bash
empirical start "Replace authentication" --profile strong
```

```text
Specify → Design → Plan → Implement → Verify → Review → Done
```

Every mutation carries the revision returned by `empirical next`, so two agents
cannot silently overwrite each other's workflow state. Verify requires passing
evidence for every acceptance criterion. Criteria marked `[UI]` additionally
require browser and screenshot evidence. Review requires review evidence.

## Commands

```text
empirical init [--profile quick|strong]
empirical adopt [--profile quick|strong]
empirical start "<request>" [--profile quick|strong]
empirical next [--json]
empirical complete --revision N --outcome passed --summary "..."
empirical status [--json]
empirical verify [--json]
empirical retry --revision N
empirical integrate
empirical doctor
empirical migrate
empirical mcp
empirical update [--check]
```

`empirical complete` accepts a full JSON result from a file or stdin:

```bash
empirical complete --input result.json
empirical complete --input -
```

## MCP tools

The same package exposes these tools through `empirical mcp`:

- `empirical_init`
- `empirical_adopt`
- `empirical_start`
- `empirical_status`
- `empirical_next`
- `empirical_complete`
- `empirical_verify`
- `empirical_retry`
- `empirical_integrate`

The server uses stdio and is started on demand by the host. It is not a daemon.

## JavaScript API

Tools and IDEs can embed the exact same engine:

```ts
import { EmpiricalProject } from "@empirical/sdd";

const project = await EmpiricalProject.open(process.cwd());
const action = await project.next();
```

The package is written in TypeScript, developed and tested with Bun, published
through npm, and runs on Node.js 20 or newer. End users do not need Bun.

## Existing Empirical v1 repositories

Adoption is additive:

```bash
empirical adopt
```

It preserves `ai/`, copies the active specification into the `.empirical/`
store, and defaults legacy work to Strong unless `--profile quick` is supplied.

## Updating

```bash
empirical update
```

This installs the latest public npm package. Repository migrations are explicit
and non-destructive:

```bash
empirical migrate
```

## Development

```bash
bun install
bun run check
bun test
bun run test:package
```

The generated JavaScript is tested with Node.js so the npm package does not
require Bun at runtime.

## License

MIT. See [LICENSE](LICENSE).
