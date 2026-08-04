## ADDED Requirements

### Requirement: Source-changing work passes a Context gate

After implementation, Empirical MUST inspect repository knowledge. If source
changes made it stale, missing, invalid, or refinement-required, Fast and
Complex workflows MUST route to a persisted Context phase before Done or
Verify. Source-neutral changes MAY skip the phase.

#### Scenario: Implementation creates source after empty initialization

- **WHEN** the Implement phase completes after adding repository source
- **THEN** the next action is Context with an exact revision
- **AND** Context cannot pass until refresh and semantic refinement are complete

#### Scenario: Implementation changes only excluded Empirical state

- **WHEN** repository knowledge remains valid after Implement
- **THEN** the workflow advances without a redundant Context action
