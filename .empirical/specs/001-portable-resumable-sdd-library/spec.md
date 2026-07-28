# Spec 001 — Portable resumable SDD library

- **Number:** 001
- **Status:** PM
- **Surface:** `protocol, library, CLI, starter`
- **Author:** Mateo Cerquetella and Codex
- **Date:** 2026-07-28

## Problem

Developers using Empirical v1 can record a workflow phase, but the scaffold
cannot deterministically resume and continue from that state. Completion also
lacks consistently reviewed test and visual evidence, so unfinished or
incorrect work can appear done.

## Goal

A developer can run or resume an existing Empirical workflow from any
compatible client until the feature is evidenced as complete, genuinely
blocked, or awaiting a necessary human decision.

## User value

Developers spend less time steering small changes while gaining stronger,
portable proof that substantial changes are actually complete.

## Users / personas

- Developers already using the Empirical v1 `ai/` scaffold.
- Developers who need a low-ceremony path for small changes.
- Developers who need a high-assurance path for risky or user-visible changes.
- Tool authors integrating an IDE, agent, or automation service.

## Acceptance criteria

1. [AC-1] An unchanged Empirical v1 repository can be discovered, inspected, and
   adopted without destructive migration.
2. [AC-2] A client can continue automatically from repository state until Done,
   Blocked, or a required human decision, including after process restart;
   Quick uses Shape → Implement → Verify → Review while Strong requires
   Specify → Design → Plan → Implement → Verify → Review.
3. [AC-3] Every acceptance criterion has explicit passing evidence before Done; UI
   criteria require browser assertions, screenshots, and an agent review of
   those screenshots.
4. [AC-4] Commit, push, and pull-request actions occur only after QA and review, only
   when individually enabled by configuration, and only when the caller grants
   delivery authority.
5. [AC-5] Deleting every client database and cache does not prevent a different
   conforming client from reconstructing and continuing the exact workflow.
6. [AC-6] Concurrent clients cannot silently overwrite state: stale revisions are
   rejected and recoverable events remain portable repository files.
7. [AC-7] A developer can update the installed engine and then safely update the
   committed repository kit; managed playbooks/templates advance when clean,
   while project-owned files and local customizations are never overwritten.
8. [AC-8] Installing or updating the branded `empirical` tool installs the same
   Empirical-namespaced workflows for every supported global agent host without
   a per-agent integration step; those commands remain disposable adapters over
   the neutral repository protocol.

## Scope & non-goals

- **In:** neutral schemas, filesystem state/events, v1 compatibility, Quick and
  Strong profiles, bounded loop engine, evidence gates, command capabilities,
  guarded Git/GitHub delivery, CLI, embedding API, versioned starter playbooks,
  non-destructive kit upgrades, global cross-agent command packs, and
  conformance tests.
- **Out:** product-specific UI integration, mandatory SQLite, mandatory MCP, mandatory
  cloud services, automatic deployment/release, renaming `ai/`, and mandatory
  tactical DDD for every project.

## Reuse vs build

### Preserve conceptually

- Empirical v1's concise `ai/` context, roles, skills, specs, and single visible
  state surface.
- The earlier exploration's revision checks, typed plans, evidence binding, bounded attempts,
  explicit delivery, and recovery invariants.

### Build new

- A product-neutral protocol and conformance suite.
- A Rust reference library with a filesystem canonical store.
- A standalone `empirical` CLI and configurable command adapters.
- Non-destructive v1 parsing and adoption.

## Risks & invariants

- Quick mode must remain materially shorter than Strong mode.
- Evidence must be criterion-bound; merely attaching a screenshot is not proof.
- Automatic loops must stop after two failed repair attempts.
- Repo-controlled commands never execute without separate caller authority.
- Delivery defaults off and cannot run before verification and review pass.
- No SQLite record or IDE-specific file may be necessary for recovery.

## Verification wiring

- Unit tests cover legacy parsing, phase sequences, stale revisions, evidence
  completeness, capability requirements, and delivery policy.
- Integration tests create a v1 fixture, adopt it, resume through another
  client instance, delete projections, and finish from repository files.
- UI fixtures prove that missing browser evidence blocks both profiles.
- CLI tests prove delivery remains disabled without configuration and explicit
  authority.

## Open questions

- Registry publication and direct MCP transports are deferred until the
  filesystem protocol and CLI conformance suite stabilize.
