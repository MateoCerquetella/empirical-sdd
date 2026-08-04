# Plan: Empirical 0.21 Trust, Autonomy, and Delivery

## Execution constraints

- Keep this checkout on Schema 4 until the local Schema-5 migrator and its
  fixtures pass; then migrate once and use the local build for remaining phases.
- Preserve unrelated user files and Git registrations. Never force Git, prune or
  delete real worktrees/branches, bypass protected branches, inspect credentials,
  push, publish, tag, or create a release during this implementation.
- Add behavior behind strict runtime schemas. A test that asserts an exact
  unsafe/safe boundary precedes or accompanies each mutation boundary.
- Maintain a passing type check after each module wave and run focused tests
  before the full suite.

## Task 1: Establish protocol and registry foundations

**Acceptance criteria:** AC-1, AC-4, AC-11, AC-15, AC-17

1. Add `src/protocol.ts` with Schema-5 constants, canonical JSON/digest helpers,
   strict Zod schemas, public types, completion derivation, and stable errors.
2. Add `src/operations.ts` with frozen operation and six-skill registries,
   uniqueness/parity assertions, safety metadata, and help descriptors.
3. Add `src/routing.ts` with ordered request signals, risk floors, Fast
   promotion, normal/YOLO gates, stable rationale codes, and blocker semantics.
4. Add `src/policy.ts` with strict Policy-v2 parsing, safe defaults, command/cwd
   validation, delivery/provider/check validation, preferred-agent validation,
   and policy digest/provenance.
5. Make `src/types.ts` re-export supported protocol types and adapt existing
   imports without exposing new internals.
6. Add table-driven protocol, registry, routing, and policy tests including
   duplicate ids, unknown keys, shell-shaped commands, path escape, timeout
   bounds, risk promotion, authority absence, and exact completion levels.

**Checkpoint:** `bun run check` plus focused tests for protocol/routing/policy.

## Task 2: Build the safe runtime and immutable evidence layer

**Acceptance criteria:** AC-6, AC-7, AC-8, AC-10, AC-19

1. Add `src/runtime.ts` around `spawn` with `shell: false`, exact argv, realpath
   repository containment, timeout cancellation, output caps, environment-key
   allowlisting, output redaction, and injectable adapters/clock.
2. Add executed and collected receipt schemas and canonical receipt ids/digests
   in `src/evidence.ts`; write receipts exclusively and indexes atomically.
3. Bind receipts to repository/spec/policy/tree digests and known unique criterion
   ids; verify artifacts and reject stale, missing, edited, duplicate, unknown,
   empty-provenance, and caller-asserted boolean evidence.
4. Add command-policy execution and integration-validation aggregation that
   produces one receipt per command and an immutable verification summary.
5. Add focused tests for exact argv/cwd, no-shell behavior, timeout, truncation,
   secret redaction/non-persistence, exit/signal handling, executed/collected
   receipts, every tamper dimension, criterion mapping, and stale trees/specs.

**Checkpoint:** focused runtime/evidence tests and type check.

## Task 3: Introduce hash-chained journals and atomic migration

**Acceptance criteria:** AC-16, AC-19

1. Add `src/journal.ts` for genesis, linked event append/read/reduction, state
   before/after digests, terminal-chain validation, snapshot validation, and
   transactional compaction/recovery.
2. Refactor storage mutations to use atomic temp-write/fsync/rename primitives,
   exclusive locks with owner metadata, and injectable fault points for tests.
3. Add `src/migration.ts` with Schema-4 preflight and deterministic transforms
   for config, Policy v2, every feature state/event/evidence file, impact
   manifests, absent authorization, Manifest v2, and migration receipt.
4. Implement config-last promotion with a durable transaction marker, rollback
   payload, roll-forward/rollback recovery, live validation, and idempotency.
5. Add clean/active/terminal/legacy fixtures and interrupt every promotion and
   compaction fault point. Tamper sequence, links, bodies, snapshots, markers,
   staged bytes, and rollback bytes.

**Checkpoint:** all journal and migration tests pass repeatedly; repository is
still Schema 4.

## Task 4: Refactor feature contracts and the state machine

