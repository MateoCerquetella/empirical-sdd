# Design: Empirical 0.21 Trust, Autonomy, and Delivery

## Design goals

This change turns Empirical from a phase tracker with caller-asserted evidence
into a deterministic workflow protocol with provenance-bound verification,
cross-worktree integration, bounded autonomous delivery, and truthful completion
levels. Schema 5 is intentionally a clean alpha break: public supported surfaces
remain small, while persisted Schema 4 repositories receive an atomic migration.

The design keeps four boundaries explicit:

1. **Intent and authority**: routing decides risk; authorization decides how far
   an agent may proceed. Policy informs both but grants neither.
2. **Execution and evidence**: Empirical executes configured commands through a
   shell-free runtime and stores immutable receipts, or collects existing
   artifacts with independently checked digests.
3. **Feature and integration state**: feature journals remain checkout-local;
   capability claims and integration transactions use the Git common directory.
4. **Local completion and public delivery**: implementation, verification,
   integration, GitHub delivery, and publication are separately derived levels.

## Module layout

The existing modules remain adapters where practical. New behavior is split into
small units with no dependency from protocol primitives back into orchestration.

| Module | Responsibility |
| --- | --- |
| `src/protocol.ts` | Schema-5 constants, Zod runtime schemas, public protocol types, stable digest/canonicalization helpers |
| `src/operations.ts` | Single frozen operation and skill registry used by MCP, private CLI transport, help, integrations, and docs checks |
| `src/routing.ts` | Deterministic request signals, risk-floor promotion, mode and gate decision |
| `src/runtime.ts` | Shell-free process executor, cwd containment, timeout, output bounds, redaction, injectable process adapter |
| `src/evidence.ts` | Executed/collected receipt creation, append-only storage, artifact hashing, receipt and criterion validation |
| `src/journal.ts` | Hash-chained event append/read, snapshot boundary, transactional compaction, recovery |
| `src/migration.ts` | Schema-4 preflight, deterministic Schema-5 transform, transaction marker, rollback/recovery, validation |
| `src/coordination.ts` | Git-common-dir claims, locks, base digests, delta replay, atomic integration receipts |
| `src/delivery.ts` | Authorization ceiling, provider-neutral delivery state, GitHub CLI implementation, publication guard/idempotency |
| `src/doctor.ts` | Read-only diagnostic checks and stable remediation codes |
| `src/policy.ts` | Policy-v2 parsing, repository containment, effective policy and provenance |
| `src/core.ts` | Thin workflow application service and legal state transitions |
| `src/storage.ts` | Atomic repository I/O primitives and feature path resolution |
| `src/knowledge.ts` | Manifest-v2 fingerprints, dependency freshness, managed-page refresh |
| `src/integrations.ts` | Six registry-driven skill templates and safe installation |
| `src/mcp.ts`, `src/cli.ts` | Registry-driven transport adapters only |

`src/types.ts` becomes a compatibility-free re-export of supported protocol
types during the source transition. Internal storage and orchestration types are
not exported from the package.

## Schema 5 protocol

### Project configuration

`.empirical/config.json` remains the setup-oriented document and contains:

- `schemaVersion: 5`
- selected profile and setup completion
- repair limit
- isolation and decision preferences
- legacy migration provenance

Behavioral policy moves to `.empirical/policy.json` Schema 2:

```json
{
  "schemaVersion": 2,
  "context": [],
  "phases": {},
  "verification": {
    "evidence": {
      "required": true,
      "browserForUi": true,
      "screenshotForUi": true,
      "codeReview": true
    },
    "commands": [
      { "id": "ci", "argv": ["bun", "run", "ci"], "cwd": ".", "timeoutMs": 180000 }
    ]
  },
  "delivery": {
    "provider": "github",
    "targetBranch": "main",
    "requiredChecks": []
  },
  "preferredAgent": null
}
```

All objects are strict. Command argv must be a non-empty string array; cwd is
resolved through `realpath` and must remain within the repository; timeout and
output limits have conservative hard maxima. Delivery values are inert until an
authorization record permits their use.

### Routing and authorization

`routeRequest()` consumes normalized request text, explicit requested mode,
repository signals, and validated policy. It emits:

- `profile`: `fast | complex`
- `mode`: `normal | yolo`
- `riskFloor`: `contract-neutral | behavioral | sensitive | migration |
  integration | delivery | publication`
- stable `rationaleCodes`
- material `gates`

Signal evaluation uses ordered, documented rules; the highest risk wins. Fast
is valid only at `contract-neutral`. Callers cannot force a lower result.

A YOLO start writes `authorization.json` with repository identity, feature,
request digest, allowed completion ceiling, optional GitHub target, optional
external-agent scope, creation time, and authorization digest. It does not hold
credentials. An authorization can narrow but never widen the hard safety floor.
Normal mode has no standing authorization and action packets identify each
material human gate.

