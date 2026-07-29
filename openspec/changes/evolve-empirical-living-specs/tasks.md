## 1. Persistence and contracts

- [x] 1.1 Add schema-3 workstream, policy, exploration, capability, delta, and archive types with backward-compatible normalization tests.
- [x] 1.2 Scope state/events/locks by immutable workstream while retaining the default legacy paths, and add atomic manifest/resource-lock operations.
- [x] 1.3 Implement additive initialization and schema-1/schema-2 migration for the default workstream and empty project policy.

## 2. Living specifications

- [x] 2.1 Implement the small ADDED/MODIFIED/REMOVED requirement-delta parser and complete preflight validation.
- [x] 2.2 Implement rollback-capable capability projection updates and exact-revision Archive convergence.
- [x] 2.3 Dogfood the delta format for this change and test valid merges, rejection cases, rollback, and repeated archive.

## 3. Discovery, workstreams, and policy

- [x] 3.1 Implement the read-only Explore packet and prove it performs no repository mutation.
- [x] 3.2 Implement create/list/select/explicit-address workstream behavior and concurrent independent transitions.
- [x] 3.3 Load committed policy and append relevant context/guidance without weakening built-in instructions or gates.

## 4. Public surfaces

- [x] 4.1 Add CLI commands and explicit `--workstream` packet/completion UX for Explore, workstreams, capabilities, policy, and Archive.
- [x] 4.2 Add matching MCP tools and TypeScript exports with consistent schemas and read/mutation annotations.
- [x] 4.3 Update project-local integrations so ordinary requests route through Explore/Fast/Complex and finish Complex through Archive.

## 5. Verification and release quality

- [x] 5.1 Preserve and extend Fast, Complex, Quick, evidence, UI, repair, locking, migration, and integration tests.
- [x] 5.2 Extend built Node and stdio MCP smoke coverage for the new public workflow.
- [x] 5.3 Update README, protocol, architecture, demo, MCP, migration, security, and contribution documentation.
- [x] 5.4 Run typecheck, unit/MCP tests, built Node smoke tests, npm package dry-run, OpenSpec strict validation, and criterion-by-criterion review.
