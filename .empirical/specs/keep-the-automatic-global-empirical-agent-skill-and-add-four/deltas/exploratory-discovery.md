# Exploratory Discovery

## Purpose

Preserve automatic ambiguity handling while restoring an explicit, durable
Socratic specification path for developers who want deliberate discovery.

## MODIFIED Requirements

### Requirement: Explore remains an intentional choice

The automatic Empirical skill MUST conduct discovery only when work is
genuinely vague. The explicit Socratic skill MUST conduct discovery whenever it
is invoked. A concrete request entering the automatic skill MUST route directly
to the eligible internal Fast or Complex operation.

#### Scenario: A developer deliberately requests Socratic discovery

- **WHEN** the developer invokes `empirical-socratic` with an idea
- **THEN** ambiguity is explored even if the initial sentence appears concise
- **AND** automatic routing behavior remains unchanged for ordinary `empirical` requests

### Requirement: Discovery is durable and hands off exactly

Discovery MUST persist draft and approved answers, derive one refined request
from the approved five-pass record, and bind that exact request to the created
Complex workflow. A failed or worktree-proposed start MUST NOT falsely mark the
record as started. After specification approval, continuation or handoff remains
explicit and agent-neutral.

#### Scenario: An approved interview becomes a Complex specification

- **WHEN** all five answers and the displayed refined request are approved
- **THEN** the durable discovery record is bound to a Complex Specify action
- **AND** its stored refined request matches the workflow request exactly

### Requirement: Agent integrations use the full Socratic contract

Both automatic discovery and the explicit Socratic skill MUST conduct the five
passes one question at a time, ask only material follow-ups, reflect material
answers, present the complete refined contract, and wait for approval before
creating workflow state. The explicit skill MUST then draft the required
Specify artifacts and wait for a second approval before completing Specify.

#### Scenario: A vague product idea enters the Socratic skill

- **WHEN** a supported agent receives the idea through `empirical-socratic`
- **THEN** it covers user/problem, outcome, boundaries, risk, and verification
- **AND** neither workflow creation nor implementation occurs before its corresponding approval

## ADDED Requirements

### Requirement: Approved agent-native discovery is structurally validated

The MCP and private automation surface SHALL accept an approved five-pass
discovery handoff only when every required pass occurs exactly once and each
question and answer is non-empty. It MUST persist the validated record and
return either the created Complex action or a non-mutating isolation proposal.

#### Scenario: An agent submits incomplete discovery

- **WHEN** one pass is missing, duplicated, empty, or unapproved
- **THEN** Empirical rejects the handoff with actionable validation guidance
- **AND** no feature or active workflow is created
