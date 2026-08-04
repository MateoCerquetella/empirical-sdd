# Exploratory Discovery Specification

## Purpose

Exploratory discovery lets an agent clarify genuinely vague product work before committing the repository to a workflow revision.

## Requirements

### Requirement: Explore is a pure discovery operation

The MCP, TypeScript, JSON CLI, and explicit non-interview Explore interfaces MUST return consistent guidance, questions, project context, capability context, and concrete Fast or Complex next commands without creating a feature, event, revision, discovery record, or agent runtime.

#### Scenario: Automation investigates vague work

- **WHEN** an agent or script invokes Explore through MCP, TypeScript, `--json`, or `--no-interview`
- **THEN** Empirical returns a deterministic discovery packet and leaves all repository state unchanged

### Requirement: Explore remains an intentional choice

The automatic skill MUST conduct discovery only for genuinely vague work. The
explicit Socratic skill MUST always conduct discovery. Concrete requests MUST
route directly through deterministic risk classification. YOLO MUST ask a
question only when multiple materially different product contracts remain and
repository context, policy, prior decisions, and safe defaults cannot select one
correctly.

#### Scenario: YOLO receives a concrete cross-cutting request

- **WHEN** scope, outcome, safety ceiling, and verification are recoverable from the request and repository
- **THEN** routing selects Complex without an interview
- **AND** the workflow advances under its recorded authorization

### Requirement: Interactive Explore conducts a Socratic interview

An interactive terminal Explore MUST ask the original five discovery passes one question at a time, add only material follow-ups, show the refined request, and require explicit approval before starting workflow state.

#### Scenario: A developer explores a vague browser-game idea

- **WHEN** the developer runs `empirical explore` in a terminal and answers the interview
- **THEN** Empirical asks domain-relevant questions about the user/problem, observable core loop, MVP boundaries, failure risks, and real browser verification before requesting approval

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

Automatic or explicit Socratic discovery MUST conduct the five passes one
question at a time, ask only material follow-ups, reflect answers, present the
complete refined contract, and wait for approval before creating normal-mode
workflow state. The explicit skill MUST draft Specify artifacts and wait for a
second approval. YOLO uses the same durable five-pass record only when a blocker
requires discovery; otherwise it MUST NOT manufacture questions or approvals.

#### Scenario: A YOLO product ambiguity blocks a correct contract

- **WHEN** two incompatible user-visible outcomes remain after repository research
- **THEN** Empirical asks the minimum discriminating question and persists its answer
- **AND** resumes automatically once the blocker is resolved

### Requirement: Approved agent-native discovery is structurally validated

The MCP and private automation surface SHALL accept an approved five-pass
discovery handoff only when every required pass occurs exactly once and each
question and answer is non-empty. It MUST persist the validated record and
return either the created Complex action or a non-mutating isolation proposal.

#### Scenario: An agent submits incomplete discovery

- **WHEN** one pass is missing, duplicated, empty, or unapproved
- **THEN** Empirical rejects the handoff with actionable validation guidance
- **AND** no feature or active workflow is created
