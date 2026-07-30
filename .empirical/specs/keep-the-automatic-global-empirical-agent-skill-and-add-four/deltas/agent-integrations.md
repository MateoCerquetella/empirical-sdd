# Agent Integrations

## Purpose

Offer automatic and explicit Empirical workflows through native global agent
skills while keeping the terminal lifecycle surface small and safe.

## MODIFIED Requirements

### Requirement: Explicit global skill installation

Empirical SHALL provide an interactive `empirical install` selector outside an
initialized project. The selector MUST show all supported agents, preselect
detected or currently managed targets, accept explicit non-interactive agent
flags, and install exactly five managed Empirical skills for each selected
agent: `empirical`, `empirical-init`, `empirical-spec`, `empirical-socratic`,
and `empirical-loop`. It MUST NOT create project workflow state or launch an
agent.

#### Scenario: A developer installs Empirical interactively

- **WHEN** the developer submits a set of agents in the selector
- **THEN** every selected agent receives the same five current Empirical skills
- **AND** no deselected agent retains a marker-owned current skill

### Requirement: Global integration preserves user configuration

Installation and update MUST reconcile both selected and deselected agents,
write or remove only Empirical-managed targets, preserve unmanaged files,
directories, symbolic links, and unrelated configuration, and constrain every
destination to the selected user home. Marker-owned legacy Explore, Fast, and
Complex skills and marker-owned project-local copies of current or legacy
skills MUST be removed safely and repeatably.

#### Scenario: A stale project skill shadows a global skill

- **WHEN** repository initialization encounters a marker-owned local Empirical skill
- **THEN** it removes that managed local target so global discovery can prevail
- **AND** an unmanaged target at the same path is preserved and reported

### Requirement: Global discovery guidance is agent-accurate

Human and structured installation reports MUST identify each native global
skill root and provide accurate invocation and reload guidance for every
installed Empirical skill without claiming that all agents expose slash
commands or prompt-capable sessions.

#### Scenario: Installation finishes

- **WHEN** global installation succeeds for a selected agent
- **THEN** the report lists native invocations for all five installed skills
- **AND** the invocation syntax matches that agent's extension mechanism

### Requirement: Native user-invocable workflow entrypoints

The system SHALL expose five global Empirical skills per selected agent. The
automatic `empirical` skill MUST route end to end. `empirical-init` MUST only
initialize or repair repository context. `empirical-spec` MUST draft concrete
Complex specification artifacts and wait for approval. `empirical-socratic`
MUST conduct and persist five-pass discovery, draft the approved Complex
specification, and wait for approval. `empirical-loop` MUST only resume selected
work through a terminal workflow result. Every skill MUST use MCP first and MAY
use only the private internal transport as fallback.

#### Scenario: A developer chooses an explicit specification path

- **WHEN** the developer invokes Spec or Socratic in a supported agent
- **THEN** the current agent produces a reviewable specification and stops
- **AND** Loop can continue it after explicit approval without rerouting the request

### Requirement: Honest command discovery report

Normal help and README MUST present only `empirical install`, `empirical
update`, and native in-agent skill invocations. Direct state-machine verbs MUST
be rejected as human terminal commands. MCP, the TypeScript API, and a private
internal CLI transport MAY retain workflow operations for installed agents and
compatibility.

#### Scenario: A developer asks for terminal help

- **WHEN** the developer runs `empirical --help`
- **THEN** terminal commands remain limited to Install and Update
- **AND** Init, Spec, Socratic, and Loop are described as in-agent skills rather than CLI verbs

## ADDED Requirements

### Requirement: Explicit skills have disjoint approval boundaries

The generated explicit skills MUST state their inputs, mutations, stop
condition, and next valid entrypoint. Init MUST NOT create feature state; Spec
and Socratic MUST NOT complete their pending Specify revision before the user
approves the drafted artifacts; Loop MUST NOT interpret free-form text as a new
feature when no active workflow exists.

#### Scenario: A specification draft is ready

- **WHEN** Spec or Socratic has written the required Specify artifacts
- **THEN** it reports the pending approval and leaves Specify selected
- **AND** implementation does not begin until approval is provided
