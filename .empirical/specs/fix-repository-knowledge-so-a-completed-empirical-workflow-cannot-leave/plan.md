# Implementation Plan

## 1. Model semantic refinement

- Extend repository knowledge inspection/report types with
  `refinementRequired`.
- Detect managed and exact legacy placeholder topic pages only for nonempty
  repositories.
- Exclude refinement-required topics from usable knowledge paths.
- Preserve custom pages and make refresh converge after agent refinement.

## 2. Enforce the workflow gate

- Add `context` to protocol/type phase enums and policy-compatible sequences.
- After Implement, inspect knowledge and route to Context only when invalid.
- Validate Context completion and provide exact remediation instructions.
- Add Doctor and packet diagnostics.

## 3. Harden migration

- Classify exact Schema-4 placeholder templates as managed in Manifest v2.
- Preserve non-placeholder legacy pages unchanged.
- Add migration fixtures for both cases.

## 4. Update integrations and documentation

- Teach the automatic, Init, and Loop agent instructions how Context refinement
  works.
- Document refinement-required reporting and the Context phase in architecture,
  MCP, protocol, migration, and demo material where relevant.

## 5. Add regression coverage

- Expand knowledge, core, Doctor, MCP, migration, integration, and protocol
  tests.
- Exercise empty initialization followed by source creation and semantic
  refinement.
- Verify source-neutral implementation still skips Context.

## 6. Prepare version 0.22.1

- Update package/runtime/lockfile/test/smoke/consumer version surfaces.
- Run focused tests while implementing, then `bun run ci`.
- Inspect status and packed output; continue through Empirical integration and
  exact protected release operations only as their authorization gates allow.
