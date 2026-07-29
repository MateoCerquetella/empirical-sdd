## Purpose

Give the current coding agent a no-stakes way to investigate vague requests and
turn them into a concrete Fast or Complex request before workflow state is created.

## ADDED Requirements

### Requirement: Explore is read-only discovery
The system SHALL expose the same Explore packet through CLI, MCP, and TypeScript,
including investigation guidance, decision questions, and explicit next actions.

#### Scenario: Agent explores a vague problem
- **WHEN** Explore receives a non-empty problem statement
- **THEN** it returns structured discovery guidance without changing state, revisions, events, specifications, or capabilities

### Requirement: Explore never runs an AI runtime
Explore SHALL instruct the already-open host agent to inspect relevant code,
compare options, and ask only material questions; it MUST NOT launch a model,
daemon, subprocess agent, or network service.

#### Scenario: Exploration is ready to become work
- **WHEN** the host agent has refined the problem into an explicit outcome
- **THEN** the packet directs it to select Fast only if eligibility is certain and Complex otherwise
