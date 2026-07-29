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
- `src/discovery.ts` owns the five Socratic passes and durable approved briefs.
- `src/integrations.ts` renders project and global native Agent Skills/commands.
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

Each checkout discovers zero or one active feature. `waiting`,
`awaiting_human`, and `blocked` states are resumable; `done` and idle states do
not reserve a checkout. More than one resumable feature is rejected as an
inconsistent repository.

Feature-local state prevents two branches created from the same base from
colliding on a project-global state file. Git worktrees isolate the source tree
and branch. Shared capability projection remains serialized by a project-level
resource lock during Archive.

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
