# Living Specifications

## Purpose

Represent behavioral impact honestly and replay capability changes safely onto
an advancing integration base.

## MODIFIED Requirements

### Requirement: Complex changes declare valid capability deltas

Every Complex change MUST include a machine-readable impact manifest before
Specify passes. Behavioral changes MUST name affected capabilities and include
at least one valid delta using ADDED, MODIFIED, or REMOVED requirement sections,
named requirements, and concrete scenarios. Non-behavioral changes MUST include
no capability deltas and MUST instead name affected surfaces and a concrete
regression rationale. Fabricated no-op deltas MUST be rejected.

#### Scenario: Specify validates a behavioral change

- **WHEN** an impact manifest classifies observable behavior as changed
- **THEN** Empirical validates every declared operation against current living specifications
- **AND** it rejects completion when an affected capability lacks a delta

#### Scenario: Specify validates an internal refactor

- **WHEN** the manifest classifies the change as non-behavioral
- **THEN** Empirical requires affected surfaces and a regression rationale
- **AND** it rejects any fabricated capability delta

### Requirement: Reviewed deltas are archived before completion

A behavioral Complex change MUST pass Review, replay and integrate its exact
validated deltas against the current target, and persist a digest-bound
integration receipt before reaching integrated completion. Projection writes
MUST be atomic; any failure restores every touched capability and preserves the
same resumable revision. Non-behavioral changes record an empty integrated
projection with their regression receipt.

#### Scenario: Replay and integration succeed

- **WHEN** all current capability projections accept the validated operations
- **THEN** Empirical writes the living specifications and integration receipt as one transaction
- **AND** status reports integrated at the exact resulting digests

#### Scenario: Projection partially fails

- **WHEN** any capability cannot be committed or verified
- **THEN** Empirical restores every capability already touched
- **AND** the workflow remains resumable without claiming integration
