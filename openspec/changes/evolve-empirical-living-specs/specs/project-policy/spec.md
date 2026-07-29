## Purpose

Let teams commit concise domain context and phase-specific guidance that improves
agent decisions while preserving Empirical's non-negotiable safety instructions.

## ADDED Requirements

### Requirement: Project policy enriches action packets
The system SHALL load committed project context and optional phase guidance and
append relevant content to action packets for the current host agent.

#### Scenario: A project customizes design guidance
- **WHEN** the Design action is returned for a project with design-specific policy
- **THEN** the action includes that policy after the mandatory Design and safety instructions

### Requirement: Policy cannot weaken protocol guarantees
Custom context and guidance MUST NOT remove, replace, or disable revision checks,
evidence gates, UI requirements, review, archive, or stop conditions.

#### Scenario: Policy contains conflicting guidance
- **WHEN** project policy asks an agent to skip a mandatory gate
- **THEN** the built-in instruction remains authoritative and completion is still rejected without required evidence

### Requirement: Policy remains project-local
Policy SHALL be stored in committed `.empirical/` files and SHALL require no
home-directory integration, API key, daemon, cloud service, or OpenSpec runtime.

#### Scenario: Repository moves to another agent
- **WHEN** a collaborator clones and initializes the repository integrations
- **THEN** the same policy is available to every supported terminal-capable agent
