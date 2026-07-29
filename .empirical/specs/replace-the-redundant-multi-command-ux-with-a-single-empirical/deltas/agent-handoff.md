# Agent Handoff

## Purpose

Let a user continue an approved specification in the current agent, save it, or
explicitly hand it to another locally available agent.

## ADDED Requirements

### Requirement: Detection is capability-aware

Empirical MUST detect supported local agent executables conservatively and MUST
distinguish prompt-capable CLI sessions from workspace-only IDE launchers.

#### Scenario: Several agent binaries are on PATH

- **WHEN** Empirical builds a handoff offer
- **THEN** it reports each detected agent's identifier, executable, and launch capability
- **AND** it does not claim that a workspace-only launcher accepts a prompt

### Requirement: Handoff proposals are exact and read-only

A handoff proposal MUST include the active feature, repository cwd, approved
specification path, prompt, and exact argv while leaving processes and project
state unchanged.

#### Scenario: A Complex specification passes

- **WHEN** the agent requests handoff choices
- **THEN** Empirical returns current, save, and detected-agent options
- **AND** no target is launched by detection or proposal

### Requirement: External launch requires explicit approval

No external agent process may start until the human selects a displayed target
and explicitly approves its exact proposal. Structured callers MUST echo an
approval token or equivalent exact proposal data.

#### Scenario: The user approves one detected CLI agent

- **WHEN** the approved launch data still matches the current feature and specification
- **THEN** the host may start that exact agent command in the repository
- **AND** stale, edited, unsupported, or unapproved launch requests are rejected

#### Scenario: The user saves the handoff

- **WHEN** the user chooses save
- **THEN** the specification remains resumable and no process is created
