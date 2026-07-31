# Architecture

Empirical 0.20 is a TypeScript library, Node.js CLI, and stdio MCP server over
one committed `.empirical/` model.

## Modules

- `src/core.ts` owns the workflow state machine, exact revision gates, packets,
  evidence rules, configuration, proposal/handoff orchestration, and Explain.
- `src/storage.ts` owns schema normalization, atomic JSON/text writes,
  feature-scoped journals, locks, recovery, and legacy default-state migration.
- `src/worktrees.ts` owns shell-free Git inspection, proposals, safety checks,
  and exact `git worktree add -b` execution.
- `src/decisions.ts` owns Complex decision templates, validation,
  supersession, and safe summaries.
- `src/specifications.ts` owns capability-delta parsing, validation,
  transactional projection, convergence, and rollback.
- `src/discovery.ts` owns the five Socratic passes, progressive validation,
  durable drafts, and exact approved briefs.
- `src/agents.ts` owns supported-agent detection, launch capability metadata,
  approval-bound handoff options, and integrity tokens.
- `src/agent-catalog.ts` owns the pinned 75-entry skill-install compatibility
  snapshot (73 global targets), aliases, safe native roots, and conservative
  detection hints. It performs no fetch or telemetry.
- `src/checkouts.ts` owns checkout-local feature selection in per-worktree Git
  metadata and cross-checkout claim discovery.
- `src/knowledge.ts` owns the bounded, deterministic, secret-safe repository
  inventory and compact Markdown context set.
- `src/integrations.ts` reconciles canonical selected ids and unique physical
  destinations, records `~/.empirical-sdd/integrations.json`, removes
  marker-owned legacy commands, and preserves project runtime bridges.
- `src/selector.ts` owns the dependency-free searchable, bounded, width-safe
  multi-agent selector.
- `src/setup.ts` owns strict setup defaults, validation, and the shared summary
  model used before private interactive initialization.
- `src/lifecycle.ts` owns the package-update then integration-refresh sequence.
- `src/cli.ts` and `src/mcp.ts` adapt the same core API; they do not implement a
  second workflow.

## Ownership

```text
project
├── config + policy
├── living capabilities
├── discovery records
└── feature
    ├── contract + design + decisions + plan + deltas
    ├── state + exact revision journal + lock
    └── evidence
```

Each checkout selects zero or one active feature through
`<absolute-git-dir>/empirical-sdd/active-feature`. `waiting`, `awaiting_human`,
and `blocked` states are resumable; `done` and idle states do not reserve a
checkout. Recovery ignores features claimed by another registered checkout and
rejects multiple unclaimed candidates instead of guessing.

Feature-local state prevents two branches created from the same base from
colliding on a project-global state file. Git worktrees isolate the source tree
and branch. Shared capability projection remains serialized by a project-level
resource lock during Archive.

## Agent experience and context

Every selected agent receives one automatic skill plus four deliberate SDD
skills. `empirical` owns automatic initialization, context retrieval, resume,
discovery, internal routing, exact transitions, and optional handoff.
`empirical-init` stops after setup, `empirical-spec` and
`empirical-socratic` stop with Specify awaiting contract approval, and
`empirical-loop` resumes selected work through a terminal workflow result. Fast
and Complex remain internal profiles. The public CLI exposes only installation
and update; MCP and the TypeScript API expose workflow operations as automation
primitives.

The global skill catalog, project MCP bridges, and executable handoff registry
are separate compatibility layers. A selected skill-only target receives the
five generated files but gains no inferred command syntax, MCP configuration,
or launch capability. Canonical selected ids are persisted separately from
marker-owned files because several ids share `.agents/skills`,
`.config/agents/skills`, or `.zencoder/skills`. Reconciliation groups normalized
roots and removes a root only when no selected id references it. Current and
legacy names share marker ownership and path-safety checks, so initialization
can remove stale managed local shadows without deleting unmanaged extensions.

Before in-agent initialization mutates a repository, the generated Init
contract renders recommended or current Verification, Parallel work, and
Decisions settings. Apply/Keep, Customize, and Cancel form the first gate;
customization ends with Save/Edit/Cancel. The TypeScript API, MCP tools, and
private CLI carry the same partial evidence, isolation, and decision fields.
All four evidence settings default on. Criterion evidence controls test and UI
sub-gates, while code review remains independent.

Repository knowledge is file-backed under `.empirical/context/`. The generated
manifest includes only normalized paths, sizes, and content digests from a
bounded Git-aware inventory. Agent-maintained topic pages are created once and
preserved. No semantic index or external service participates.

Agent-native Socratic progress is saved after each ordered pass. Approval
derives one deterministic refined request, persists it, and starts internal
Complex with the exact same text. A worktree proposal leaves the record approved
but not falsely started.

Handoff is proposal/authorization, not process execution. A proposal binds the
approved spec digest, feature, target agent, launch capability, cwd, prompt, and
argv into a token. Authorization re-derives all fields. The current host is the
only component that may execute the exact approved argv.

## Transactions

A normal transition:

1. acquires `<feature>/state.lock`;
2. recovers a newer valid journal event when needed;
3. verifies the caller's exact revision;
4. validates immutable contracts and phase gates;
5. prepares any rollback-capable external effect;
6. writes the next event atomically;
7. writes the state projection atomically;
8. removes only the lock instance owned by the caller.

Stale-lock recovery checks age, process liveness, inode/device identity, and an
ownership token. Windows sharing violations are retried within the same bounded
wait.

## Git isolation

A proposal is read-only and resolves request, workflow, type, feature, base,
base commit, branch, absolute path, exact argv, and an integrity token over the
approved fields. Creation requires explicit approval and revalidates the active
feature, base commit, token, cleanliness, and collisions immediately before
invoking Git through an argument array. No shell, force, stash, implicit commit,
cleanup, or deletion path exists.

## Decision traceability

Complex decisions store externally reviewable evidence, options, the accepted
choice, trade-offs/risks, and verification. Design requires a valid accepted
entry; Review revalidates the record and implementation alignment. Supersession
is append-only and reciprocal. Explain derives its rationale from workflow state
and artifact expectations; it never stores or exposes private model reasoning.

## Schema migration

Schema 4 reads schema 1, 2, and 3 configuration/state. A historical default
root state and valid journal are normalized and partitioned beneath the feature
named by each event, then the source projection is removed only after every
destination has been validated and written successfully. The operation is
idempotent and blocks on missing contracts, unassignable events, conflicting
history, or symbolic-link paths. Read-only commands require explicit migration
instead of mutating the project. Historical alternate parallel-state
directories are left untouched and unsupported.
