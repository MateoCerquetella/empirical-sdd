# Empirical SDD

Empirical is an agent-neutral spec-driven development engine for Codex, Claude
Code, Cursor, Gemini CLI, Windsurf, and MCP clients. It turns a coding request
into an exact, resumable workflow with observable contracts, evidence, review,
living capability specifications, and safe Git worktree isolation.

Empirical `0.20.0` is an alpha release. It uses one active feature per checkout
and real Git worktrees for parallel work.

## Install

```bash
npm install -g empirical-sdd
empirical install
```

The registry command installs the version currently published under npm's
`latest` tag. It does not install newer commits from a local checkout. To test
an unreleased Empirical build, run this from the Empirical repository instead:

```bash
npm uninstall -g empirical-sdd
npm install -g .
empirical install
```

If `empirical install` reports `UNKNOWN_COMMAND`, an older published build is
still installed. Do not reinstall `empirical-sdd@latest` until the release that
contains this command has been published; install from the local checkout as
shown above.

`empirical install` works from any directory. It detects supported local agents,
installs exactly one global Empirical entrypoint for each, removes older
Empirical-managed Explore/Fast/Complex/Loop skills, and prints how to reload and
invoke each agent. It does not create repository state or launch an agent.

Then open your repository in a coding agent and use its one Empirical entrypoint:

| Agent | Invocation |
| --- | --- |
| Codex | `$empirical` |
| Claude Code | `/empirical` |
| Cursor Agent chat | `empirical` |
| Gemini CLI | `empirical` |
| Windsurf Cascade | `@empirical` |

To upgrade both the package and installed entrypoints:

```bash
empirical update
```

These are the only normal terminal lifecycle commands. Repository setup and
feature workflow operations happen inside the current coding agent.

## One entrypoint owns the workflow

Ask the installed Empirical entrypoint for repository work in ordinary language.
It deterministically:

1. initializes an uninitialized repository in the current runtime;
2. builds or refreshes compact repository knowledge;
3. resumes non-terminal work already owned by this checkout;
4. uses the original five-pass Socratic interview only when the request is
   genuinely vague;
5. routes an approved, concrete request internally to Fast or Complex;
6. executes exact revisions through evidence, review, and living-spec archive;
7. offers an explicit agent handoff only after a Complex specification exists.

```text
one Empirical invocation
          │
          ├─ repository uninitialized ──> first-run setup + compact context
          ├─ active feature found ──────> resume exact revision
          └─ new request
                ├─ genuinely vague ────> five Socratic passes ──> approval
                └─ concrete ───────────> internal Fast / Complex routing
                                                         │
                                      approved Complex spec exists?
                                                         │
                                  Continue here | Save | Continue in agent
```

Fast is only for explicit, tiny, localized, reversible, low-risk, non-UI work.
Everything else—including UI, architecture, public APIs, security, migrations,
and cross-cutting changes—uses Complex.

## First use and repository knowledge

On first use, the agent initializes `.empirical/`. It applies safe defaults or
asks only questions that materially change Git isolation or Complex decision
policy. It does not install project-local workflow skills.

Initialization also creates a compact, committed context set:

```text
.empirical/context/
├── manifest.json
├── index.md
├── overview.md
├── architecture.md
├── commands.md
└── conventions.md
```

The deterministic manifest contains bounded path, size, and content-digest
metadata—not source contents. Dependency trees, build output, ignored files,
secret-like paths, credentials, binary files, and large files are excluded.
Topic pages are maintained from repository evidence and are not overwritten by
a routine refresh. There are no embeddings, hosted services, or vector database.

## Socratic discovery

For a vague idea such as “make onboarding better,” Empirical asks one question
at a time across five passes:

1. primary user and observed problem;
2. smallest observable outcome;
3. boundaries, constraints, and explicit non-goals;
4. failures and solution-changing risks;
5. concrete verification.

It adds only material follow-ups, saves the answers, presents the complete
refined contract, and waits for explicit approval before creating workflow
state. A concrete request does not pay this discovery cost.

## Small feature demo

In your coding agent:

> `$empirical` Add a health command that prints `ok`.

