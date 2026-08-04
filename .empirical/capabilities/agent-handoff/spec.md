# Agent Handoff Specification

## Purpose

Let a user continue an approved specification in the current agent, save it, or
explicitly hand it to another locally available agent.

## Requirements

### Requirement: Detection is capability-aware

Empirical MUST detect supported local agent executables conservatively and MUST
distinguish prompt-capable CLI sessions from workspace-only IDE launchers. The
executable handoff registry MUST be independent from the broader global skill-
installation catalog: a skill path, installed Empirical skill, configuration
directory, or upstream catalog entry alone MUST NOT make an agent eligible for
handoff.

#### Scenario: Several agents can read Empirical skills

- **WHEN** Empirical builds a handoff offer
- **THEN** it includes only agents with explicit executable and launch-capability metadata
- **AND** it does not include skill-only targets or claim that a workspace-only launcher accepts a prompt

### Requirement: Handoff proposals are exact and read-only

A handoff proposal MUST include the active feature, repository cwd, approved
specification path, prompt, and exact argv while leaving processes and project
state unchanged.

#### Scenario: A Complex specification passes

- **WHEN** the agent requests handoff choices
- **THEN** Empirical returns current, save, and detected-agent options
- **AND** no target is launched by detection or proposal

### Requirement: External launch requires explicit approval

Normal mode MUST NOT start an external agent until the human selects and
approves an exact proposal. YOLO MAY launch the configured preferred supported
agent only when the standing authorization explicitly includes external handoff
and the fresh proposal matches repository, feature, specification, executable,
arguments, and working directory. Configuration alone grants no launch
authority; stale, edited, unsupported, or scope-exceeding proposals MUST fail.

#### Scenario: Normal mode proposes a detected CLI agent

- **WHEN** the user has not approved its exact launch token
- **THEN** Empirical leaves process and project state unchanged
- **AND** returns current, save, and detected-agent choices

#### Scenario: Authorized YOLO prefers the current agent

- **WHEN** no supported external agent preference is configured
- **THEN** the current agent continues the workflow
- **AND** no discovery question or process launch is introduced
