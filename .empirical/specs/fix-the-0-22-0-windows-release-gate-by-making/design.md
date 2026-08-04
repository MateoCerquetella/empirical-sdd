# Design: Cross-platform 0.22.0 release gate

## Overview

Fix the failed Windows matrix job at the representation boundaries that differ
by platform, while preserving the semantic and filesystem safety checks that
the tests exercise.

## Capability digest canonicalization

Add one internal Markdown canonicalizer in `src/specifications.ts` that maps
CRLF and lone CR line endings to LF. Apply it before hashing the complete
capability snapshot and each touched requirement in both base capture and
replay, and when validating an existing integration receipt during recovery.
Keep parsing, rendering, requirement names, and semantic content unchanged. A
target with equivalent text therefore matches its source base and immutable
receipt, while any actual content edit still produces a different digest and
conflict.

Add a focused unit test that captures an LF base, replays against the equivalent
CRLF capability, and then proves a semantic target edit is still rejected.

## Portable migration evidence

Normalize the repository-relative receipt returned by migration with forward
slashes at its production boundary. This matches every other persisted or
reported repository path and gives callers one stable value on all platforms.

## Cross-platform test mechanics

- Remove the test-created directory symlink with `unlink`, which targets the
  link itself and avoids Bun's Windows recursive-directory-symlink `rm` fault.
- Assert stale worktree registrations by their stable branch and `prunable`
  records rather than comparing an OS temporary path whose short/long spelling
  and separators may differ while naming the same directory.

These changes do not relax product symlink refusal, Doctor read-only behavior,
or Git registration preservation.

## Verification

Run the focused specification, coordination, migration, core, and Doctor tests;
then the full check, coverage, distribution, package, and consistency gates.
Push one normal follow-up commit to PR #10 and require all five GitHub Actions
matrix jobs, including Windows Node 24, to pass.

## Recovery

If any focused or matrix check still fails, retain the exact failure evidence,
change only the representation boundary responsible, and repush normally. Do
not bypass required checks, force-push, merge, tag, release, or publish npm.
