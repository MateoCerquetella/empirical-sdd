# Implementation Plan

## 1. Build and reconcile the five-skill catalog

- Refactor `src/integrations.ts` from `SINGLE_AGENT_SKILL` to an ordered catalog
  for `empirical`, `empirical-init`, `empirical-spec`, `empirical-socratic`, and
  `empirical-loop`.
- Encode common MCP-first/private-fallback and safety invariants once, then give
  each generated skill a precise trigger, responsibility, forbidden behavior,
  approval gate, and stop condition.
- Derive agent-native invocation strings from `src/agents.ts` without changing
  launch capability detection.
- Write all current skills for selected agents, remove all current managed
  skills for deselected agents, and remove only the three legacy managed names.
- Reuse the full current/legacy name sets for managed-target detection and
  project-local shadow cleanup.
- Update integration types only if needed; preserve report compatibility.

Verification:

- Focused integration tests assert 25 generated files for `--all`, five ordered
  invocations per agent, valid frontmatter, role boundaries, repeat convergence,
  selection removal, upgrade cleanup, local shadow cleanup, unmanaged
  preservation, links/non-files, and home containment.

## 2. Repair existing-project initialization

- Add an explicit-option presence helper in `src/core.ts` so the existing-store
  path can distinguish caller intent from omitted settings.
- After migration and active-project selection, merge only supplied isolation,
  decision, and setup-complete values through `configure`.
- Refresh context and return the post-configuration state without starting a
  feature.
- Preserve `integrations: false`, migration, active feature ownership, and
  create-new-project behavior.

Verification:

- Add core/integration fixtures for schema-4 `setupComplete: false`, missing
  context, explicit partial settings, omitted settings, stale managed local
  skills, unmanaged collisions, no active feature, and repeated convergence.

## 3. Add progressive Socratic persistence and exact Complex handoff

- Extend `src/discovery.ts` with canonical pass-order validation, safe record
  loading, draft update, approval, and result types.
- Add an `EmpiricalProject.discovery` operation that saves partial ordered
  answers and, only after complete approval, starts Complex from the exact
  `buildRefinedRequest` output.
- Keep an approved record when startup returns a worktree proposal; mark it
  started only after an action exists; make repeated started submissions
  idempotent and reject changed or invalid records.
- Export public TypeScript discovery types/helpers through `src/index.ts`.
- Register `empirical_discovery` in `src/mcp.ts` with strict nested Zod schemas
  and accurate mutation/idempotence annotations.
- Add `empirical __internal discovery --input <file|->` in `src/cli.ts`, while
  keeping public `empirical discovery` rejected and help unchanged.
- Reuse the core operation in the existing terminal interview where practical
  so adapter behavior does not diverge.

Verification:

- Test progressive answer saves, material follow-ups, exact refined request,
  approval/start, repeated calls, invalid order, duplicate/missing/empty data,
  changed problem, unknown ID, traversal/symlink protection, isolation proposal,
  MCP execution, private CLI input, and public rejection.

## 4. Update product guidance and generated behavior tests

- Rewrite README around the hybrid choice: automatic mode or explicit Init →
  Spec/Socratic → Loop, with every supported agent's actual invocation syntax.
- Add concise examples for first use, a small concrete specification, a vague
  Socratic feature, automatic execution, and continuation after approval.
- Update architecture, commands, conventions, MCP instructions, lifecycle
  success wording, and any source/test text that assumes one entrypoint.
- Ensure docs never present agent skills as terminal commands and do not restore
  Fast/Complex user entrypoints.
- Validate each generated SKILL.md name/description and skill-creator-compatible
  frontmatter in isolated installer output.

Verification:

- Search documentation and generated artifacts for obsolete one-entrypoint
  claims, hidden public command examples, and stale legacy skill names.
- Exercise public help, human install report, JSON report, update fixtures, and
  supported-agent invocation snapshots.

## 5. Run focused and full verification

- Run type checking and focused discovery, core, integration, MCP, CLI, and
  lifecycle tests after each component.
- Run `bun run ci`, built CLI/MCP smoke, package inspection, `npm pack --dry-run`,
  and a packed clean-consumer installation with an isolated home.
- Inspect generated five-skill contents from the packed CLI and verify public
  help exposes only Install and Update.
- Run `git diff --check`, inspect the complete diff for unrelated changes, and
  record criterion evidence under the active feature.

## 6. Review and archive

- Review implementation against all twelve acceptance criteria and the five
  accepted decisions, with special attention to destructive reconciliation,
  approval boundaries, idempotence, and shadowing.
- Repair any review findings and rerun affected/full verification.
- Archive validated capability deltas into agent integrations, exploratory
  discovery, and repository knowledge; confirm convergence and a clean main
  worktree.
- Commit the completed feature atomically. Publishing a new npm version remains
  outside this feature unless the user explicitly requests it after review.
