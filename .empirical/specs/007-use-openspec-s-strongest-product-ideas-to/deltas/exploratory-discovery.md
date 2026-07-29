## Purpose

Exploratory discovery lets an agent clarify genuinely vague product work before committing the repository to a workflow revision.

## ADDED Requirements

### Requirement: Explore is a pure discovery operation

The CLI, MCP, and TypeScript Explore interfaces MUST return consistent guidance, questions, project context, capability context, and concrete Fast or Complex next commands without creating a feature, event, revision, or agent runtime.

#### Scenario: Vague work needs discovery

- **WHEN** an agent invokes Explore with a non-empty problem
- **THEN** Empirical returns a deterministic discovery packet and leaves all workflow state unchanged

### Requirement: Explore remains an intentional choice

Generated agent guidance MUST use Explore only when the problem is genuinely vague and MUST start Fast or Complex directly once the desired behavior is concrete.

#### Scenario: Request is already concrete

- **WHEN** an ordinary coding request has an observable and bounded outcome
- **THEN** the agent selects Fast or Complex without adding a discovery round trip
