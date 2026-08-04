# Decisions: Empirical 0 21 Trust Autonomy And Delivery Overhaul

Record concise, externally reviewable evidence and choices here. Do not store
private chain-of-thought, prompts, credentials, secrets, or scratchpad text.

## D-001: Make Schema 5 one intentional alpha break

Status: Accepted

### Evidence

- The repository persists Schema 4 in configuration and feature state.
- The requested changes alter state, evidence, routing, integration, policy,
  knowledge, public exports, and terminal phases together.
- The user explicitly selected one major change and stated compatibility is not
  important, while requiring an atomic migration of existing repository state.

### Options

- Incrementally extend Schema 4 and preserve all public/internal shapes.
- Introduce Schema 5 once, migrate Schema 4 atomically, and narrow supported APIs.

### Chosen approach

Introduce Schema 5 once. Maintain compatibility only through the persisted-state
migrator, not through undocumented TypeScript internals.

### Trade-offs and risks

The diff and migration are larger and must avoid mixed state. A staged transform,
durable transaction marker, rollback payload, config-last promotion, and fixture
tests mitigate interruption. The benefit is one coherent invariant set rather
than multiple temporary schemas.

### Verification

Clean and active Schema-4 fixtures migrate byte-deterministically; interrupted
promotions recover; Schema-5 validation passes; undocumented package subpaths are
unavailable from a clean consumer.

## D-002: Separate routing, mode, and authorization ceiling

Status: Accepted

### Evidence

- The current `fast`/`complex` selection does not express risk floors or standing
  authorization.
- The requested YOLO behavior is maximum autonomy but retains non-negotiable
  host, Git, credential, branch-protection, deletion, and publication floors.

### Options

- Treat YOLO as a third profile with implicit authority.
- Keep Fast/Complex profiles, add normal/YOLO mode, and persist an explicit
  authorization ceiling independently.

### Chosen approach

Use deterministic risk routing for profile selection, mode for gate behavior,
and a digest-bound authorization record for the maximum completion level.

### Trade-offs and risks

Packets carry more fields, but cannot confuse complexity with authority. Policy
defaults remain useful without silently granting remote or release mutations.

### Verification

Routing table tests prove risk promotion and determinism; authorization tests
prove normal/YOLO behavior and every hard safety floor.

## D-003: Replace asserted booleans with immutable receipts

Status: Accepted

### Evidence

- Schema 4 accepts caller-provided `passed: true` evidence and only checks that a
  screenshot path exists.
- The approved contract requires command/artifact provenance, tree/spec binding,
  staleness detection, and deterministic tamper failure.

### Options

- Add more fields to mutable evidence arrays.
- Store append-only executed and collected receipts with canonical digests and
  rebuildable indexes.

### Chosen approach

Use exclusive-created receipt files bound to spec, tree, policy, criteria,
provenance, outputs/artifacts, and a canonical SHA-256 digest.

### Trade-offs and risks

Evidence occupies more files and legacy evidence cannot gain missing provenance.
Migration labels it as legacy collection and new gates require fresh receipts.

### Verification

Tamper matrices mutate receipt fields and artifacts; stale tree/spec tests fail;
real shell-free command receipts pass only with exact criteria and provenance.

## D-004: Coordinate capabilities through Git common state and replay

Status: Accepted

### Evidence

- Checkout-local `.empirical` lock paths do not coordinate linked worktrees.
- Capability deltas currently apply against the feature's original projection,
  so an independently advancing target can invalidate them.

### Options

- Serialize all repository work in one checkout.
- Use Git common-directory claims and replay deltas against a fresh target under
  an integration transaction.

### Chosen approach

Share only claims/locks/delivery coordination in the Git common directory;
retain portable feature state in each checkout; integrate by digest-bound replay.

### Trade-offs and risks

Git coordination and recovery are more complex. Atomic claim files, lock owner
diagnostics, preserved claims on conflict, validation worktrees, and projection
rollback keep failures recoverable without deleting real user work.

### Verification

