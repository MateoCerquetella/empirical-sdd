# Empirical SDD

Empirical is a small, agent-neutral spec-driven development engine for Codex,
Claude Code, Cursor, Gemini CLI, Windsurf, and any MCP client. It turns a coding
request into an exact, resumable workflow with committed contracts, evidence,
review, living capability specs, and safe Git worktree isolation.

Empirical `0.20.0` is an alpha release. It deliberately uses one active feature
per checkout and real Git worktrees for parallel work.

## Install

```bash
npm install -g empirical-sdd
cd your-repository
empirical init
```

The first interactive init asks once for:

- whether Empirical should offer isolation when another feature is active;
- the detected or edited default Git base;
- the sibling path template, defaulting to `../{repo}-{feature}`;
- the branch pattern, defaulting to `{type}/{feature}`;
- whether Complex features require evidence-backed decision records.

Press Enter to accept each safe default. Edit the answers later with:

```bash
empirical config
```

Automation never waits for terminal input:

```bash
empirical init --defaults
empirical init --isolation ask --base main \
  --worktree-path '../{repo}-{feature}' \
  --branch-pattern '{type}/{feature}' \
  --decisions required
```

## The normal UX

You can use Empirical directly in your agent after project or global skills are
installed. The agent chooses the lane, executes the returned action, completes
the exact revision, and consumes the next action until Done.

```text
vague idea ──> five Socratic passes ──> approved refined contract
                                             │
concrete request ─────────────────────────────┤
                                             ▼
                           Fast or Complex exact workflow
                                             │
                           another feature already active?
                              │ no                  │ yes
                              ▼                     ▼
                         work here         preview Git worktree
                                                    │
                                           explicit approval
                                                    │
                                                    ▼
                                       create, start, show resume
```

Fast is only for explicit, tiny, localized, reversible, low-risk non-UI work.
Everything else—including UI, architecture, public APIs, security, migrations,
and cross-cutting changes—uses Complex.

## Socratic discovery is back

For a genuinely vague idea:

```bash
empirical explore "Build a cooperative browser puzzle with time loops"
```

Empirical asks one question at a time across five passes:

1. primary user and observed problem;
2. smallest observable outcome;
3. boundaries, constraints, and explicit non-goals;
4. failures and solution-changing risks;
5. concrete verification.

It saves every answer under `.empirical/discoveries/`, shows the full refined
contract, and waits for explicit approval before starting Fast or Complex.

Use packet mode for an already-running agent:

```bash
empirical explore "<idea>" --no-interview
empirical explore "<idea>" --json
```

`--agent codex` is an optional human terminal entrypoint after approval. Agent
skills continue in their current runtime and never launch another AI.

## Simple feature demo

Request:

```bash
empirical fast "Add a health command that prints ok"
```

The response is the implementation action and exact completion command:

```text
Empirical · step 1/1

add-a-health-command-that-prints-ok: implement (fast, waiting, revision 1)

Fast lane: implement the generated observable criterion, run one focused test,
review the diff, and complete revision 1.

Complete with: empirical complete --revision 1 --outcome passed \
  --summary "Added the health command" \
  --test "health command test passed" \
  --review "focused diff reviewed"
```

Fast writes everything below one feature directory:

```text
.empirical/specs/add-a-health-command-that-prints-ok/
├── spec.md
├── state.json
├── events/
└── evidence.json                  # after evidenced completion
```

## Complex feature demo

Request:

```bash
empirical complex "Add team invitations with expiration and revocation"
```

The seven gates are:

1. Specify: observable criteria, scope, risks, verification, capability deltas.
2. Design: architecture plus accepted decisions.
3. Plan: executable implementation sequence.
4. Implement: code and focused checks.
5. Verify: criterion-by-criterion evidence; real browser and screenshot for UI.
6. Review: diff, criteria, and accepted-decision alignment.
7. Archive: apply reviewed deltas to living capability specifications.

Each completion response is already the next action:

```bash
empirical complete --revision 1 --outcome passed --summary "Specified invitations"
# edit design.md and decisions.md
empirical complete --revision 2 --outcome passed --summary "Designed invitation ownership"
# continue with the exact commands returned by Empirical
```

A material decision is concise and reviewable:

```markdown
## D-001: Own invitation expiry in the domain service

Status: Accepted

### Evidence
- Existing invitation writes already pass through the domain service.

### Options
1. Expire in the request handler.
2. Expire in the domain service.

### Chosen approach
Use the domain service so API and background jobs share one rule.

### Trade-offs and risks
The service gains time semantics; inject a clock for deterministic tests.

### Verification
Test API and background expiry against the same injected clock.
```

This is a visible decision trail, not persisted private chain-of-thought. Raw
prompts, scratchpads, tokens, credentials, and secrets do not belong there.

## Understand the next action

```bash
empirical explain
empirical explain --json
```

Explain is read-only and reports:

- current feature, phase, status, and revision;
- why the state machine selected the next action;
- required and missing context;
- whether the gate says proceed or stop;
- accepted decision summaries.

MCP clients use `empirical_explain` and receive the same structured fields.

