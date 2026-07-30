# Repository Knowledge

## Purpose

Make first-run initialization and repair explicit, repeatable, and safe before
any automatic or deliberate Empirical workflow starts.

## MODIFIED Requirements

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