Multi-worktree tests cover disjoint/overlap claims, stale registrations, target
advancement, semantic conflicts, contention, receipts, and rollback.

## D-005: Deliver with a two-pull-request GitHub state machine

Status: Accepted

### Evidence

- Integration evidence and living-spec changes become authoritative only after
  source behavior is validated against the actual target.
- The user selected GitHub delivery with green-CI merge, but explicitly excluded
  publication and release creation from this implementation request.

### Options

- Put source and generated evidence in one pull request.
- Merge verified source first, then submit integration evidence/spec projections
  from the merged base in a follow-up pull request.

### Chosen approach

Implement the resumable two-PR provider flow with normal protected merges,
idempotency markers, check polling, and a separate explicit publication ceiling.
Do not invoke remote delivery or publication while implementing this feature.

### Trade-offs and risks

Two PRs add latency but make evidence provenance honest. Fake provider tests
cover the flow without mutating GitHub; real remote actions require separate
exact authorization and available host permissions.

### Verification

Adapter tests assert exact non-shell argv, no force/admin flags, remote-state
convergence, failed checks, resumability, and zero publish calls absent versioned
release authorization.

## D-006: Centralize runtime schemas and operation/skill metadata

Status: Accepted

### Evidence

- MCP tools, CLI handling, skill templates, reports, and docs currently repeat
  operation names and a hard-coded five-skill count.
- Public package exports expose only root today, while internal source types are
  coupled through large modules.

### Options

- Patch every adapter independently.
- Create frozen operation and skill registries plus shared Zod protocol schemas,
  then generate adapter/help/installer surfaces and narrow exports.

### Chosen approach

Use a single operation registry and six-entry skill registry. Export only root,
`./protocol`, `./mcp`, and `./integrations`; keep storage/runtime internals private.

### Trade-offs and risks

Registry handlers need startup parity checks and generated prose still requires
human-readable renderers. Parity/docs tests prevent drift.

### Verification

Registry parity tests enumerate MCP and private CLI operations, installer tests
derive six outputs, all subcommand help exits cleanly, and a packed clean consumer
accepts supported imports while rejecting internal subpaths.

## D-007: Use hash chains and transactional compaction

Status: Accepted

### Evidence

- Existing terminal feature histories accumulate event files and do not provide
  chain integrity or a compact verifiable boundary.
- The repository already contains hundreds of Empirical files and long-lived
  feature history must remain bounded and diagnosable.

### Options

- Keep all independent events forever.
- Periodically replace old events with a state snapshot only.
- Hash-chain events and compact them transactionally around a verified snapshot
  boundary while retaining recovery material until commit.

### Chosen approach

Use linked event digests, state-before/after digests, a signed-by-digest snapshot,
a boundary event, and a recoverable compaction transaction marker.

### Trade-offs and risks

Canonicalization bugs can invalidate history, so one shared canonical JSON
implementation is used by journals, receipts, manifests, claims, and delivery.

### Verification

Sequence/link/body tamper tests, interrupted compaction at each boundary, replay
from snapshot, and Doctor chain diagnostics prove integrity and recovery.

## D-008: Make knowledge freshness and Doctor read-only facts

Status: Accepted

### Evidence

- Current context refresh updates a manifest but generated pages can remain stale
  without packets distinguishing that state.
- Existing Doctor summarizes configuration/runtime but does not audit journals,
  claims, receipts, worktrees, or delivery and must not perform cleanup.

### Options

- Refresh context automatically whenever it is read and repair diagnostics inline.
- Inspect fingerprints and health without mutation; make refresh/repair explicit.

### Chosen approach

Manifest v2 exposes source-to-page fingerprints and freshness. Action packets use
fresh pages by default. Doctor aggregates read-only validators with stable codes
and remediation text.

### Trade-offs and risks

Agents may need an explicit refresh before acting, but never consume silently
stale guidance or experience surprise repository mutation from diagnostics.

### Verification

Source-change fixtures mark only dependent pages stale, refresh converges, packet
retrieval excludes stale pages, and before/after snapshots prove Doctor makes no
filesystem, Git, process, or remote changes.
