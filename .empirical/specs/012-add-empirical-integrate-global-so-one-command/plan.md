# Plan: global Agent Skills installation

## 1. Finalize the integration model

- Extend integration report types with explicit project/global scope and
  agent-accurate entrypoint metadata.
- Refactor the five workflow definitions and skill renderer so project and
  global installation consume one catalog.
- Preserve the pending project-local five-entrypoint generation and correct any
  inaccurate invocation labels.

## 2. Implement safe global persistence

- Add home-root validation and strict descendant checks.
- Strengthen managed writes to preserve a symbolic link at any ancestor below
  the root and to preserve non-file target collisions.
- Implement `installGlobalAgentSkills(homeRoot)` across the five documented
  user skill roots and return a global integration report.
- Export the installer through the package API.

## 3. Expose the opt-in CLI

- Parse `empirical integrate --global` before project opening.
- Reject unexpected arguments, use the OS home, and emit human or JSON output.
- Make report rendering scope-aware with exact roots and agent-specific
  interaction/reload guidance.
- Add the global operation to main help while preserving ordinary project
  integration semantics.

## 4. Verify behavior

- Expand project integration assertions to all five workflows across all five
  project agent formats and structured reports.
- Add temporary-home global tests for the 25 generated skills, distinct
  contracts, convergence, stale managed refresh, unmanaged file/directory and
  symbolic-link preservation, parent symlink safety, invalid roots, and no
  project state creation.
- Add human and JSON CLI coverage outside an initialized project and retain the
  existing integration regression suite.

## 5. Document and release

- Update README, CLI help, architecture, security, migration, MCP guidance, and
  OpenSpec comparison to distinguish optional global Agent Skills from
  repository commands and MCP.
- Confirm package and product versions are 2.3.1.
- Run typecheck, all tests, build/distribution smoke, npm pack dry-run, packed
  package smoke, and diff review.
- Complete Verify and Review evidence, archive the capability delta, publish
  `empirical-sdd@2.3.1`, install/update the global CLI, and run
  `empirical integrate --global` for the user after filesystem approval.
