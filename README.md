# Empirical SDD

Empirical is an agent-neutral, spec-driven development engine for Codex, Claude
Code, Cursor, Gemini CLI, Windsurf, and MCP clients. It turns a coding request
into a durable contract, exact workflow revisions, verification evidence,
review, and living capability specifications.

Empirical `0.20.2` is an alpha release. It supports one active feature per
checkout and uses real Git worktrees for isolated parallel work.

## Install

```bash
npm install -g empirical-sdd
empirical install
```

`empirical install` opens a multi-select list of supported coding agents.
Detected agents and existing managed installations are selected by default.
Use Up/Down, Space, `a`, and Enter to submit the exact selection.

Every selected agent receives five global skills:

| Intent | Skill |
| --- | --- |
| Automatic setup, routing, and execution | `empirical` |
| Initialize or repair this repository only | `empirical-init` |
| Draft a concrete specification and stop | `empirical-spec` |
| Run the five-pass interview, draft, and stop | `empirical-socratic` |
| Resume the approved specification to completion | `empirical-loop` |

The installer removes only marker-owned Empirical skills from agents you
deselect. It preserves unmanaged files, directories, symbolic links, and
unrelated settings. It works from any directory and does not create repository
state or launch an agent.

For unattended installation:

```bash
# Exact selection; repeat -a/--agent
empirical install --agent codex --agent cursor

# Every supported agent
empirical install --all

# Detected agents plus existing managed installations
empirical install --yes
```

Restart or reload the selected agent after installation. Native invocations are:

| Agent | Automatic | Init | Spec | Socratic | Loop |
| --- | --- | --- | --- | --- | --- |
| Codex | `$empirical` | `$empirical-init` | `$empirical-spec` | `$empirical-socratic` | `$empirical-loop` |
| Claude Code | `/empirical` | `/empirical-init` | `/empirical-spec` | `/empirical-socratic` | `/empirical-loop` |
| Cursor Agent | `empirical` | `empirical-init` | `empirical-spec` | `empirical-socratic` | `empirical-loop` |
| Gemini CLI | `empirical` | `empirical-init` | `empirical-spec` | `empirical-socratic` | `empirical-loop` |
| Windsurf Cascade | `@empirical` | `@empirical-init` | `@empirical-spec` | `@empirical-socratic` | `@empirical-loop` |

To upgrade the package and refresh every selected skill:

```bash
empirical update
```

`empirical install` and `empirical update` are the entire public terminal CLI.
Init, Spec, Socratic, and Loop are coding-agent skills, not shell commands.
Internal workflow operations remain available to installed skills through MCP
and a private compatibility transport.

## Choose automatic or deliberate mode

Both modes use the same state machine, artifacts, evidence gates, and safety
rules.

```text
Automatic
  empirical request
      └─ setup/repair → resume or discover/route → execute → verify → review → done

Deliberate SDD
  empirical-init
      └─ empirical-spec request ──────────────┐
      └─ empirical-socratic idea → interview ├─ review contract → empirical-loop → done
                                             ┘
```

Use `empirical` when you want the agent to choose the right path and keep going.
Use the explicit skills when you want to inspect the specification before any
implementation begins. Fast and Complex are internal profiles; users do not
need separate skills for them.

## Initialize a repository

Inside the repository, invoke the Init skill in your coding agent. For Codex:

> `$empirical-init`

Init inspects manifests, documentation, source, tests, Git state, existing
Empirical configuration, and living capabilities. It asks one focused question
at a time only when the answer changes:

- whether unrelated active work should use a sibling Git worktree;
- the base branch, worktree path, and branch pattern;
- whether Complex decisions require reviewable decision records.

It then creates or repairs `.empirical/`, installs repository MCP bridges,
refreshes compact context, confirms `setupComplete: true`, and stops. It does not
create a feature or specification.

You can skip explicit Init and invoke `$empirical` directly; the automatic skill
performs the same preflight first. A partial schema-4 repository—such as one with
`setupComplete: false` or missing `.empirical/context/`—is repaired rather than
mistaken for a complete setup. Marker-owned old project-local skills are removed
so they cannot shadow global updates; unmanaged collisions are preserved and
reported.

Initialization creates:

```text
.empirical/context/
├── manifest.json
├── index.md
├── overview.md
├── architecture.md
├── commands.md
└── conventions.md
```

The deterministic manifest contains bounded path, size, and digest metadata,
not source contents. Dependencies, build output, ignored files, secret-like
paths, credentials, binaries, and large files are excluded. There are no
embeddings, hosted RAG services, or vector databases.

## Explicit Spec: a small concrete feature

In Codex:

> `$empirical-spec` Add a keyboard shortcut that opens the existing command
> palette with Cmd/Ctrl+K. Do not change the palette design.

Spec ensures the repository is initialized, starts internal Complex Specify,
inspects the relevant code and living capabilities, and writes observable
acceptance criteria, scope, non-goals, risks, verification, and capability
deltas. It then stops. No implementation code is written and the pending
Specify revision is not completed.

