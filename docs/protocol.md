# Empirical protocol 0.22

## Shared contract

Schema 5 uses strict runtime schemas from `empirical-sdd/protocol`. CLI, MCP,
skills, storage, and the TypeScript API share the same workflow, phase, risk,
receipt, authorization, impact, policy, and completion definitions. Canonical
JSON and prefixed SHA-256 digests make durable documents independently
verifiable.

Every current action is an `ActionPacket` bound to one feature and exact
revision. Its essential fields are:

```json
{
  "kind": "action",
  "protocol": "empirical-sdd",
  "schemaVersion": 5,
  "feature": "add-team-invitations",
  "profile": "complex",
  "mode": "normal",
  "riskFloor": "behavioral",
  "phase": "verify",
  "status": "waiting",
  "revision": 5,
  "completionLevel": { "highest": "implemented" },
  "completion": {
    "available": true,
    "mcpTool": "empirical_complete",
    "requiredFields": ["revision", "outcome", "summary", "receiptIds"]
  }
}
```

All mutations require the exact revision. A stale caller receives
`STALE_REVISION`; it cannot overwrite newer state.

## Routing and modes

Routing calculates the strongest matching floor:

```text
contract-neutral < behavioral < sensitive < migration
                 < integration < delivery < publication
```

Only contract-neutral requests may use Fast. Every other floor promotes to
Complex. Normal and YOLO share the same risk classifier and safety floors.
YOLO additionally records one immutable authorization document bound to the
repository, feature, request digest, ceiling, target branch, agent permission,
and optional expiry. Publication cannot be inferred or granted by YOLO.

## Workflows

Fast is contract-neutral:

```text
implement → done (verified)
```

Complex is contract-bearing:

```text
specify → design → plan → implement → verify → review → integrate
                                                            ├─→ done (integrated)
                                                            └─→ deliver → done (delivered)
```

Delivery exists only when Policy v2 and standing authorization cover it.
Publication is a separate explicit, immutable operation after delivery.
`implemented`, `verified`, `integrated`, `delivered`, and `published` are
derived states; callers cannot assert them directly.

Outcomes are `passed`, `failed`, `awaiting_human`, and `blocked`. Fast failure
promotes the same feature to Complex Specify. Verify or Review failure returns
to Implement within the configured repair limit.

## Impact and capabilities

Complex Specify freezes a digested impact manifest. Behavioral work must name
capabilities and provide valid ADDED, MODIFIED, or REMOVED delta documents.
Non-behavioral work must name no capability and provide a regression rationale.

Behavioral capabilities are claimed below the repository Git common directory,
so linked worktrees see the same ownership. A claim records each capability's
base digest. Integrate replays the reviewed delta against the current target,
detects conflicts, validates the candidate in an independent worktree, commits
the canonical projection transactionally, and writes an immutable receipt.
Direct Schema-4 Archive is retired.

## Evidence receipts

`empirical_evidence_execute` runs one exact Policy v2 argv without a shell.
`empirical_evidence_collect` fingerprints repository-contained artifacts.
Both produce immutable receipts containing criteria, evidence kinds, source
provenance, command or artifact results, timestamps, and a canonical digest.

Completion accepts receipt IDs only. It validates digests, criterion coverage,
required test/review/UI kinds, artifact containment, source binding, and phase
applicability. A copied boolean such as `passed: true` is never evidence.

## Persistence

```text
.empirical/config.json                         # Schema 5
.empirical/policy.json                         # Policy v2
.empirical/context/manifest.json               # Manifest v2
.empirical/capabilities/<capability>/spec.md
.empirical/specs/<feature>/state.json
.empirical/specs/<feature>/impact.json
.empirical/specs/<feature>/evidence/<receipt>.json
.empirical/specs/<feature>/events/snapshot.json
.empirical/specs/<feature>/events/NNNNNNNN.json
```

Events contain sequence, previous-event digest, before/after state digests, and
the resulting state. Terminal completion transactionally promotes a verified
snapshot and retains one linked compaction-boundary event. State JSON remains a
recoverable projection of that authoritative chain.

## Isolation and handoff

An unrelated request returns a read-only worktree proposal bound to the base
commit, branch, path, active feature, and integrity token. Creation requires
literal approval and revalidation. Agent handoff likewise proposes exact cwd,
prompt, argv, capability class, and approval token; Empirical never launches
the process itself.