## Parallel work uses Git worktrees

If a different feature is active, Fast or Complex returns a proposal instead of
overwriting state:

```text
Empirical needs an isolated Git worktree (approval required)
Active feature: add-team-invitations
New request: Fix password reset expiry
Workflow/type: complex/fix
Base: main
Base commit: <approved-base-commit>
Branch: fix/fix-password-reset-expiry
Path: /projects/my-app-fix-password-reset-expiry
Command: git worktree add -b fix/fix-password-reset-expiry ... <approved-base-commit>
No mutation has occurred.
```

After approval Empirical:

1. requires the current checkout to be clean, including untracked files;
2. resolves the selected base;
3. rejects existing branches, paths, and registered checkout collisions;
4. runs `git worktree add -b <branch> <path> <approved-base-commit>` without
   `--force`, so the approved base cannot move before creation;
5. initializes or migrates the new checkout;
6. starts the exact request there;
7. returns path, branch, base, feature, revision, and resume command.

Human terminal form:

```bash
empirical worktree create "Fix password reset expiry" \
  --workflow complex --type fix
```

Use `--yes` only after reviewing the rendered proposal in automation. Empirical
never stashes, commits, moves local changes, forces Git, deletes worktrees, or
deletes branches.

## Agent skills and commands

Project-local integrations are installed by `empirical init` and refreshed by:

```bash
empirical integrate
```

Install the five Empirical skills globally for every supported agent:

```bash
empirical integrate --global
```

The skills are `empirical`, `empirical-explore`, `empirical-fast`,
`empirical-complex`, and `empirical-loop`. Native invocation depends on the
agent: `$empirical` in Codex, `/empirical` in Claude Code, and the corresponding
skill/command discovery UX in Cursor, Gemini CLI, and Windsurf.

Generated guidance explicitly tells the current agent to conduct the Socratic
passes, show a worktree proposal, wait for approval, execute creation, maintain
Complex decisions, and consume exact revisions. It never starts another agent.

## CLI reference

```text
empirical init [--defaults|--interactive]
empirical config [--defaults|--interactive]
empirical adopt
empirical explore "<problem>" [--interactive] [--agent codex|none]
empirical fast "<request>"
empirical complex "<request>"
empirical worktree create "<request>" [--workflow fast|complex]
empirical loop
empirical explain
empirical status
empirical complete --revision N --outcome <outcome> --summary "..."
empirical verify
empirical retry --revision N
empirical archive --revision N
empirical capabilities [name]
empirical policy
empirical integrate [--global]
empirical doctor
empirical migrate
empirical mcp
empirical update [--check]
```

Global options are `--root <path>` and `--json`. Legacy Quick can only be
resumed from migrated state; it is never selected for new work.

## MCP tools

The server runs over stdio with `empirical mcp` and exposes:

- discovery/setup: `empirical_explore`, `empirical_init`, `empirical_adopt`,
  `empirical_configure`;
- workflow: `empirical_fast`, `empirical_complex`, `empirical_loop`,
  `empirical_next`, `empirical_complete`, `empirical_retry`,
  `empirical_verify`, `empirical_archive`;
- isolation: `empirical_worktree_propose`, `empirical_worktree_create`;
- understanding: `empirical_explain`, `empirical_status`, `empirical_doctor`;
- project context: `empirical_capabilities`, `empirical_policy`,
  `empirical_integrate`, `empirical_migrate`.

Only `empirical_worktree_create` performs the approved Git mutation. Proposal
and Explain tools are annotated read-only.

## Committed layout

```text
.empirical/
├── config.json
├── policy.json
├── capabilities/<capability>/spec.md
├── discoveries/<discovery>/
│   ├── interview.json
│   └── brief.md
└── specs/<feature>/
    ├── spec.md
    ├── design.md              # Complex
    ├── decisions.md           # Complex when required
    ├── plan.md                # Complex
    ├── deltas/*.md            # Complex behavior changes
    ├── state.json
    ├── state.lock             # ephemeral
    ├── events/*.json
    └── evidence.json
```

Feature state and journals are branch-local. Capability specs, configuration,
and policy are project-wide committed contracts.

## Migration and the 0.20 reset

Schema-1, schema-2, and schema-3 default root state migrates idempotently into
the matching feature directory. Terminal root state does not reserve the
checkout. Historical named parallel-state data is deliberately unsupported and
is not merged; inspect it with the older package before upgrading if needed.

The public alpha version is reset to `0.20.0`. The old `2.0.0`, `2.2.0`,
`2.3.0`, and `2.3.1` package versions are intentionally removed after 0.20.0 is
published and verified. Removed npm version numbers cannot be reused.

See [migration details](docs/migration-v1.md), the [protocol](docs/protocol.md),
the [MCP guide](docs/mcp.md), and the [OpenSpec comparison](docs/openspec-comparison.md).

## Development

```bash
bun install
bun run check
bun test
bun run test:dist
npm pack --dry-run
```

Empirical targets Node.js 20+ at runtime. Bun is used only for development,
tests, and building the published JavaScript package.

License: MIT.