Review the files under `.empirical/specs/<feature>/`. When the contract is right:

> `$empirical-loop`

That invocation is explicit approval to complete Specify and continue through
Design, Plan, Implement, Verify, Review, and Archive.

## Explicit Socratic: a complex or vague feature

In Codex:

> `$empirical-socratic` Build a team notification center that works well across
> desktop and mobile.

Socratic asks one question at a time across the original five passes:

1. primary user and observed problem;
2. smallest observable outcome;
3. boundaries, constraints, and explicit non-goals;
4. failure behavior and solution-changing risks;
5. concrete verification.

It reflects each answer, asks only a material follow-up, and saves progress after
every pass. After all five, it displays one exact refined request. Rejecting or
saving creates no workflow state. Approving binds that exact request to Complex
Specify, drafts the specification and capability deltas, and stops again for
contract review.

After reviewing the draft:

> `$empirical-loop`

## Automatic demos

For a tiny, localized, reversible, low-risk, non-UI change:

> `$empirical` Add a health command that prints `ok`.

Empirical routes internally to Fast, implements the criterion, runs focused
tests, reviews the diff, and completes the exact revision.

For a substantial feature:

> `$empirical` Add team invitations with expiration, revocation, and audit
> history. Existing members must keep access during rollout.

Empirical routes to Complex and drives seven gates:

1. Specify observable behavior and capability deltas.
2. Design the solution and record accepted evidence-backed decisions.
3. Plan an executable implementation sequence.
4. Implement the approved contract.
5. Verify every criterion; UI work requires real-browser and screenshot evidence.
6. Review the diff against criteria and decisions.
7. Archive reviewed deltas into living capability specifications.

For a genuinely vague automatic request, Empirical uses the same durable
five-pass Socratic operation before routing. A concrete request does not pay that
discovery cost.

## Resume safely with Loop

`empirical-loop` takes no new feature request. It asks Empirical for the selected
action, completes its exact revision with required artifacts and evidence, and
continues until Done, Blocked, or Awaiting Human.

If no feature is selected, Loop creates nothing and points to Automatic, Spec,
or Socratic. Attached text never replaces active work. If another feature is
already active, starting unrelated work returns a read-only worktree proposal
instead of overwriting state.

## Worktrees and agent handoff

An isolation proposal shows its base and immutable base commit, branch, sibling
path, exact Git argument array, and approval token. Empirical waits for explicit
approval, requires a clean source checkout, revalidates every field, rejects
collisions, and creates the linked checkout without force. It never stashes,
commits, moves local changes, deletes worktrees, or deletes branches.

After a Complex specification passes, Automatic or Loop offers:

- Continue here.
- Save for later.
- Continue in a detected agent.

Detection and Save launch nothing. Before external handoff, Empirical displays
the agent, its prompt/workspace capability, cwd, and exact argv; it authorizes
only the unchanged option after explicit approval.

Active selection lives in checkout-local Git metadata. Portable feature
contracts remain under `.empirical/specs/`, so a linked checkout does not inherit
a blocked feature owned by another checkout.

## Internal automation API

The TypeScript API and MCP server expose the primitives used by installed
skills. They are not additional public terminal commands.

- Setup/context: `empirical_init`, `empirical_adopt`, `empirical_configure`,
  `empirical_context`.
- Discovery/routing: `empirical_explore`, `empirical_discovery`,
  `empirical_fast`, `empirical_complex`.
- Workflow: `empirical_loop`, `empirical_next`, `empirical_complete`,
  `empirical_retry`, `empirical_verify`, `empirical_archive`.
- Handoff/isolation: `empirical_handoff`, `empirical_worktree_propose`,
  `empirical_worktree_create`.
- Understanding: `empirical_explain`, `empirical_status`,
  `empirical_capabilities`, `empirical_policy`, `empirical_doctor`.

Generated skills use MCP first and `empirical __internal` only as a private
fallback when MCP is unavailable. Humans should not invoke that namespace.

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

Specifications, decisions, journals, context, capabilities, configuration, and
policy are durable, reviewable state. Decision records contain evidence,
options, the chosen approach, trade-offs, risks, and verification—not private
chain-of-thought, prompts, tokens, credentials, or scratchpads.

## Migration and development

Running `empirical install` again migrates global integrations. Repository Init
removes only marker-owned old local skills and repairs partial setup. Both
operations converge, preserve unmanaged content, and keep schema-4 projects and
discovery records readable.

Schema-1 through schema-3 root state migrates idempotently into feature-local
state. Empirical v1 `ai/` adoption remains available through agent automation.

See [migration details](docs/migration-v1.md), the
[architecture](docs/architecture.md), [MCP guide](docs/mcp.md),
[security model](docs/security.md), [demos](docs/demo.md), and
[OpenSpec comparison](docs/openspec-comparison.md).

```bash
bun install
bun run ci
```

Empirical targets Node.js 20+ at runtime. Bun is used for development, tests,
and building the published JavaScript package.

License: MIT.
