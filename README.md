# Empirical SDD

Agent-neutral, resumable spec-driven development with deterministic routing,
immutable evidence, safe cross-worktree integration, and six agent-native
skills. Empirical installs across 73 global agent targets and provides verified
guidance for Codex, Claude Code, Cursor, Gemini CLI, Windsurf, and MCP clients.

> Empirical 0.22 is alpha software and intentionally introduces the breaking
> Schema 5 protocol. One checkout selects at most one active feature; linked Git
> worktrees isolate parallel work.

## Install

| Command | Purpose |
| --- | --- |
| `npm install -g empirical-sdd` | Install the CLI. Node.js 22 or newer is required. |
| `empirical install` | Choose coding agents and install all six skills. |
| `empirical update` | Upgrade Empirical and reconcile installed skills. |
| `empirical uninstall` | Remove managed global skills, owned selection metadata, then the global package. |

The installer uses a pinned local catalog. It remembers exact target IDs,
deduplicates shared skill roots, and performs no runtime network fetch or `npx`
execution. Automation can use repeatable `--agent`/`-a`, `--all`, `--yes`, and
`--json` options.

Uninstall is fail-closed: interactive use shows the exact scope and defaults to
cancel, while automation must use `empirical uninstall --yes` (optionally with
`--json`). It removes only marker-owned global artifacts. Project `.empirical`
history, evidence, and repository MCP/agent configuration are always preserved;
unmanaged or unsafe global paths are also preserved and reported.

### Difference from the previous command surface

| Previous 0.21 behavior | Updated behavior |
| --- | --- |
| Public lifecycle exposed Install and Update only. | Public lifecycle also exposes `empirical uninstall`. |
| Removing six agent skills required manual per-agent cleanup. | One command scans every unique catalog root and removes only marker-owned skills. |
| Selection metadata had to be found manually. | Valid Empirical-owned metadata is removed; invalid or user-owned metadata is preserved. |
| Package removal was a separate manual npm command. | Confirmed uninstall runs exact `npm uninstall -g empirical-sdd` last. |
| Project preservation was implicit. | Help, confirmation, human output, and JSON explicitly report preserved project state. |

## Skills

These are coding-agent skills, not public shell workflow commands.

| Skill | Purpose |
| --- | --- |
| `empirical <request>` | Initialize, resume, route, and run in normal mode. |
| `empirical-init` | Initialize or repair repository context without starting work. |
| `empirical-spec <request>` | Draft a concrete Complex contract and stop for approval. |
| `empirical-socratic <idea>` | Run the durable five-pass interview, then draft the contract. |
| `empirical-loop` | Resume the selected feature from its exact current revision. |
| `empirical-yolo <request>` | Run autonomously to an explicit safe completion ceiling. |

Native invocation examples include `$empirical` in Codex, `/empirical` in
Claude Code, and `@empirical` in Windsurf. Reload an agent after installation.

## Trust model

Requests are classified into deterministic risk floors: contract-neutral,
behavioral, sensitive, migration, integration, delivery, or publication. Fast
is available only to contract-neutral work. Every higher floor uses Complex;
wording a risky request as “quick” cannot demote it.

Normal mode asks only when a material product choice or permission is missing.
YOLO persists bounded standing authorization and asks only for genuine blockers
before its authorized ceiling. It never bypasses host permissions or branch
protection, force-writes Git, extracts credentials, deletes real worktrees or
branches, replaces immutable releases, or infers publication.

Fast is contract-neutral and ends at verified. Complex records an impact
manifest and proceeds through Specify, Design, Plan, Implement, Verify, Review,
and independent Integrate. An authorized delivery may continue through two
protected GitHub PRs. Publication is always a separate explicit operation bound
to an exact version, commit, tag, and dist-tag.

Evidence is not a caller-supplied boolean. Empirical either executes a Policy v2
command or collects a content-addressed artifact, then writes an immutable
receipt tied to criteria, source state, and provenance. Completion reports only
the highest proven level: implemented, verified, integrated, delivered, or
published.

## Repository model

Schema 5 stores strict Policy v2 configuration, Manifest v2 knowledge
fingerprints, impact manifests, receipts, Git-common-dir capability claims, and
hash-chained per-feature journals. Terminal journals compact transactionally to
a verified snapshot boundary. `empirical_doctor` diagnoses schema, journal,
lock, claim, toolchain, policy, knowledge, evidence, worktree, and delivery
state without mutating the repository.

Schema 4 repositories migrate atomically on the first mutating 0.22 operation.
The migration validates a complete candidate tree before promotion and retains
a recovery receipt. Earlier schemas must first be upgraded to Schema 4 with the
version that created them.

## Development

Development requires Node.js 22+ and Bun. CI covers Node 22, 24, and 26.

| Command | Purpose |
| --- | --- |
| `bun install` | Install dependencies. |
| `bun run check` | Type-check the source. |
| `bun run test` | Run the test suite. |
| `bun run test:coverage` | Enforce aggregate and per-module coverage gates. |
| `bun run test:dist` | Build and smoke-test the packaged CLI and MCP server. |
| `bun run test:package` | Install and import the generated npm package. |
| `bun run ci` | Run every required gate. |

The package exposes only `.`, `./protocol`, `./mcp`, and `./integrations`.

## Documentation

[Protocol](docs/protocol.md) · [Architecture](docs/architecture.md) ·
[MCP](docs/mcp.md) · [Demo](docs/demo.md) · [Security](docs/security.md) ·
[Migration](docs/migration-v1.md)

## License

[MIT](LICENSE)
