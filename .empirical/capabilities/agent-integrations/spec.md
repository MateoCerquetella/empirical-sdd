# Agent Integrations Specification

## Purpose

Make Empirical workflows discoverable and safely invocable either from one
repository or globally across a developer's projects using each supported
agent's native extension mechanism.

## Requirements

### Requirement: Explicit global skill installation

Empirical SHALL provide an explicit global integration operation that works
without an initialized project and installs the Empirical, Explore, Fast,
Complex, and Loop workflows into the native user-level skill directory of
Codex, Claude Code, Cursor, Gemini CLI, and Windsurf.

#### Scenario: A developer enables Empirical in every project

- **GIVEN** the Empirical npm package is installed
- **WHEN** the developer runs `empirical integrate --global` from any directory
- **THEN** all five supported agents receive all five global skills
- **AND** no project state or agent runtime is created

### Requirement: Global integration preserves user configuration

Global skill installation SHALL update only files that contain Empirical's
managed marker and SHALL preserve unmanaged files, directories, and symbolic
links while constraining every destination to the selected user home.

#### Scenario: A target skill already belongs to the user

- **GIVEN** an unmanaged file, directory, or symbolic link exists at a global
  skill target
- **WHEN** global integration runs
- **THEN** Empirical reports the target as preserved
- **AND** the existing target remains unchanged

#### Scenario: Empirical is upgraded

- **GIVEN** an older Empirical-managed global skill is installed
- **WHEN** global integration runs from a newer package
- **THEN** the managed skill is refreshed atomically
- **AND** a subsequent run converges without further changes

### Requirement: Global discovery guidance is agent-accurate

Human and structured global integration reports SHALL identify each native
global skill root and provide accurate discovery, invocation, or reload
guidance without claiming that all supported agents expose project-defined slash
commands.

#### Scenario: Installation finishes

- **WHEN** global integration reports success
- **THEN** the developer can see where every agent's skills were installed
- **AND** how that agent discovers or invokes Empirical workflows

### Requirement: Global integration is opt-in

Project initialization, adoption, and ordinary integration SHALL remain scoped
to the current repository and SHALL NOT write global agent configuration unless
the user explicitly selects global integration.

#### Scenario: A repository is initialized normally

- **WHEN** the developer runs `empirical init`
- **THEN** Empirical writes only repository-scoped state and integrations
- **AND** user-level skill directories are unchanged
