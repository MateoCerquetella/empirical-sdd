## Purpose

Keep a committed, capability-oriented description of current product behavior and
close every reviewed Complex change by merging validated requirement deltas.

## ADDED Requirements

### Requirement: Complex changes declare capability deltas
The system SHALL require every new Complex change to declare at least one valid
ADDED, MODIFIED, or REMOVED requirement in a named capability before leaving
specification, while Fast and resumed legacy Quick work remain artifact-light.

#### Scenario: Complex specification completes
- **WHEN** an agent completes Specify with valid acceptance criteria and capability deltas
- **THEN** the workflow advances to Design with the affected capabilities recorded

#### Scenario: Complex specification has no deltas
- **WHEN** an agent completes Specify without a valid capability delta
- **THEN** completion is rejected with actionable delta-format guidance

### Requirement: Archive updates living specifications
The system SHALL add an Archive action after reviewed Complex work and SHALL not
mark the work Done until its deltas are applied to the canonical capability specs.

#### Scenario: Reviewed change is archived
- **WHEN** an agent archives the exact reviewed revision
- **THEN** ADDED requirements are inserted, MODIFIED requirements are replaced, REMOVED requirements are deleted, and the workflow becomes Done

#### Scenario: Archive is repeated
- **WHEN** the same completed work is archived or resumed again
- **THEN** the operation returns the converged Done state without duplicating requirements

### Requirement: Invalid deltas cannot change canonical behavior
The system MUST reject malformed capability names, path traversal, duplicate
additions, missing modifications or removals, and requirements without scenarios
before writing any canonical capability specification.

#### Scenario: Delta preflight fails
- **WHEN** any delta operation is inconsistent with the current capability specifications
- **THEN** archive reports every blocking issue and leaves all capability specs and workflow state unchanged
