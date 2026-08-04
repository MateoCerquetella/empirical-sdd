# Decisions: Add Safe Empirical Uninstall

Record concise, externally reviewable evidence and choices here. Do not store
private chain-of-thought, prompts, credentials, secrets, or scratchpad text.

## D-001: Remove only provably owned global artifacts, then the package

Status: Accepted

### Evidence

- Global installation already deduplicates 73 catalog targets into normalized
  roots and protects writes/removals with home containment, symlink checks, and
  an `empirical-sdd:managed-file` marker.
- Exact selected ids are stored in an owner-stamped global manifest; repository
  MCP bridges and durable `.empirical` history live in unrelated project roots.
- The running CLI can safely finish its in-memory process after npm removes the
  package, but npm failure would otherwise risk leaving no retry command.

### Options

1. Delete every path named `empirical*`, project state, and the package in one
   broad recursive operation.
2. Ask explicitly, scan only catalog-derived home paths, remove only files and
   metadata with valid ownership proof, preserve project state, and uninstall
   the npm package last.
3. Remove only skills and tell the user to uninstall the package manually.

### Chosen approach

Choose option 2. Reuse the installer's exact trust boundary, make confirmation
fail closed, keep project artifacts outside command authority, and execute one
exact shell-free npm removal only after managed integration cleanup succeeds.

### Trade-offs and risks

- Repository MCP entries cannot be enumerated globally and intentionally remain;
  help and completion output make that limitation explicit.
- Invalid or unmanaged selection metadata may survive; preservation is safer
  than guessing ownership and every survivor is reported.
- If npm fails last, skills may already be gone while the package remains. The
  operation is idempotent and the stage-specific error gives a direct retry.
- No package version bump or external unpublish is implied by local self-removal.

### Verification

Snapshot managed, unmanaged, unsafe, shared-root, metadata, and project paths;
verify cancellation and missing confirmation perform no mutation; assert exact
npm argv and last-stage ordering; run source, bundled, clean-consumer, coverage,
Review, and detached-target gates.
