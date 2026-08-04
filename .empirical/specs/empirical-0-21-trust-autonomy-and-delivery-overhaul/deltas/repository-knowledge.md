# Repository Knowledge

## Purpose

Keep compact context freshness explicit and expose non-mutating repository
health diagnostics.

## MODIFIED Requirements

### Requirement: Initialization creates compact repository knowledge

Initialization and explicit `empirical-init` MUST create Manifest v2 and
navigable overview, architecture, commands, and conventions pages. Manifest v2
MUST bind each generated page to source fingerprints, generator version, and
freshness state. Repair MUST apply approved setup, refresh missing or stale
managed pages, remove marker-owned local skill shadows, preserve unmanaged
content, and create no feature state.

#### Scenario: A partially initialized Schema 4 repository is migrated

- **WHEN** setup completes successfully under Schema 5
- **THEN** Manifest v2 identifies every managed page and source fingerprint
- **AND** no specification or standing authorization is invented

### Requirement: Knowledge refresh is deterministic and safe

Refresh MUST use Git-aware ignored-file handling when available, exclude
dependencies, outputs, VCS internals, Empirical history, and secret-like paths,
enforce path and size bounds, and converge when source fingerprints and policy
are unchanged. A relevant source change MUST mark dependent pages stale before
they are regenerated.

#### Scenario: A tracked package script changes

- **WHEN** Manifest v2 is inspected before knowledge refresh
- **THEN** the commands page is explicitly stale
- **AND** default retrieval does not present it as current guidance

### Requirement: Workflow packets retrieve repository knowledge progressively

Explore and action packets MUST list only fresh context pages by default,
alongside policy and capability specifications. Stale pages MUST be separately
identified with a refresh action and MUST NOT silently guide execution.

#### Scenario: One context page is stale

- **WHEN** an action packet is rendered
- **THEN** fresh pages remain retrievable
- **AND** the stale page and its source mismatch are reported separately

## ADDED Requirements

### Requirement: Doctor is comprehensive and non-mutating

Doctor MUST inspect schema and migration state, journal chains and compaction,
locks and capability claims, runtime toolchain, Policy v2, knowledge freshness,
evidence receipts, Git worktrees, and delivery records. It MUST return stable
severity and remediation codes and MUST NOT alter files, Git state, processes,
or remotes.

#### Scenario: Doctor finds a prunable registered worktree

- **WHEN** the linked checkout no longer exists
- **THEN** Doctor reports the exact stale registration and safe manual remediation
- **AND** does not prune or remove it automatically
