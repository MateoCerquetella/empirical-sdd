# Living Specifications Specification

## Purpose

Living capability specifications preserve the current observable product truth while each Complex change declares a reviewable behavioral delta.

## Requirements

### Requirement: Complex changes declare valid capability deltas

Every new Complex change MUST include at least one valid capability delta before Specify can pass. Each delta MUST use ADDED, MODIFIED, or REMOVED requirement sections, named requirements, and at least one concrete scenario per requirement.

#### Scenario: Specify validates a behavioral change

- **WHEN** an agent completes Specify for a new Complex change
- **THEN** Empirical validates every declared operation against the current living capability specifications

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

### Requirement: Capability delta operations are safe and repeatable

Empirical MUST reject unsafe capability names, malformed requirements, duplicate changes, additions of existing requirements, and modifications or removals of missing requirements. Repeating a successful Archive request MUST converge without applying a delta twice.

#### Scenario: Invalid delta is proposed

- **WHEN** a delta cannot be projected unambiguously onto current behavior
- **THEN** Empirical rejects it before changing any living specification

#### Scenario: Successful archive is retried

- **WHEN** an Archive request is repeated after the change reached Done
- **THEN** Empirical reports convergence and leaves capability content unchanged
