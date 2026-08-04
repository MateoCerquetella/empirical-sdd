# Context Refinement Completion Gate

## Request

> Fix repository knowledge so a completed Empirical workflow cannot leave nonempty repositories with TODO-only or stale semantic context. Detect refinement-required pages explicitly, preserve deliberate agent-maintained content, handle legacy template migration safely, route a mandatory context-refinement action after source-changing work before terminal completion, add regression tests and documentation, bump the package to the next patch version, run full release verification, and prepare the exact release without bypassing protected delivery or publication approvals.

## Goal

Make repository knowledge an enforced workflow result: deterministic refresh
continues to own inventory metadata, while the host agent must refine semantic
topic pages before source-changing work can proceed to verification or terminal
completion.

## Acceptance Criteria

- [ ] [AC-1] Context inspection and refresh explicitly report nonempty repository topic pages containing managed or legacy TODO placeholders as refinement-required, exclude them from usable knowledge paths, and Doctor diagnoses them without mutation.
- [ ] [AC-2] Refresh preserves deliberate agent-maintained topic content, while replacing legacy placeholder templates with safely managed templates that remain refinement-required until the agent writes evidence-backed content.
- [ ] [AC-3] Fast and Complex workflows that change repository source route through a Context phase before Done or Verify; Context cannot pass while knowledge is stale, missing, invalid, or refinement-required, while source-neutral work does not gain a redundant phase.
- [ ] [AC-4] Action packets and installed skill instructions tell the host agent how to refresh inventory, inspect evidence, refine topic pages, remove the managed marker, refresh again, and complete the exact Context revision.
- [ ] [AC-5] Schema migration preserves custom legacy context, recognizes legacy placeholder templates as managed/refinement-required, and leaves no legacy TODO page falsely classified as completed agent knowledge.
- [ ] [AC-6] Package, runtime, tests, documentation, and release-facing version surfaces converge on `0.22.1`, and the full repository CI plus packed-consumer checks pass before any delivery or publication action.

## Scope

- Repository knowledge inspection, refresh reporting, usable-path retrieval, and Doctor diagnostics.
- A persisted `context` workflow phase inserted only when post-implementation repository knowledge is not current and refined.
- Schema-4 context-template migration compatibility.
- Generated Empirical skill instructions, protocol documentation, and regression tests.
- Patch-version preparation for `empirical-sdd@0.22.1`.

## Non-goals

- Generating semantic prose inside the deterministic CLI without a host agent.
- Overwriting deliberate custom context or treating arbitrary prose containing the word TODO as a placeholder.
- Bypassing independent integration, protected GitHub delivery, npm publication authorization, or immutable-release checks.
- Publishing any version other than `0.22.1`.

## Verification

- Run focused knowledge, migration, workflow, Doctor, MCP, and integration tests.
- Run `bun run ci`, including type checking, full tests, coverage, distribution smoke, clean package consumption, and consistency checks.
- Inspect the packed package and verify all public version surfaces are exactly `0.22.1`.
- Exercise an empty repository that gains source during implementation and prove it cannot finish with TODO-only topic pages.

## Capability Deltas

- `repository-knowledge`: refinement-required semantics and safe placeholder handling.
- `workflow-routing`: mandatory conditional Context phase.
- `migration-integrity`: legacy template classification.
- `package-distribution`: exact `0.22.1` patch candidate and unchanged authorization gates.