Empirical recognizes an explicit, localized, low-risk non-UI change and routes
it internally to Fast. The agent inspects only relevant files, implements the
generated observable criterion, runs one focused test, reviews the diff, and
completes the exact revision. The durable result is:

```text
.empirical/specs/add-a-health-command-that-prints-ok/
├── spec.md
├── state.json
├── events/
└── evidence.json
```

You do not choose or invoke a separate Fast command.

## Complex feature demo

In your coding agent:

> `$empirical` Add team invitations with expiration, revocation, and audit
> history. Existing members must keep access during rollout.

Empirical routes the request to Complex and drives seven gates:

1. Specify observable criteria, scope, risks, verification, and capability
   deltas.
2. Design the architecture and record accepted evidence-backed decisions.
3. Plan an executable implementation sequence.
4. Implement the approved contract.
5. Verify every criterion; UI work requires real-browser evidence.
6. Review the diff against criteria and accepted decisions.
7. Archive reviewed deltas into living capability specifications.

After Specify passes, the agent offers:

- Continue here.
- Save for later.
- Continue in a detected agent.

For an external handoff, Empirical displays the target, whether it accepts a
prompt or only a workspace, the exact working directory, and exact argument
array. Detection and Save launch nothing. The command is revalidated and
authorized only after you explicitly approve that exact option.

Decision records store reviewable evidence, options, the selected approach,
trade-offs, risks, and verification—not private chain-of-thought, prompts,
scratchpads, tokens, or credentials.

## Parallel work uses Git worktrees

If a different feature is active, the single entrypoint returns a read-only
worktree proposal instead of overwriting state. It shows the base and immutable
base commit, branch, sibling path, exact Git argument array, and approval token.

After explicit approval Empirical requires a clean source checkout, revalidates
every field, rejects collisions, creates the linked checkout without force, and
starts the exact request there. It never stashes, commits, moves local changes,
deletes worktrees, or deletes branches.

Active selection lives in checkout-local Git metadata while portable feature
contracts remain committed under `.empirical/specs/`. A linked checkout therefore
does not accidentally inherit a blocked feature owned by another checkout.

## Internal automation API

The TypeScript API, low-level CLI operations, and MCP tools remain stable for
agent runtimes, scripts, tests, and migration compatibility. They include setup,
context refresh, discovery, Fast/Complex start, resume, exact completion,
verification, review, archive, status/explain, handoff, capability projection,
and worktree proposal/creation. They are automation primitives, not additional
user-facing workflow commands.

The stdio MCP server exposes these groups:

- setup/context: `empirical_init`, `empirical_adopt`, `empirical_configure`,
  `empirical_context`;
- routing/workflow: `empirical_explore`, `empirical_fast`,
  `empirical_complex`, `empirical_loop`, `empirical_next`,
  `empirical_complete`, `empirical_retry`, `empirical_verify`,
  `empirical_archive`;
- handoff/isolation: `empirical_handoff`, `empirical_worktree_propose`,
  `empirical_worktree_create`;
- understanding: `empirical_explain`, `empirical_status`,
  `empirical_capabilities`, `empirical_policy`, `empirical_doctor`.

Only explicitly approved worktree creation mutates Git. Agent handoff returns an
approval-bound command but never launches it itself.

## Committed layout

```text
.empirical/
├── config.json
├── policy.json
├── context/
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

Feature contracts, journals, context, capability specs, configuration, and
policy are committed. The checkout's selected feature is stored in its own Git
metadata and is not shared across linked worktrees.

## Migration and the 0.20 alpha

Running the installer again is the migration: it removes only marker-owned old
global and project-local Empirical workflow artifacts, preserves unmanaged
content and existing runtime configuration, and converges without unnecessary
second-run changes. Existing schema-4 projects and discovery records remain
readable.

Schema-1, schema-2, and schema-3 default root state migrates idempotently into
the matching feature directory. Historical alternate parallel-state data is
left untouched and unsupported.

See [migration details](docs/migration-v1.md), the [architecture](docs/architecture.md),
the [MCP guide](docs/mcp.md), the [security model](docs/security.md), and the
[OpenSpec comparison](docs/openspec-comparison.md).

## Development

```bash
bun install
bun run ci
```

Empirical targets Node.js 20+ at runtime. Bun is used for development, tests,
and building the published JavaScript package.

License: MIT.
