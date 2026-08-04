# Agent Handoff

## Purpose

Keep external-agent selection explicit in normal mode while allowing a bounded
YOLO preference to be honored without treating policy as authority.

## MODIFIED Requirements

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
