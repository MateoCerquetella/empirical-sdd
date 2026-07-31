# Agent Handoff

## Purpose

Let a user continue an approved specification in the current agent, save it, or
explicitly hand it to another locally available and launch-capable agent.

## MODIFIED Requirements

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
