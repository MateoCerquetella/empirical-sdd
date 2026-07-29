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

The single generated Empirical entrypoint MUST assess the request and conduct
Explore only when the work is genuinely vague. Concrete work MUST route directly
to the eligible internal Fast or Complex start operation.

#### Scenario: A request is already concrete

- **WHEN** an ordinary coding request has an observable and bounded outcome
- **THEN** the agent starts the appropriate internal workflow without a separate Explore command

### Requirement: Interactive Explore conducts a Socratic interview

An interactive terminal Explore MUST ask the original five discovery passes one question at a time, add only material follow-ups, show the refined request, and require explicit approval before starting workflow state.

#### Scenario: A developer explores a vague browser-game idea

- **WHEN** the developer runs `empirical explore` in a terminal and answers the interview
- **THEN** Empirical asks domain-relevant questions about the user/problem, observable core loop, MVP boundaries, failure risks, and real browser verification before requesting approval

### Requirement: Discovery is durable and hands off exactly

Discovery MUST persist draft and approved answers, bind the approved refined
request to the created workflow, and after Complex Specify passes offer current,
save, or detected-agent handoff. Handoff MUST remain explicit and agent-neutral.

#### Scenario: An approved brief becomes a specification

- **WHEN** the refined request is approved and Complex Specify passes
- **THEN** the current agent offers to continue, save, or hand off to a detected agent
- **AND** declining or saving launches nothing

### Requirement: Agent integrations use the full Socratic contract

The one generated Empirical instruction MUST conduct the five passes one at a
time, ask only material follow-ups, present the complete refined contract, and
wait for approval before creating workflow state.

#### Scenario: A vague request is sent inside an agent

- **WHEN** a supported current agent receives an ambiguous product idea
- **THEN** the same Empirical entrypoint interviews the user adaptively
- **AND** no separate Explore skill or runtime is required
