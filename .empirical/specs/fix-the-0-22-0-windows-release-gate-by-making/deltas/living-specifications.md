## Purpose

Living capability integration must recognize equivalent Markdown bytes across
platform checkout conventions without hiding semantic changes.

## MODIFIED Requirements

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
