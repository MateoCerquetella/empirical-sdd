# Decisions: Fix The 0 22 0 Windows Release Gate By Making

Record concise, externally reviewable evidence and choices here. Do not store
private chain-of-thought, prompts, credentials, secrets, or scratchpad text.

## D-001: Canonicalize at stable boundaries

Status: Accepted

### Evidence

- Windows CI checked the fixture's source capability with LF line endings into
  an independent worktree as CRLF. Requirement byte hashes then reported a
  false semantic integration conflict in three downstream assertions.
- Git reported the same Windows temporary worktree with long names and forward
  slashes while Node supplied a short-name path with backslashes.
- Bun refused recursive `rm` of the test-created Windows directory symlink with
  `EFAULT`, although the product had already rejected the unsafe destination.
- Migration returned `relative(...)` directly, producing backslashes on
  Windows for an otherwise repository-portable receipt identifier.

### Options

1. Force one Git checkout configuration and keep raw byte/path comparisons.
2. Change only tests to hide the platform differences.
3. Canonicalize line endings and reported repository paths at production
   boundaries, while making filesystem test setup and assertions identity-safe.

### Chosen approach

Use option 3. Normalize Markdown line endings only before stable snapshot and
requirement hashing, normalize migration report separators, unlink the symlink
fixture directly, and assert stale registration metadata rather than an
unstable spelling of the same absolute path.

### Trade-offs and risks

CRLF-only historical base digests will canonicalize to the same value as LF,
which is the intended semantic identity but changes the raw-byte interpretation
for those files. Focused tests must prove real content changes still conflict.
Stable branch/prunable assertions prove registration preservation without
asserting an incidental path representation. No safety check is removed.

### Verification

Prove equivalent LF/CRLF replay and semantic-conflict rejection in unit tests,
prove the exact portable migration receipt, run the affected safety suites,
then require the full Linux/macOS/Windows release matrix to pass on the pushed
commit.

## D-002: Remote matrix evidence is distinct from local CI

Status: Accepted

### Evidence

- Receipt `executed-804b395e6c2a7014d9add5c3` ran the configured local
  `bun run ci` command successfully, but it cannot establish the state of a
  GitHub-hosted Windows, macOS, or Linux runner.
- Independent Review rejected treating that local receipt as complete AC-4
  evidence and routed revision 6 back to Implement, which cleared it from the
  active verified completion state while preserving the immutable record.

### Options

1. Treat local CI as a proxy for the remote matrix.
2. Push the exact code candidate to the existing draft PR and capture the
   provenance-bound GitHub Actions result before Verify passes.

### Chosen approach

Use option 2. Keep the first receipt as local test evidence only, leave Verify
waiting, and require the five-job GitHub Actions matrix for the pushed code
commit before advancing.

### Trade-offs and risks

The feature needs a pre-verification code commit and a later evidence/integration
commit. Both remain reviewable on the same draft PR, and the final commit must
also receive green required checks before handoff.

### Verification

Bind the GitHub Actions run URL, head commit, job names, and conclusions in a
collected artifact; rerun exact local CI for the repaired tree, independently
review it, integrate its deltas, push the final evidence commit, and confirm the
final PR matrix is green.
