# Decisions: Harden Migration Scratch Isolation

Record concise, externally reviewable evidence and choices here. Do not store
private chain-of-thought, prompts, credentials, secrets, or scratchpad text.

## D-001: Reserve migration scratch as non-source state

Status: Accepted

### Evidence

- A failed Schema-4 candidate transform left a top-level
  `.empirical.schema5-stage-<id>` directory before any durable marker existed.
- Knowledge inventory, evidence tree hashing, and source overlay logic excluded
  `.empirical` but not its transaction siblings, so the duplicate tree was
  fingerprinted and copied into an independent target.
- The successful Schema-5 repository and migration receipt remained valid; the
  orphan candidate had no recovery authority.

### Options

1. Treat every untracked top-level directory as source and rely on manual cleanup.
2. Reserve the exact `.empirical.schema5-*` prefix for migration transaction
   scratch, clean unmarked candidates on failure, and diagnose unexpected
   survivors read-only.

### Chosen approach

Use the reserved prefix consistently across migration, knowledge, evidence,
integration overlay, and Doctor. A migrator may remove only the exact candidate
it created before marker promotion; Doctor never removes discovered state.

### Trade-offs and risks

Reserved-prefix user files are intentionally outside the product source model.
Exact top-level matching avoids suppressing legitimate nested names. Tests bind
cleanup to owned UUID paths and prove ordinary source still affects digests.

### Verification

Candidate-transform failure leaves only the original Schema-4 directory; scratch
does not alter knowledge or evidence digests or appear in a target overlay; an
orphan produces a stable Doctor finding without a before/after byte change.