### Impact manifest

Every Complex feature owns `impact.json`:

```json
{
  "schemaVersion": 1,
  "classification": "behavioral",
  "capabilities": ["workflow-routing"],
  "surfaces": ["MCP", "CLI"],
  "regressionRationale": null,
  "digest": "sha256:..."
}
```

Behavioral manifests require deltas for every named capability. Non-behavioral
manifests require no deltas, non-empty surfaces and regression rationale, and
are rejected if deltas exist. Specify binds the manifest, spec, and delta digest
into state.

### Workflow state and completion

Legal Complex phases are `specify → design → plan → implement → verify → review
→ integrate → deliver → publish → done`. `deliver` and `publish` are skipped when
the authorization ceiling is lower. Contract-neutral Fast uses `implement →
verify → review → done` and cannot create capability projections or delivery
state.

Terminal event facts derive completion:

| Level | Required durable facts |
| --- | --- |
| implemented | passing implementation transition bound to a source tree |
| verified | all configured commands and criterion receipts valid for that tree |
| integrated | target-base replay, integration validation, projection transaction, integration receipt |
| delivered | source and evidence pull requests merged at recorded remote commits |
| published | exact tag, GitHub release, npm version, dist-tag, and clean-consumer receipt converge |

Status reports a `completion` object with booleans, highest level, and reasons.
The state machine never infers a higher fact from a lower one.

## Evidence model

### Receipt forms

An executed receipt stores the exact argv, repository-relative cwd, executable
resolution, timeout, exit/signal status, bounded stdout/stderr digests and safe
tails, started/completed timestamps, spec/tree/policy digests, criteria, and its
own canonical digest.

A collected receipt stores collector identity, artifact paths, media/type
metadata, artifact sizes and SHA-256 digests, collection time, spec/tree digest,
criteria, summary, and receipt digest. The original artifacts stay under the
feature evidence directory.

Receipts are written under `evidence/receipts/<receipt-id>.json` with exclusive
creation. Indexes contain ids and digests only and can be rebuilt. Validation
recomputes canonical and artifact digests, checks criterion ids against the
current spec, requires a non-empty evidence summary and provenance, and rejects
caller-supplied `passed: true` without a receipt.

### Runtime safety

`executeCommand()` uses `spawn(executable, args, { shell: false })`. It accepts
an injectable adapter for deterministic tests. It resolves cwd within the repo,
allows a minimal environment inherited only at execution time, redacts keys and
values matching secret patterns from metadata and captured output, caps each
stream, kills the process on timeout, and never serializes environment values.
Delivery uses the same runtime with explicit Git/GitHub argv builders that reject
`--force`, `--force-with-lease`, `--admin`, credential flags, and destructive
worktree/branch verbs.

## Journals and compaction

Each feature event has a monotonic sequence, prior event digest, canonical body
digest, timestamp, state-before digest, and state-after digest. The first event
references the feature genesis digest. Reading verifies filenames, sequence,
links, bodies, and resulting state.

Compaction writes a candidate snapshot containing the fully reduced state, last
included sequence and digest, and snapshot digest. It then fsyncs the snapshot,
writes a compact transaction marker, atomically promotes the snapshot, appends a
boundary event linked to the previous chain, verifies a fresh read, and only
then removes compacted event files. Recovery uses the transaction marker and
retained candidate/old events to finish or roll back. Terminal history therefore
stays bounded without losing a verifiable boundary.

## Schema-4 migration

Migration runs before any mutating Schema-5 operation:

1. acquire a repository migration lock;
2. preflight every configuration, policy, selected feature, feature state,
   specification, event, evidence, capability, and context file;
3. snapshot the relative paths, bytes, modes, and digests needed for rollback in
   a repository-contained transaction directory;
4. generate all Schema-5 files in a staging directory, including Policy v2,
   Manifest v2, impact manifests, authorization absence, hash-chained journals,
   and legacy evidence import receipts marked `collected-legacy`;
5. validate the staged repository model and record the transform digest;
6. write a durable transaction marker, atomically rename staged files into place,
   update the marker after each rename, and fsync parent directories;
7. validate the live model, write the completion record, then remove rollback
   payloads while retaining a compact migration receipt.

On startup, a marker causes deterministic roll-forward when all next files match
their staged digests, otherwise rollback from saved bytes. Configuration is
promoted last, so Schema-5 readers never observe Schema 5 with unconverted
dependent files. Schema-4 readers are not used after migration starts.

## Shared claims and integration

`git rev-parse --git-common-dir` resolves shared coordination storage. Empirical
uses `<common>/empirical/` for capability claims, integration locks, and delivery
coordination; it never places portable feature content there.

