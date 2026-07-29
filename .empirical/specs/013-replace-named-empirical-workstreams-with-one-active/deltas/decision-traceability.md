# Decision Traceability

## Purpose

Make material implementation decisions explainable and reviewable without
capturing private model reasoning.

## ADDED Requirements

### Requirement: Complex changes record material decisions

Every Complex feature MUST maintain a concise decision record covering evidence,
options, chosen approach, consequences or risks, and verification. The record
MUST NOT request or store private chain-of-thought, secrets, prompt transcripts,
or token-level reasoning.

#### Scenario: Design chooses an architectural approach

- **WHEN** the agent completes Complex Design
- **THEN** the feature's decision record identifies the evidence and alternatives that support the chosen approach

### Requirement: Review enforces decision alignment

Review MUST compare the implementation with accepted decisions and MUST require
an explicit superseding entry when later evidence changes a material choice.

#### Scenario: Implementation deviates from an accepted decision

- **WHEN** Review finds a contradictory implementation without a superseding decision
- **THEN** completion is rejected and routed back to implementation

### Requirement: Explain exposes deterministic rationale

Empirical SHALL expose a read-only human and structured explanation of current
state, next-action reason, required and missing context, stop/proceed gate, and
accepted decision summaries.

#### Scenario: A developer asks why Empirical is waiting

- **WHEN** the developer invokes Explain
- **THEN** the result identifies the observable gate and evidence without disclosing hidden model reasoning
