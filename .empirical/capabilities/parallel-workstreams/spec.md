# Parallel Workstreams Specification

## Purpose

Named workstreams allow unrelated changes to progress safely in one repository without weakening exact revisions or the default compatibility layout.

## Requirements

### Requirement: Workstreams have independent revision journals

Empirical MUST support a default workstream at the existing `.empirical/state.json` and `.empirical/events/` paths and named workstreams under `.empirical/workstreams/<name>/`, each with independent state, events, and revisions.

#### Scenario: Two unrelated changes start concurrently

- **WHEN** agents start work in two different named workstreams
- **THEN** both changes receive independent revision 1 actions and distinct shared feature identifiers

### Requirement: Action packets bind mutations to a workstream

Every new action packet and completion command MUST carry an explicit workstream. A mutation that declares a different workstream than the opened project MUST be rejected.

#### Scenario: Selected workstream changes after a packet is issued

- **WHEN** a user selects another workstream for command convenience
- **THEN** the previously issued packet still targets its original workstream and cannot mutate the newly selected one

### Requirement: Workstream management is safe and visible

Users and agents MUST be able to create, list, select, and explicitly address portable named workstreams, and invalid or unknown names MUST be rejected without escaping the project store.

#### Scenario: Workstreams are listed

- **WHEN** a user requests the workstream list
- **THEN** Empirical shows the selected identity and each workstream's feature, phase, status, and revision
