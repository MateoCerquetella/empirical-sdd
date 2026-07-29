# Decisions: Native Agent Entrypoints

This record contains concise, externally reviewable decisions only.

## D-001: Generate native entrypoints from one typed catalog

Status: Accepted

### Evidence

- The supported agents use different project extension formats and invocation syntax.
- Every entrypoint must retain the same workflow safety contract across those formats.
- Managed-marker and atomic-write protections already provide a safe persistence boundary.

### Options

1. Maintain every generated agent file independently.
2. Claim one universal slash-command format for all agents.
3. Define entrypoints once and render each agent's native format and invocation metadata.

### Chosen approach

Choose option 3. A typed catalog owns the workflow instructions, while native
renderers and reports expose the correct artifact path, invocation, and reload
guidance for each agent.

### Trade-offs and risks

- Native agent formats can evolve and require renderer updates.
- The catalog must preserve task-specific guards instead of flattening every
  entrypoint into identical instructions.
- Unmanaged collisions must remain user-owned and be reported rather than overwritten.

### Verification

- Enumerate every generated project entrypoint and assert its native syntax.
- Verify human and JSON reports agree on invocations and reload guidance.
- Exercise repeat refreshes, unmanaged files, and symbolic-link collisions.
