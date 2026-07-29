# Living Specifications

## MODIFIED Requirements

### Requirement: Reviewed deltas are archived before completion

A Complex change MUST enter Archive after Review and MUST NOT reach Done until
its validated deltas have been atomically applied to
`.empirical/capabilities/<name>/spec.md` through the exact feature-scoped
revision.

#### Scenario: Review passes

- **WHEN** a Complex change receives passing review evidence
- **THEN** its next action is Archive with its exact feature revision

#### Scenario: Archive succeeds

- **WHEN** all capability projections can be committed
- **THEN** Empirical writes the living specifications and advances the feature to Done as one logical transaction

#### Scenario: Archive partially fails

- **WHEN** any capability projection cannot be written
- **THEN** Empirical restores every capability already touched and leaves the feature at the same Archive revision
