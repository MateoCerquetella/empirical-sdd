# Design

## Failure mechanism

After a stale lock is unlinked, Windows can briefly keep the pathname deletion-pending while another handle closes. A concurrent `open(path, "wx")` then returns `EPERM` (or, depending on filesystem policy, `EACCES`) instead of the `EEXIST` used for ordinary contention. The current acquisition loop throws every non-`EEXIST` error immediately.

## Approach

Classify exclusive-open errors through one small platform-aware predicate:

- `EEXIST` remains retryable on every platform and continues to drive stale-lock inspection.
- `EPERM` and `EACCES` are retryable only on Windows and only inside the existing five-second bounded acquisition loop.
- Every other error remains immediate.

When stale-lock inspection itself races with deletion or replacement, fall through to the same bounded delay instead of spinning without a deadline check. Ownership comparison, recovery-token locking, heartbeat behavior, and compare-before-remove cleanup remain unchanged.

## Verification strategy

Keep the existing end-to-end tests for concurrent stale recovery and superseded-owner safety. Add deterministic unit coverage for the error classifier so Windows sharing violations and non-Windows permission failures cannot regress. The GitHub Actions Windows job provides the real filesystem integration signal.

## Risks

- Retrying a true Windows ACL denial delays its final error by at most the existing lock timeout and reports project contention; the retry is deliberately Windows-only.
- Broad retry logic could conceal unexpected failures, so accepted codes and the total wait remain narrowly bounded.
