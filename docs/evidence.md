# Evidence and browser QA

Evidence answers “what observable fact proves this criterion passed?” It is
not a log attachment or an agent's confidence statement.

Every record identifies the spec, spec revision, deterministic workspace hash,
acceptance-criterion IDs, kind, verdict, producer, summary, and timestamp.
Artifacts include repository paths and SHA-256 hashes. A changed spec or any
later non-ignored source edit makes old records ineligible.

`empirical next --json` returns the current `workspaceHash`; command adapters
receive the same value in their phase context. The hash covers regular files
and symlink targets outside the mutable root `ai/` protocol directory plus the
repository's `ai/empirical.toml` policy. It honors repository
`.gitignore`/`.ignore` rules (not machine-global excludes) and normalizes path
separators for cross-platform clients.
This lets state/events/reviews advance without invalidating proof while code,
tests, product docs, schemas, and committed starter files remain bound to the
verification snapshot.

If a test command legitimately updates a non-ignored file such as a lockfile,
read `empirical next --json` again after the command and bind the evidence to
that final snapshot. Any subsequent source edit still makes the record stale.

## Tests

Passing test evidence includes the exact argument vector, exit code zero, and a
hash of captured output plus the workspace hash tested. At least one passing
test record is required by default, and every criterion must be covered by a
non-review record.

## UI criteria

Mark UI acceptance criteria with `[UI]`. The default policy requires three
pieces of proof for each:

- `browser_assertion`: the real browser reached and asserted the expected
  state;
- `screenshot_review` with `artifactPath` and `artifactHash`: the rendered state
  was captured; and
- a non-empty reviewer identity on that screenshot review: an agent actually
  inspected the image against the criterion.

Merely taking a screenshot does not pass. Merely asserting the DOM does not
provide visual proof. Both are needed under the default policy.

Use `empirical evidence copy SOURCE NAME --json` to place an artifact safely beneath
the current spec and obtain its path and hash. Then include those values in the
record returned by the Verify adapter.

## Code review

Review produces `code_review` evidence. When independent review is enabled,
the passing review producer/reviewer cannot be the implementation actor. The
gate evaluates evidence again immediately before delivery.
