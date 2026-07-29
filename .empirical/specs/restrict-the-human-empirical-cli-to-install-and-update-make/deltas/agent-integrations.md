# Agent Integrations

## Purpose

Make Empirical's human CLI minimal and make agent selection explicit without
removing the internal workflow engine used by installed agents.

## MODIFIED Requirements

### Requirement: Explicit global skill installation

Empirical SHALL provide an interactive `empirical install` selector outside an
initialized project. The selector MUST show all supported agents, preselect
detected or currently managed targets, accept explicit non-interactive agent
flags, and install exactly one managed Empirical entrypoint for each selected
agent without creating project workflow state or launching an agent.

#### Scenario: A developer installs Empirical interactively

- **WHEN** the developer runs `empirical install` in a TTY
- **THEN** a multi-select agent list appears with detected and managed status
- **AND** only the submitted agents receive the global Empirical entrypoint

#### Scenario: Automation installs Empirical

- **WHEN** a non-interactive caller supplies repeated `--agent`, `--all`, or `--yes`
- **THEN** installation resolves the exact deterministic target set without prompting
- **AND** missing selection input produces an actionable error

### Requirement: Global integration preserves user configuration

Installation and update MUST reconcile both selected and deselected agents,
write or remove only Empirical-managed targets, preserve unmanaged files,
directories, symbolic links, and unrelated configuration, and constrain every
destination to the selected user home. Obsolete managed dedicated entrypoints
MUST be removed safely and repeatably.

#### Scenario: A currently managed agent is deselected

- **WHEN** the developer submits the selector without that agent
- **THEN** its marker-owned Empirical skills are removed
- **AND** unmanaged content at any corresponding path is preserved and reported

### Requirement: Honest command discovery report

Normal help and README MUST present only `empirical install`, `empirical
update`, and native in-agent invocation. Direct state-machine verbs MUST be
rejected as human commands. MCP, the TypeScript API, and a private internal CLI
transport MAY retain workflow operations for installed agents and compatibility.

#### Scenario: A developer asks for help or invokes a removed verb

- **WHEN** the developer runs `empirical`, `empirical --help`, or `empirical init`
- **THEN** help exposes only Install and Update
- **AND** the removed direct verb cannot start or mutate workflow state

### Requirement: Native user-invocable workflow entrypoints

The system SHALL expose one global Empirical entrypoint per selected agent. That
entrypoint MUST use MCP first, MAY use only the private internal transport as a
fallback, and MUST initialize, refresh context, route, resume, complete, archive,
and hand off without asking the user to invoke state-machine commands.

#### Scenario: A request enters through a supported agent

- **WHEN** the user invokes the one Empirical skill
- **THEN** the current agent performs all required internal workflow operations
- **AND** normal terminal commands remain limited to Install and Update

### Requirement: Update converges package and integrations

`empirical update` MUST install `empirical-sdd@latest` and invoke the newly
installed CLI as `empirical install --yes`. Update MUST preserve detected and
currently managed targets without prompting, report each stage distinctly, and
MUST NOT claim refresh success unless both stages pass.

#### Scenario: A developer updates Empirical

- **WHEN** npm successfully installs the latest package
- **THEN** the new Empirical process refreshes the preserved target set with `install --yes`
- **AND** no selector prompt blocks the update process
