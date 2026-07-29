# Empirical SDD

One npm package that gives any terminal-capable coding agent the same resumable,
evidence-backed development workflow—with Socratic discovery, parallel
workstreams, and living capability specifications.

```bash
npm install -g empirical-sdd
cd your-project
empirical init
```

The cross-platform install scripts also detect and remove the old
`@empirical/cli` package if it still owns the `empirical` executable:

```bash
curl -fsSL https://raw.githubusercontent.com/MateoCerquetella/empirical-sdd/main/scripts/install.sh | sh
```

Then open Codex, Claude Code, Gemini CLI, Cursor, Windsurf, or another coding
agent and say:

```text
Add dark mode.
```

That is the normal user experience: no special prefix and no per-agent command
installation. Restart the agent once after the first `empirical init` so it can
load the new project configuration. There is no Rust toolchain, daemon, GUI,
database, IDE plug-in, mandatory MCP server, lifecycle hook, or home-directory
integration.

For a complete run with real commands and output, see the
[hello-command demo](https://github.com/MateoCerquetella/empirical-sdd/blob/main/docs/demo.md).

## How it works everywhere

`empirical init` performs one safe project setup:

- creates committed, portable workflow state under `.empirical/`;
- adds a managed Empirical section to `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`
  without replacing existing instructions;
- installs repository-local skills and manual command fallbacks for supported
  agents;
- configures the bundled `empirical mcp` stdio server for project-scoped Codex,
  Claude Code, Gemini CLI, and Cursor where supported; and
- leaves a self-guiding CLI fallback for every agent that can use a terminal.

For new work, the installed agent skill chooses one of two public workflows and
uses the matching MCP tool. Without MCP it runs one of:

```bash
empirical fast "<request>"
empirical complex "<request>"
```

Both interfaces use the same TypeScript library and `.empirical/` state. MCP is
progressive enhancement, never a dependency. Fast is reserved for explicit,
tiny, localized, reversible, low-risk non-UI changes; the skill chooses Complex
for everything else. To resume existing work, the agent calls `empirical loop`
without a request.

When a request is genuinely vague, `empirical explore "<idea>"` restores the
original five-pass Socratic interview in an interactive terminal. It asks one
question at a time about the problem/user, observable outcome, boundaries,
failure/risk, and verification; saves every answer under
`.empirical/discoveries/`; shows the refined brief for approval; and then starts
Fast or Complex directly. It can optionally launch Codex after workflow creation:

```bash
empirical explore "Build a browser puzzle game" --agent codex
```

Inside an existing agent, the generated skill conducts the same interview in the
current conversation. JSON, MCP, TypeScript, non-TTY, and `--no-interview` keep a
pure read-only Explore packet for automation. Discovery is not an extra phase for
requests that are already concrete.

| Agent | Automatic project integration | Manual fallback |
|---|---|---|
| Codex | `AGENTS.md` and `.agents/skills/empirical/SKILL.md` | `$empirical` |
| Claude Code | `CLAUDE.md` and `.claude/skills/empirical/SKILL.md` | `/empirical` |
| Gemini CLI | `GEMINI.md` and project MCP | `/empirical` |
| Cursor | `AGENTS.md` and project MCP | `/empirical` |
| Windsurf | `AGENTS.md` and the shared project skill | `@empirical` or `/empirical` |
| Other terminal agents | Managed repository guidance when supported | `empirical fast` or `empirical complex` |

Cursor, Gemini, and Windsurf receive their native command files under
`.cursor/commands/`, `.gemini/commands/`, and `.windsurf/workflows/`. All of
these files stay inside the repository. Commit them so coworkers receive the
same behavior when they clone the project.

## Simple workflow

Describe the work normally. The repository skill chooses one of the two public
workflows and invokes it for you:

```bash
empirical fast "Fix the heading typo"
empirical complex "Add dark mode"
```

You do not type those commands inside the agent. They are the CLI equivalents
of `empirical_fast` and `empirical_complex`, which the agent uses after reading
your request.

Resume active work with:

```bash
empirical loop
```

`empirical loop` does not launch Codex, Claude, or another model. It is a
resume operation: it returns the current action without accepting a new request
or choosing a workflow. The already-open agent performs the work, completes the
exact revision, and immediately uses the next action returned by
`empirical complete`. It does not need a redundant `empirical loop` call after
each completion.

Unrelated active work gets a named workstream instead of replacing the current
change:

```bash
empirical workstream create billing
empirical complex "Add invoice retries" --workstream billing
empirical loop --workstream billing
```

Every returned action and completion command includes its workstream identity,
so changing the selected workstream cannot redirect an already-issued action.

## Two public workflows

### Fast

The agent chooses Fast only for explicit, tiny, localized, reversible,
low-risk, non-UI work:

```bash
empirical fast "Fix the heading typo"
```

```text
Implement + Verify + Review → Done
```

Fast creates a concise specification automatically and requires one combined
completion with passing test evidence for every acceptance criterion and
passing review evidence. UI work, authentication, security, data migrations,
public API or schema changes, infrastructure, and broad refactors are not Fast
candidates.

When MCP is unavailable, the returned Fast packet gives the agent one complete
CLI command using `--test` and `--review`; it does not need to create an evidence
JSON file.

### Complex

The agent chooses Complex whenever Fast eligibility is uncertain, including UI,
high-risk, and cross-cutting work:

```bash
empirical complex "Replace authentication"
```

```text
Specify → Design → Plan → Implement → Verify → Review → Archive → Done
```

Every mutation carries the revision from its current action packet, so two
agents cannot silently overwrite each other's workflow state. Verify requires
passing evidence for every acceptance criterion. Criteria marked `[UI]`
additionally require browser and screenshot evidence. Review requires review
evidence. Archive validates and atomically folds the change's requirement deltas
into committed living specifications under
`.empirical/capabilities/<name>/spec.md`; Complex cannot reach Done first.

### Living specifications

Complex changes declare current-behavior changes in small, reviewable files:

```markdown
## ADDED Requirements

### Requirement: Reports can be exported

Reports MUST be exportable in a stable format.

#### Scenario: Successful export

- **WHEN** a user exports a report
- **THEN** the stable export is returned
```

The file lives at
`.empirical/specs/<feature>/deltas/report-export.md`. Empirical rejects ambiguous
adds, modifications, removals, malformed scenarios, and unsafe names before any
living spec changes. Archive preflights all capabilities and rolls back the whole
projection if one write fails. A Specify-time digest also prevents an approved
delta from changing silently before Review and Archive.

This borrows OpenSpec's strongest planning idea without making OpenSpec a runtime
dependency. Empirical keeps its own automatic routing, execution phases, exact
revisions, evidence gates, and npm-only portability. See the
[OpenSpec comparison](https://github.com/MateoCerquetella/empirical-sdd/blob/main/docs/openspec-comparison.md).

### Project context

`.empirical/policy.json` can commit stable domain context and additive phase
guidance for every agent:

```json
{
  "schemaVersion": 1,
  "context": ["Published reports are immutable."],
  "phases": {
    "design": ["Prefer an incremental migration."]
  }
}
```

Policy appears in action packets but cannot turn off mandatory criteria,
artifacts, revision, evidence, review, or archive gates.

### Legacy and advanced compatibility

Quick remains readable and resumable for repositories created by older
versions, but it is not a public choice for new work. The older `start` command
remains a compatibility surface for programs using the current two workflows.
Legacy profile values resume from persisted state but cannot start new work.
JSON output remains available for programs that need machine-readable packets.
Normal users and generated agent guidance do not need any of them.

## Commands

```text
empirical init
empirical adopt
empirical explore "<vague problem>" [--interactive] [--agent codex|none]
empirical explore "<vague problem>" --json|--no-interview
empirical fast "<request>"
empirical complex "<request>"
empirical loop
empirical next
empirical complete --revision N --outcome passed --summary "..."
empirical archive --revision N
empirical status
empirical verify
empirical retry --revision N
empirical workstream list
empirical workstream create <name>
empirical workstream select <name>
empirical capabilities [name]
empirical policy
empirical integrate
empirical doctor
empirical migrate
empirical mcp
empirical update [--check]
```

As an advanced integration surface, `empirical complete` accepts a full result
document from a file or stdin:

```bash
empirical complete --input result.json
empirical complete --input -
```

## MCP tools

The same package exposes these tools through `empirical mcp`:

- `empirical_init`
- `empirical_adopt`
- `empirical_explore`
- `empirical_fast`
- `empirical_complex`
- `empirical_loop`
- `empirical_status`
- `empirical_next`
- `empirical_complete`
- `empirical_archive`
- `empirical_verify`
- `empirical_retry`
- `empirical_workstreams`
- `empirical_capabilities`
- `empirical_policy`
- `empirical_integrate`

`empirical_start` remains available for legacy compatibility. The server uses
stdio and is started on demand by the host. It is not a daemon.

## JavaScript API

Tools and IDEs can embed the exact same engine:

```ts
import { EmpiricalProject } from "empirical-sdd";

const project = await EmpiricalProject.open(process.cwd(), "billing");
const action = await project.complex("Add invoice retries");

// In a later session, resume whichever workflow is active.
const resumed = await project.loop();
```

The package is written in TypeScript, developed and tested with Bun, published
through npm, and runs on Node.js 20 or newer. End users do not need Bun.

## Existing Empirical v1 repositories

Adoption is additive:

```bash
empirical adopt
```

It preserves `ai/`, copies the active specification into the `.empirical/`
store, and defaults adopted work to Complex. Existing Quick state remains
readable and resumable for compatibility.

Schema-1 and schema-2 repositories migrate additively to schema 3 as the
`default` workstream. Their existing `.empirical/state.json`, `events/`, specs,
evidence, and adopted `ai/` content stay in place.

## Updating

```bash
empirical update
empirical integrate
```

The first command installs the latest public npm package. The second refreshes
managed project skills, commands, guidance, and MCP configuration without
replacing unmanaged files. The current engine reads existing schema-1 and
schema-2 state; mutations upgrade it safely. You can perform that non-destructive
schema stamp explicitly before more work begins:

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
