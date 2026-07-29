# Fix Intermittent Windows Stale Lock Recovery Eperm

## Request

> Fix intermittent Windows stale-lock recovery EPERM so concurrent clients recover safely and CI is deterministic.

## Goal

Make stale-lock recovery deterministic across supported operating systems without weakening exclusive ownership.

## Acceptance Criteria

- [ ] [AC-1] Concurrent clients that encounter one abandoned stale lock converge on one workflow state and leave no lock or recovery file behind.
- [ ] [AC-2] On Windows, transient `EPERM` or `EACCES` responses while an exclusive lock path is being released are retried within the bounded lock wait instead of escaping as raw filesystem errors.
- [ ] [AC-3] Retrying transient Windows contention does not make permission errors retryable on other platforms or permit a stale owner to delete a newer owner's lock.

## Scope

- Exclusive lock acquisition and stale-lock recovery in `src/storage.ts`.
- Cross-platform lock classification and concurrency regression tests.

## Non-goals

- Changing the on-disk lock format, stale timeout, or workflow revisions.
- Replacing filesystem locks with a service or database.

## Verification

- Run the full local release gate with `bun run ci`.
- Pass the GitHub Actions matrix on Ubuntu, macOS, and Windows.

## Capability Deltas

Create one or more files under deltas/<capability>.md using ADDED, MODIFIED, or
REMOVED Requirements sections, named Requirement blocks, and concrete Scenario
examples. These merge into living specifications
after verification and review.
