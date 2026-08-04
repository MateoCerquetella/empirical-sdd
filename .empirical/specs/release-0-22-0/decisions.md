# Decisions: Release 0 22 0

Record concise, externally reviewable evidence and choices here. Do not store
private chain-of-thought, prompts, credentials, secrets, or scratchpad text.

## D-001: Publish the complete candidate as 0.22.0

Status: Accepted

### Evidence

- The user explicitly asked to push a new minor after approving all preceding
  improvements and the safe uninstall implementation.
- The repository manifest is `0.21.0`, while npm `latest` is `0.20.4`; `0.22.0`
  is absent from npm, local/remote Git tags, and GitHub releases.
- The inspected candidate contains 242 changed paths: 6,226 additions and
  11,160 deletions, dominated by Schema 5 journal compaction/migration plus the
  reviewed source, test, documentation, and capability changes.
- Two uninstall CI receipts and its independent integration receipt pass; other
  included overhaul and migration features also retain durable receipts.

### Options

1. Publish only the uninstall files and leave the interdependent Schema 5
   candidate unshipped.
2. Publish the complete intended candidate as the next minor release.
3. Push an unversioned branch without creating a coherent release.

### Chosen approach

Use option 2. Freeze the complete inspected candidate, bump every version
surface to `0.22.0`, validate it as a unit, deliver through protected source and
evidence pull requests, then bind the merged source commit to npm, tag, and
GitHub release only after immutable conflict checks.

### Trade-offs and risks

The release diff is intentionally large because it includes the one-time Schema
5 migration and compacted histories. That increases review cost, mitigated by
durable feature receipts, full cross-platform CI, explicit PR file inspection,
and clean-consumer verification. Local npm authentication is currently absent;
publication must stop at npm rather than weakening or fabricating authority if
no trusted publishing route is available.

### Verification

Prove exact version convergence, full CI, package allowlist, protected PR check
rollups, immutable tag/release/package identity, clean registry consumption,
and final Doctor/Git synchronization. Record failure honestly at the first
unavailable authority boundary.
