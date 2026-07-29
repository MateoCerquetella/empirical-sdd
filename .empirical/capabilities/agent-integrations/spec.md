# Agent Integrations Specification

## Purpose

Make Empirical workflows discoverable and safely invocable either from one
repository or globally across a developer's projects using each supported
agent's native extension mechanism.

## Requirements

### Requirement: Explicit global skill installation

Empirical SHALL provide `empirical install` outside an initialized project. It
MUST detect supported agents and install exactly one managed Empirical entrypoint
for each detected or previously managed agent. The operation MUST NOT create
project state or launch an agent. `integrate --global` MAY remain as a hidden
compatibility alias.

#### Scenario: A developer installs Empirical for local agents

- **GIVEN** the Empirical npm package and one or more supported agents are installed
- **WHEN** the developer runs `empirical install`
- **THEN** every detected agent receives one native global Empirical entrypoint
- **AND** the report shows its exact invocation and reload guidance

### Requirement: Global integration preserves user configuration

Installation and update MUST write or remove only Empirical-managed targets,
MUST preserve unmanaged files, directories, and symbolic links, and MUST
constrain every destination to the selected user home. Obsolete managed
dedicated entrypoints MUST be removed safely and repeatably.

#### Scenario: An obsolete dedicated skill is managed by Empirical

- **WHEN** the single-entrypoint installer refreshes the agent
- **THEN** the managed Explore, Fast, Complex, and Loop targets are removed
- **AND** an unmanaged collision at the same path is preserved and reported

### Requirement: Global discovery guidance is agent-accurate

Human and structured installation reports MUST identify each native global
skill root and provide accurate invocation and reload guidance without claiming
that all agents expose slash commands or prompt-capable sessions.

#### Scenario: Installation finishes

- **WHEN** global installation succeeds
- **THEN** the developer sees one Empirical invocation for every installed target
- **AND** the report distinguishes native skill syntax accurately

### Requirement: Native user-invocable workflow entrypoints

The system SHALL expose one global Empirical entrypoint per supported agent.
That entrypoint MUST initialize when needed, refresh repository context, route
vague and concrete work, select Fast or Complex internally, resume active work,
and preserve all workflow and evidence gates without requiring dedicated skills.

#### Scenario: A request enters through a supported agent

- **WHEN** the user invokes the one Empirical entrypoint with a new request or no request
- **THEN** the current agent initializes, routes, starts, or resumes as appropriate
- **AND** the user is not asked to invoke Explore, Fast, Complex, or Loop separately

### Requirement: Honest command discovery report

Normal help and documentation MUST present `empirical install`, `empirical
update`, and the one native in-agent invocation. Structured automation surfaces
MAY continue to expose internal workflow operations and compatibility commands.

#### Scenario: A developer asks for help

- **WHEN** the developer runs `empirical --help`
- **THEN** the primary terminal section contains only install and update
- **AND** it directs feature work to the installed in-agent Empirical entrypoint

### Requirement: Update converges package and integrations

`empirical update` MUST install `empirical-sdd@latest` and invoke the newly
installed CLI to refresh managed single-entrypoint integrations. It MUST report
which stage failed and MUST NOT claim that integrations were refreshed when the
second stage does not pass.

#### Scenario: A developer updates Empirical

- **WHEN** npm successfully installs the latest package
- **THEN** the newly installed Empirical process runs its install operation
- **AND** package version and managed entrypoints converge in one command
