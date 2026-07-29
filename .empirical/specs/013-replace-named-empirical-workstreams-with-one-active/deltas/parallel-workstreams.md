# Parallel Workstreams

## REMOVED Requirements

### Requirement: Workstreams have independent revision journals

#### Scenario: Two unrelated changes start concurrently

- **WHEN** agents start work in two different named workstreams
- **THEN** both changes receive independent revision 1 actions and distinct shared feature identifiers

#### Scenario: Concurrent clients encounter an abandoned Windows lock

- **WHEN** stale-lock recovery temporarily receives Windows `EPERM` or `EACCES` while the old path is being released
- **THEN** clients retry within the bounded lock wait, converge on one state, and do not delete a newer owner's lock

### Requirement: Action packets bind mutations to a workstream

#### Scenario: Selected workstream changes after a packet is issued

- **WHEN** a user selects another workstream for command convenience
- **THEN** the previously issued packet still targets its original workstream and cannot mutate the newly selected one

### Requirement: Workstream management is safe and visible

#### Scenario: Workstreams are listed

- **WHEN** a user requests the workstream list
- **THEN** Empirical shows the selected identity and each workstream's feature, phase, status, and revision
