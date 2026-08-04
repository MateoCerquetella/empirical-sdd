# Living Specifications Specification

## Purpose

Living capability specifications preserve the current observable product truth while each Complex change declares a reviewable behavioral delta.

## Requirements

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
integration receipt before reaching integrated completion. Capability base and
replay digests MUST canonicalize Markdown line endings so LF and CRLF forms of
the same requirement are equivalent while actual text changes remain conflicts.
Projection writes MUST be atomic; any failure restores every touched capability
and preserves the same resumable revision. Non-behavioral changes record an
empty integrated projection with their regression receipt.

#### Scenario: Replay and integration succeed across checkout conventions

- **WHEN** the validated source and target contain the same touched requirement with different LF or CRLF line endings
- **THEN** Empirical accepts the requirement as unchanged and replays the delta
- **AND** the integration receipt remains digest-bound to the canonical result

#### Scenario: Projection partially fails

- **WHEN** any capability cannot be committed or verified
- **THEN** Empirical restores every capability already touched
- **AND** the workflow remains resumable without claiming integration

#### Scenario: A touched requirement changes semantically

- **WHEN** the target changes the actual text of a touched requirement after its base is captured
- **THEN** Empirical rejects replay as a capability integration conflict

### Requirement: Capability delta operations are safe and repeatable

Empirical MUST reject unsafe capability names, malformed requirements, duplicate changes, additions of existing requirements, and modifications or removals of missing requirements. Repeating a successful Archive request MUST converge without applying a delta twice.

#### Scenario: Invalid delta is proposed

- **WHEN** a delta cannot be projected unambiguously onto current behavior
- **THEN** Empirical rejects it before changing any living specification

#### Scenario: Successful archive is retried

- **WHEN** an Archive request is repeated after the change reached Done
- **THEN** Empirical reports convergence and leaves capability content unchanged
