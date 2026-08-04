# Repository Knowledge Specification

## Purpose

Give every Empirical phase compact, durable repository context without a
network service, embeddings, or a vector database.

## Requirements

### Requirement: Initialization creates compact repository knowledge

First agent-owned initialization and explicit `empirical-init` MUST create
`.empirical/context/manifest.json` and navigable Markdown pages for overview,
architecture, commands, and conventions. Reinitializing an existing partial
project MUST apply explicitly supplied setup choices, remove marker-owned local
Empirical skills, refresh missing or stale context, and preserve unmanaged
content without creating feature state.

#### Scenario: A partially initialized repository is repaired

- **GIVEN** schema-4 configuration has `setupComplete: false` or context is missing
- **WHEN** the automatic or explicit Init skill finishes setup
- **THEN** explicit configuration is persisted and compact context is current
- **AND** no specification, revision, or active feature is created

### Requirement: Knowledge refresh is deterministic and safe

Refresh MUST use Git-aware ignored-file handling when available, exclude
dependencies, build outputs, VCS internals, Empirical history, and secret-like
paths, enforce path and size bounds, and converge when relevant repository
metadata and explicit configuration have not changed.

#### Scenario: Initialization is repeated without repository changes

- **WHEN** a complete project is initialized again with the same explicit choices
- **THEN** configuration and repository knowledge remain byte-stable
- **AND** unmanaged local agent content remains untouched

### Requirement: Workflow packets retrieve repository knowledge progressively

Explore and action packets MUST identify the current context pages alongside
project policy and living capability specifications so agents can retrieve only
the material context needed for the current phase.

#### Scenario: An agent receives a workflow action

- **WHEN** repository knowledge exists
- **THEN** the packet lists its context paths
- **AND** mandatory workflow gates remain authoritative over contextual guidance

### Requirement: Migration scratch is excluded from knowledge fingerprints

Manifest v2 MUST exclude top-level paths whose names begin
`.empirical.schema5-` in Git-backed and filesystem-fallback inventories.

#### Scenario: An aborted stage is present

- **WHEN** repository knowledge is inspected with reserved migration scratch present
- **THEN** its source digest is unchanged while an ordinary source-file change still makes dependent context stale
