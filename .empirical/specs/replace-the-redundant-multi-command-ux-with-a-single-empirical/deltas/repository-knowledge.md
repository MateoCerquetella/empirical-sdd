# Repository Knowledge

## Purpose

Give every Empirical phase compact, durable repository context without a
network service, embeddings, or a vector database.

## ADDED Requirements

### Requirement: Initialization creates compact repository knowledge

First agent-owned initialization MUST create `.empirical/context/manifest.json`
and navigable Markdown pages for overview, architecture, commands, and
conventions. The manifest MUST contain bounded repository metadata and paths,
not source contents or detected secrets.

#### Scenario: Empirical enters an uninitialized repository

- **WHEN** the single agent entrypoint initializes the repository
- **THEN** it creates a deterministic compact context set
- **AND** the current agent can refine the Markdown pages from inspected evidence

### Requirement: Knowledge refresh is deterministic and safe

Refresh MUST use Git-aware ignored-file handling when available, exclude
dependencies, build outputs, VCS internals, Empirical history, and secret-like
paths, enforce path and size bounds, and converge when relevant repository
metadata has not changed.

#### Scenario: Relevant repository structure changes

- **WHEN** a tracked source, test, documentation, or manifest path is added or removed
- **THEN** refresh changes the manifest digest and repository map
- **AND** a repeated refresh without further changes is byte-stable

### Requirement: Workflow packets retrieve repository knowledge progressively

Explore and action packets MUST identify the current context pages alongside
project policy and living capability specifications so agents can retrieve only
the material context needed for the current phase.

#### Scenario: An agent receives a workflow action

- **WHEN** repository knowledge exists
- **THEN** the packet lists its context paths
- **AND** mandatory workflow gates remain authoritative over contextual guidance
