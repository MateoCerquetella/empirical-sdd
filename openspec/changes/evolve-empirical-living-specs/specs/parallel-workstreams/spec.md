## Purpose

Allow several changes to remain active in one repository without sacrificing exact
revision checks, deterministic resumption, or safe coordination between agents.

## ADDED Requirements

### Requirement: Workstreams have independent state
The system SHALL store a separate state projection and event journal for every
named workstream and SHALL apply revisions only within the addressed workstream.

#### Scenario: Two workstreams progress concurrently
- **WHEN** different agents complete exact revisions in two named workstreams
- **THEN** both transitions succeed independently and neither changes the other's state or event chain

### Requirement: Action packets bind workstream identity
Every mutable action packet and completion command SHALL include an explicit
workstream identifier so changing the human convenience selection cannot redirect
an already-issued action.

#### Scenario: Selection changes after an action is issued
- **WHEN** an action for workstream A is retained and the selected workstream changes to B
- **THEN** completing the retained action still targets A or fails explicitly rather than mutating B

### Requirement: Existing projects become the default workstream
Migration SHALL preserve schema-1 and schema-2 state, events, specifications,
evidence, profiles, and adoption metadata as the `default` workstream.

#### Scenario: Existing repository migrates
- **WHEN** migration runs on a repository with the former single-state layout
- **THEN** the same active action resumes as workstream `default` with no loss of revision history or compatibility

### Requirement: Workstreams are manageable through every interface
Users and agents SHALL be able to create, list, inspect, select, and explicitly
address workstreams through CLI, MCP, and the TypeScript API.

#### Scenario: Human lists workstreams
- **WHEN** workstream status is requested
- **THEN** the result identifies the selected workstream and each workstream's feature, phase, status, and revision