**Acceptance criteria:** AC-2, AC-3, AC-4, AC-5, AC-6, AC-11

1. Add impact-manifest creation/validation to Complex start and Specify:
   behavioral requires named capabilities and complete deltas; non-behavioral
   requires surfaces/rationale and forbids deltas/no-op projections.
2. Enforce stable unique criterion ids and bind spec, manifest, and delta digests
   at Specify completion.
3. Replace transition logic with explicit legal phase tables for Complex and
   contract-neutral Fast, including integrate/deliver/publish skip decisions.
4. Persist bounded YOLO authorization, derive material normal gates and YOLO
   continuation, preserve blocker-only questions, and reject authorization
   widening or hard-floor violations.
5. Remove boolean evidence completion. Verify/Review consume validated receipt
   summaries; status derives exact completion levels and missing reasons.
6. Adapt discovery, decisions, setup, lifecycle, and existing behavior to Schema
   5, preserving their approved user-visible contracts.
7. Add transition, impact, YOLO, hard-floor, criterion, and compatibility tests.

**Checkpoint:** core/discovery/lifecycle/living-spec focused tests pass.

## Task 5: Add shared claims, replay, and integration validation

**Acceptance criteria:** AC-9, AC-10, AC-11, AC-19

1. Add `src/coordination.ts` to resolve Git common-dir identity through exact Git
   argv and keep common state separate from checkout feature files.
2. Implement atomic multi-capability claims, owner/worktree/base digests, live
   overlap detection, stale diagnostics, lease refresh, and safe release after a
   verified integration transaction only.
3. Refactor delta projection into pure parse/replay functions that compare base
   requirement digests and produce semantic conflicts rather than blind writes.
4. Build integration candidates against a freshly resolved target tip in an
   owned temporary validation worktree, apply source safely, run Policy-v2
   verification there, and bind feature/target/candidate/receipt digests.
5. Atomically promote capability projections and integration receipt; rollback
   touched projections and retain claims on every failure.
6. Add linked-worktree tests for disjoint and overlapping claims, stale owners,
   contention, independent target advancement, safe replay, semantic conflict,
   verification failure, rollback, receipt tamper, and exact status.

**Checkpoint:** coordination/integration tests pass across temporary Git repos.

## Task 6: Implement bounded GitHub delivery and explicit publication

**Acceptance criteria:** AC-2, AC-3, AC-11, AC-12, AC-13

1. Add `src/delivery.ts` with authorization validation, state/receipt schemas,
   idempotency markers, provider interface, and injectable clock/runtime.
2. Implement safe Git argv builders for status/add/commit/rev-parse/push and
   GitHub CLI builders for PR discovery/creation/view/checks/normal merge. Reject
   force/admin/destructive/credential-bearing arguments structurally.
3. Implement resumable source commit → push → source PR → checks → protected
   normal merge → merged-base evidence commit → evidence PR → checks → normal
   merge, deriving delivered only from independently queried remote commits.
4. Add publication planning requiring exact explicit version and dist-tag;
   inspect tag/GitHub/npm state, converge identical artifacts, and stop on any
   immutable conflict before mutation.
5. Add fake-runtime/provider tests for every success/retry/failure boundary,
   forbidden argv, branch protection, check timeout/failure, duplicate avoidance,
   missing host permission, no credential capture, absent publication authority,
   identical remote convergence, and immutable conflicts.

**Checkpoint:** delivery tests perform no network or real remote mutation.

## Task 7: Implement Manifest v2 and comprehensive Doctor

**Acceptance criteria:** AC-14, AC-15

1. Upgrade knowledge scanning to source fingerprints, per-page dependencies,
   managed-page digests, freshness inspection, stale/missing states, and
   byte-stable selective refresh.
2. Return fresh pages by default in Explore/action packets and list stale pages
   with an explicit refresh remedy.
3. Add `src/doctor.ts` and read-only checks for schema/migration, journal/snapshot,
   locks/claims, Node/Bun/Git/gh, Policy v2, context freshness, evidence receipts,
   worktree registrations, and delivery records.
