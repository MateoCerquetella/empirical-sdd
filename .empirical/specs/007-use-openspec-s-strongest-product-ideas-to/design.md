# Design: Living specifications and enforced parallel execution

## Architecture

Empirical retains one TypeScript core behind CLI, MCP, and JavaScript surfaces.
Schema 3 adds project-wide workstream metadata, policy, and living capability
specifications while keeping the existing `.empirical/state.json` and `events/`
paths as the additive `default` workstream.

```text
.empirical/
├── config.json
├── policy.json
├── workstreams.json
├── state.json + events/               # default workstream
├── workstreams/<name>/state.json      # independent revision/event chain
├── capabilities/<name>/spec.md        # current behavioral truth
└── specs/<feature>/
    ├── spec.md
    └── deltas/<capability>.md          # proposed requirement changes
```

## Decisions

1. `ProjectStore` receives an immutable workstream identity. Named workstreams
   scope state, events, and locks; config, policy, features, and capabilities stay
   project-wide.
2. `workstreams.json` selection is convenience only. Every new action packet and
   mutation command carries explicit workstream identity. Missing identity remains
   backward-compatible with `default`.
3. Shared spec creation and capability archive use global resource locks before
   acquiring a workstream state lock.
4. Complex Specify validates OpenSpec-style ADDED/MODIFIED/REMOVED requirement
   delta files. Fast and legacy Quick remain delta-free.
5. Complex Review advances to Archive. `archive` is a dedicated exact-revision
   operation that preflights all deltas, installs capability projections through a
   rollback-capable transaction effect, and then marks Done.
6. Explore returns a pure discovery packet and never changes repository state or
   launches a model.
7. `.empirical/policy.json` adds project context and per-phase guidance after
   mandatory built-in instructions; it cannot alter enforcement.
8. Schema 3 reads and migrates schemas 1 and 2 without moving default state,
   events, feature specs, evidence, or adopted `ai/` content.

## Interface additions

- CLI: `explore`, `workstream create|list|select`, `capabilities`, `archive`,
  `policy`, plus global `--workstream`.
- MCP: matching read/mutation tools with optional explicit workstream.
- API: Explore packets, workstream management, capability listing/reading, policy,
  delta validation, and archive.
- Action packets: `workstream`, project context, capability context, and archive
  completion metadata.

## Risks and mitigations

- Delta parsing errors: use a small grammar, full preflight, and focused tests.
- Partial archive: transaction effects capture originals and roll back on failure.
- Workstream races: independent revisions plus explicit packet binding.
- UX overload: keep commands as fallbacks; generated skills drive ordinary requests.
- Dependency creep: OpenSpec stays outside `package.json` and published files.

## Verification strategy

Extend the current unit, MCP, built-Node, concurrency, integration, migration, and
package suites. Add focused coverage for pure Explore, delta rejection and merge,
archive convergence and rollback, workstream selection races, schema-2 migration,
policy precedence, and current Fast/Complex/Quick behavior.
