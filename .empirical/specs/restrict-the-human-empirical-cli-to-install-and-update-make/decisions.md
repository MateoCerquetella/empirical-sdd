# Decisions: Two-Command CLI And Agent Selector

## D-001: Put workflow CLI compatibility behind a private namespace

Status: Accepted

### Evidence

- Humans should not choose state-machine operations.
- Installed skills still need a fallback when an MCP tool is temporarily unavailable.
- Removing the implementations would duplicate or weaken tested API behavior.

### Options

1. Keep direct verbs but hide them from help.
2. Delete all workflow CLI adapters.
3. Reject direct verbs and retain adapters only below `__internal`.

### Chosen approach

Choose option 3. MCP remains primary and `__internal` is an unlisted transport,
not a human workflow surface.

### Trade-offs and risks

The private transport remains technically callable, but it is intentional,
namespaced, absent from help/README, and required for robust agent fallback.

### Verification

Assert direct verbs reject before project mutation and equivalent private verbs
still execute in source and built package smoke tests.

## D-002: Use an in-package keyboard selector without a runtime dependency

Status: Accepted

### Evidence

- The product has five stable agent options and needs only multi-select behavior.
- `npx skills` provides the relevant conventions: detected agents, repeated
  `--agent`, `--all`, and non-interactive confirmation controls.
- A pure reducer is easier to test than a prompt library's terminal internals.

### Options

1. Add a general prompt dependency.
2. Use a comma-separated line prompt.
3. Implement a small raw-key selector with a pure reducer and renderer.

### Chosen approach

Choose option 3, with `[x]` checkboxes, arrow/space/all/enter controls, detected
and installed badges, and guaranteed terminal cleanup.

### Trade-offs and risks

The adapter owns ANSI behavior and must handle cancellation carefully. The
surface remains deliberately small and testable.

### Verification

Unit-test every reducer transition and stable rendering; test CLI selection
resolution independently from physical terminal input.

## D-003: Treat selector submission as exact reconciliation

Status: Accepted

### Evidence

- A selector implies that unchecked agents should no longer own the managed skill.
- Old Empirical files are marker-owned and already have safe removal rules.
- Unmanaged and symlink targets must never be deleted.

### Options

1. Only add selected agents and leave deselected managed files.
2. Delete every deselected target unconditionally.
3. Add selected targets and safely remove only marker-owned deselected targets.

### Chosen approach

Choose option 3. The target set converges exactly while user content is preserved.

### Trade-offs and risks

Selection becomes meaningfully destructive for managed files, so the visible
checkbox state and marker enforcement are part of the safety boundary.

### Verification

Exercise select, deselect, repeat, unmanaged, non-file, symlink, and obsolete
target fixtures in isolated homes.

## D-004: Make Update reuse detected and managed targets non-interactively

Status: Accepted

### Evidence

- Update starts the newly installed CLI as a child and must not wait for input.
- Currently managed targets may lack a detectable executable but should not
  disappear during routine refresh.

### Options

1. Open the selector during Update.
2. Install to all five agents during Update.
3. Call `install --yes` to preserve detected plus managed targets.

### Chosen approach

Choose option 3.

### Trade-offs and risks

Removing an agent during Update requires an explicit later selector run, which
is predictable and avoids accidental deletion.

### Verification

Assert exact child argv and success/failure staging with an injected runner.