4. Emit stable severity/code/scope/message/remediation findings and an overall
   status. Snapshot filesystem/Git state in tests to prove Doctor never mutates.
5. Add page dependency, stale detection, ignored/secret path, selective refresh,
   convergence, packet retrieval, diagnostic code, and non-mutation tests.

**Checkpoint:** knowledge/Doctor focused tests and type check.

## Task 8: Convert transports, skills, CLI help, and package exports

**Acceptance criteria:** AC-1, AC-2, AC-3, AC-17, AC-18

1. Generate MCP tool registration, descriptions, input parsing, and handler
   parity from `OPERATIONS`; preserve MCP-first skill behavior.
2. Generate private internal CLI operation dispatch and public root/install/update
   and subcommand help from the registry. `install --help` and `update --help`
   must exit without prompts or writes; workflow verbs remain rejected publicly.
3. Render and install six skills from `SKILLS`. Add `empirical-yolo` with exact
   input, standing-authorization mutation, blocker-only stop, completion ceiling,
   hard floors, MCP-first calls, and fallback. Replace every hard-coded five/count.
4. Keep installation catalog semantics and unmanaged-file/symlink safety while
   updating marker-owned reconciliation to six registry entries.
5. Add root adapters and `src/protocol.ts`, `src/mcp.ts`, and
   `src/integrations.ts` export surfaces; configure the four package exports and
   build outputs while keeping internals unavailable.
6. Update build/smoke/package scripts and add packed clean-consumer runtime and
   TypeScript import tests plus negative internal-subpath tests.
7. Add registry/MCP/CLI/help/skill/install/update/export parity tests.

**Checkpoint:** check, adapter tests, built smoke, and package-consumer test.

## Task 9: Migrate this repository and finish product documentation

**Acceptance criteria:** AC-14, AC-15, AC-16, AC-18

1. Build the local Schema-5 implementation and run migration preflight/Doctor.
2. Invoke the local migrator once; validate config, Policy v2, Manifest v2,
   active feature, journals, imported receipts, and migration receipt. Do not use
   the installed Schema-4 MCP after promotion.
3. Resume the active feature through local Schema-5 operations and verify its
   spec/manifest/delta/authorization bindings.
4. Update README and generated skill guidance for six workflows, normal vs YOLO,
   hard floors, routing/risk, completion levels, receipts, migration, stale
   context/Doctor, GitHub delivery, and explicit-only release behavior.
5. Set runtime support to Node ≥22 and CI matrices to Node 22/24/26 with a
   balanced OS matrix. Add coverage commands and enforce aggregate line/function
   ≥90% and each source module line ≥80%.
6. Add a docs/version/registry consistency check and remove stale five-skill,
   Schema-4, Node-20, boolean-evidence, or ambiguous completion claims.

**Checkpoint:** migrated local Doctor has no errors; documentation/CI checks pass.

## Task 10: Comprehensive verification, review, integration, and archive

**Acceptance criteria:** AC-1 through AC-19

1. Run formatting/static checks, focused suites, complete suite, coverage gates,
   built smoke, package integrity, clean consumer, migration matrix, repeated
   concurrency tests, and Doctor. Record executed receipts tied to all AC ids.
2. Inspect the entire diff for security, unsafe process/Git behavior, secret
   persistence, state-machine gaps, stale version/count/help/docs strings,
   untested exports, and migration recovery. Fix every actionable finding and
   rerun affected checks.
3. Replay and integrate all behavioral capability deltas against the current
   local target, validate on the independent base, write the integration receipt,
   and confirm precise `integrated` completion.
4. Archive reviewed deltas into living capability specifications and compact the
   terminal journal; rerun Doctor and verify the chain/snapshot boundary.
5. Confirm no push, pull request, tag, GitHub release, npm publish, branch/worktree
   deletion, or force/admin operation occurred. Report local integrated completion
   and explicitly distinguish delivery/publication as unauthorized/not performed.

**Final gate:** all 19 criteria have fresh immutable receipts, all configured
commands and coverage thresholds pass, review has no unresolved findings,
capability projections are integrated and archived, repository state is Schema
5, and the highest truthful completion level is `integrated`.
