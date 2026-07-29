# Exploratory Discovery

## Purpose

Keep Socratic discovery available when ambiguity is material without exposing a
second user-facing workflow entrypoint.

## MODIFIED Requirements

### Requirement: Explore remains an intentional choice

The single generated Empirical entrypoint MUST assess the request and conduct
Explore only when the work is genuinely vague. Concrete work MUST route directly
to the eligible internal Fast or Complex start operation.

#### Scenario: A request is already concrete

- **WHEN** an ordinary coding request has an observable and bounded outcome
- **THEN** the agent starts the appropriate internal workflow without a separate Explore command

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
