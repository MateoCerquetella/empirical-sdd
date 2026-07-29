# Implementation plan

1. Extend `src/types.ts` and `src/storage.ts` for schema 3, immutable scoped
   workstream stores, a project workstream manifest, policy, shared resource locks,
   and rollback-capable transaction effects. Cover normalization, migration, and
   concurrent independent state first.
2. Add a focused `src/specifications.ts` module for capability names, delta
   parsing, complete preflight, canonical requirement projection, and reversible
   archive writes. Dogfood four deltas for this feature.
3. Extend `src/core.ts` with pure Explore, workstream management, capability and
   policy reads, explicit packet binding, Complex Archive, and delta validation at
   Specify while preserving Fast/Quick and all evidence gates.
4. Extend CLI and MCP with consistent Explore, workstream, capability, policy, and
   archive interfaces; include explicit `--workstream` in every mutable packet.
5. Refresh generated skills and guidance so users continue to make ordinary
   requests while agents use Explore only for genuine ambiguity and archive every
   reviewed Complex change.
6. Extend unit, MCP, built Node, integration, concurrency, migration, and package
   coverage; update all public documentation and migration guidance.
7. Validate the OpenSpec change strictly, run the complete CI-equivalent suite,
   produce criterion evidence, perform an independent diff review, complete
   Empirical Archive, and publish the clean result.