A claim contains feature/repository/worktree identities, base commit and tree,
base capability digests, claimed names, creation timestamp, lease heartbeat,
and digest. Exclusive lock directories serialize updates. Live overlap blocks;
stale ownership is diagnosed against `git worktree list --porcelain` but is not
deleted automatically.

Integration reads the target tip afresh, creates a temporary validation
worktree, applies the feature source commit without force, replays each delta
against current living requirements, writes candidate projections, runs Policy
v2 commands, and creates a receipt binding base, feature, target, delta,
candidate, result, and command receipt digests. Candidate projections and the
receipt promote atomically. Conflicts preserve claims and leave originals
untouched. Temporary validation worktrees created by the current operation may
be removed only after ownership and path identity are revalidated.

## GitHub delivery and publication

The GitHub provider is a deterministic state machine over runtime invocations:

1. validate authorization and clean source state;
2. create or recognize the intentional source commit;
3. push the exact feature ref without force;
4. create or recognize a source PR using an idempotency marker;
5. poll configured required checks with bounded retry;
6. request normal merge (never admin) and record merged commit;
7. prepare integrated evidence/specification changes from that merged base;
8. push and create or recognize the evidence PR;
9. wait, merge normally, and verify both remote commits.

Provider query results, URLs, ids, check conclusions, and safe argv digests become
delivery receipts. Credentials remain owned by Git/`gh` and are never read.

Publication is a separate transition requiring an exact version in both request
and authorization. It first queries Git tag, GitHub release, npm version and
dist-tag. Identical artifacts converge; any mismatch stops. Only absent artifacts
are created in dependency order, each followed by independent verification.
This feature's authorization ceiling is integrated/local, so no publication
operation is invoked during implementation.

## Manifest v2 and Doctor

Manifest v2 records each managed context page, generator id, source paths and
fingerprints, generation digest, and `fresh | stale | missing` status. Inspection
recomputes bounded source fingerprints without writing. Default packets include
only fresh pages and list stale remediation separately. Refresh regenerates only
managed stale/missing pages and converges byte-for-byte.

Doctor calls read-only validators and emits stable findings with `ok | warning |
error`, code, scope, message, and remediation. Checks cover schema/migration,
journal/snapshot, locks/claims, Node/Bun/Git/GitHub tools, Policy v2, knowledge,
receipts, worktrees, and delivery. Doctor never acquires mutation locks, refreshes
context, prunes worktrees, retries delivery, or repairs files.

## Registries, transports, and package boundary

`OPERATIONS` is the frozen source for operation id, public/private visibility,
MCP name/description/schema, internal CLI verb, help, handler key, and permitted
profiles/modes. MCP and private CLI verify at startup that every registry handler
exists once. `SKILLS` similarly defines the six names, description, entry
operation, approval boundary, and renderer. Installation, reports, root/subcommand
help, generated prose anchors, and docs consistency tests consume these registries.

Package exports are:

- `.`: high-level client and stable status/configuration functions;
- `./protocol`: Schema-5 schemas, types, operation metadata safe for callers;
- `./mcp`: MCP server factory/start function;
- `./integrations`: catalog and installer API.

Tests pack the package, install it into a temporary consumer, import/type-check
all four entrypoints, and confirm internal subpaths fail.

## Verification strategy

- Table tests cover every routing signal, risk promotion, mode, phase transition,
  and completion derivation.
- Property-like fixture loops cover canonical receipt/journal digests and tamper
  each field, artifact, sequence, and snapshot boundary.
- Migration fixtures cover clean Schema 4, active Complex state, legacy evidence,
  interrupted promotion at every file, roll-forward, rollback, and idempotency.
- Temporary Git repositories and linked worktrees cover common-dir claims,
  overlap, stale diagnostics, base advancement, safe replay, semantic conflicts,
  lock contention, and transaction rollback.
- Fake process/provider adapters assert exact Git/`gh`/npm argv, timeouts,
  forbidden flags, resumability, check failure, branch protection, and explicit
  publication gating without network mutation.
- CLI/MCP registry parity, six-skill installer convergence, subcommand help,
  Manifest-v2 freshness, Doctor non-mutation, and clean package consumption have
  integration tests.
- CI runs checks on Node 22, 24, and 26 across supported operating systems with
  aggregate line/function coverage ≥90% and per-module lines ≥80%.

## Rollout and repository migration

Implementation first lands Schema-5 readers/writers and migration tests while the
repository remains Schema 4. After the local build passes fixture tests, the new
private migration command migrates this checkout. All subsequent Empirical phase
operations use the local Schema-5 build. The final result is integrated and
archived locally; source push, pull requests, tags, releases, and npm publication
are outside this request and remain untouched.
