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

Generated agent guidance MUST use Explore only when the problem is genuinely vague and MUST start Fast or Complex directly once the desired behavior is concrete.

#### Scenario: Request is already concrete

- **WHEN** an ordinary coding request has an observable and bounded outcome
- **THEN** the agent selects Fast or Complex without adding a discovery round trip

### Requirement: Interactive Explore conducts a Socratic interview

An interactive terminal Explore MUST ask the original five discovery passes one question at a time, add only material follow-ups, show the refined request, and require explicit approval before starting workflow state.

#### Scenario: A developer explores a vague browser-game idea

- **WHEN** the developer runs `empirical explore` in a terminal and answers the interview
- **THEN** Empirical asks domain-relevant questions about the user/problem, observable core loop, MVP boundaries, failure risks, and real browser verification before requesting approval

### Requirement: Discovery is durable and hands off exactly

Interactive discovery MUST persist draft and approved answers in JSON and Markdown, allow save or restart without a feature revision, and bind an approved Fast or Complex handoff to the refined request. External agent launch MUST be explicit and optional.

#### Scenario: An approved interview starts Complex

- **WHEN** the developer approves the brief and selects Complex
- **THEN** Empirical records the handoff, creates the Complex Specify action at the next exact revision, and can launch the explicitly selected Codex runtime against that active work

### Requirement: Agent integrations use the full Socratic contract

Generated agent instructions MUST conduct the same five passes one question at a time, ask only material follow-ups, present a refined contract for human approval, and start Fast or Complex only after approval.

#### Scenario: A vague request is sent inside Codex

- **WHEN** the current Codex agent receives an ambiguous product idea
- **THEN** it interviews the user adaptively in the current conversation and does not create workflow state until the refined contract is approved
