# Plan: Cross-platform 0.22.0 release gate

1. Add canonical Markdown hashing in `src/specifications.ts` and focused LF,
   CRLF, and semantic-change replay coverage in `tests/living-specs.test.ts`.
2. Normalize the migration receipt path in `src/migration.ts` and retain the
   exact portable-path assertion in `tests/migration.test.ts`.
3. Replace the Windows-fragile directory-symlink cleanup with `unlink` in
   `tests/core.test.ts`, and replace short/long absolute-path assertions with
   stable Git registration assertions in `tests/coordination.test.ts` and
   `tests/doctor.test.ts`.
4. Run focused affected tests, then `check`, `test:coverage`, `test:dist`,
   `test:package`, and `test:consistency`; preserve immutable receipts.
5. Complete Empirical Implement, Verify, Review, and independent capability
   integration for the exact candidate.
6. Commit and push the fix normally to `agent/release-0.22.0`, then require all
   five checks on draft PR #10 to pass. Do not merge, tag, release, or publish.
