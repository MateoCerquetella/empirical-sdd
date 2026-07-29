## Context

Empirical currently persists one schema-2 workflow projection at
`.empirical/state.json`, one event journal, per-feature specs, and global config.
The CLI, MCP server, and TypeScript API all use `EmpiricalProject` and
`ProjectStore`. See `proposal.md` and the four capability deltas for the desired
behavior.

The design must remain npm-only, preserve existing paths and compatibility, avoid
an OpenSpec runtime dependency, and ensure that convenience selection cannot make
an exact action mutate a different workstream.

## Goals / Non-Goals

**Goals:**

- Add living capability specs without burdening Fast changes.
- Make Complex archive an enforced, revisioned close-the-loop action.
- Support multiple independently revisioned active workstreams additively.
- Expose Explore, workstreams, capabilities, policy, and archive consistently.
- Preserve all current evidence, concurrency, migration, and integration behavior.

**Non-Goals:**

- A generic artifact graph or OpenSpec compatibility layer.
- Cross-repository stores, Git delivery, a UI, or model execution.
- Moving the existing default state or events during migration.

## Decisions

### 1. Keep the existing state as the `default` workstream

The additive layout is:

```text
.empirical/
├── config.json
├── policy.json
├── workstreams.json
├── state.json                  # default workstream, unchanged path
├── events/                     # default journal, unchanged path
├── workstreams/<name>/
│   ├── state.json
│   └── events/
├── capabilities/<name>/spec.md
└── specs/<feature>/
    ├── spec.md
    └── deltas/<capability>.md
```

`ProjectStore` gains an immutable workstream identity. Default uses the legacy
paths; named workstreams use scoped state and event paths. `workstreams.json`
contains the human convenience selection and creation metadata only. Action
packets and mutation commands always carry their explicit workstream, so changing
selection cannot redirect issued work.

Alternative rejected: one large state document containing every workstream. It
would make unrelated work share one revision and one write lock.

### 2. Use separate state locks plus global resource locks

Each workstream keeps its own state lock and revision sequence. Creation and
selection use a manifest lock. Feature/spec creation uses a global specs lock,
and archive uses a global capability lock. Lock ordering is global resource first,
then workstream state, preventing two workstreams from racing on shared files.

### 3. Treat living specifications as current behavior and deltas as proposed behavior

Complex Specify requires one or more files under `deltas/`. Delta files use the
small OpenSpec-compatible subset `ADDED`, `MODIFIED`, and `REMOVED Requirements`,
with named requirement blocks and concrete scenarios. Archive preflights every
operation against all current capability specs before writing any file.

Fast does not require deltas. Legacy Quick remains resumable without them. This
preserves proportional ceremony.

### 4. Add an explicit Archive phase and operation

Complex becomes:

```text
Specify → Design → Plan → Implement → Verify → Review → Archive → Done
```

Archive is not a normal `complete`; its CLI/API/MCP operation applies deltas and
advances the exact reviewed revision. Repeating archive after Done is a read-only
convergent response.

Capability updates are prepared in memory, then installed through a transaction
effect that returns a rollback function. If event or state projection fails, the
effect restores prior capability files before releasing locks.

### 5. Explore is a pure packet, not persisted workflow state

Explore validates a non-empty problem and returns investigation steps, decision
questions, project context, relevant capability paths, and Fast/Complex next
actions. It performs no mutation and launches no agent. This matches OpenSpec's
no-stakes discovery benefit without confusing exploration with resumable work.

### 6. Policy is additive data, never executable control

`.empirical/policy.json` contains arrays of project context and per-phase guidance.
Built-in instructions are always rendered first; policy is appended and cannot
change phase sequences, evidence requirements, revisions, or stop conditions.

Alternative rejected: arbitrary workflow schemas in this revision. They would
multiply migration and enforcement states before the core product model is proven.

### 7. Schema 3 is read-compatible and migrates additively

The engine reads schemas 1, 2, and 3. Migration stamps config/state, creates the
default workstream manifest and empty policy, and retains all existing paths and
content. Normal mutation performs the same safe upgrade. Named workstreams are
created directly at schema 3.

## Risks / Trade-offs

- **Capability merge correctness** → Parse a deliberately small Markdown grammar,
  preflight all deltas, test malformed/duplicate/missing operations, and rollback
  installed projections if the state transaction fails.
- **Shared resource deadlocks** → Use one documented lock order and never acquire a
  global resource lock while already holding a state lock.
- **More concepts harm the simple UX** → Ordinary requests still auto-select;
  Explore appears only for genuine ambiguity, Fast remains one pass, and workstream
  commands are advanced/manual fallbacks.
- **Policy could contradict safety** → Append policy after mandatory instructions
  and keep all enforcement in code.
- **OpenSpec artifacts duplicate Empirical specs in this repository** → Treat
  OpenSpec as project-development planning and Empirical as its own runtime format;
  package contents exclude both stores.

## Migration Plan

1. Ship schema-3 readers before emitting schema-3 mutations.
2. On init/migrate/first mutation, create `workstreams.json` with `default` and an
   empty `policy.json`; retain existing state/events/specs in place.
3. Existing action packets without workstream continue to target `default`.
4. New packets and generated commands include explicit identity.
5. Rollback to the prior package remains possible for untouched default workflows;
   prior engines reject schema 3 once new features are used.
