# Worktree Isolation

## Purpose

Use Git worktrees as Empirical's single parallel-work isolation model while
keeping workflow state feature-scoped and setup preferences safely reviewable.

## MODIFIED Requirements

### Requirement: Worktree preferences are explicit and durable

The in-agent Init contract SHALL present one compact current or recommended
settings summary before mutating repository configuration. The summary MUST
include isolation mode, resolved or explicit base, sibling worktree path, branch
pattern, evidence policy, and Complex decision-record policy, and MUST offer
Apply/Keep, Customize, and Cancel. Customize SHALL edit one section at a time,
validate values before save, show the final effective configuration, and persist
only after explicit confirmation. Existing setup values MUST be preserved unless
edited. Internal CLI and MCP inputs MUST remain deterministic and equivalent for
automation, and no separate public terminal initialization step is required.

#### Scenario: An agent initializes a new repository

- **WHEN** no Empirical configuration exists
- **THEN** the current agent shows all safe defaults before the first configuration write
- **AND** saving persists the approved isolation, evidence, and decision settings

#### Scenario: An agent repairs existing setup

- **WHEN** configuration exists but setup or repository context is partial
- **THEN** the wizard labels existing values as current and defaults to keeping them
- **AND** omitted or unedited settings are not reset during repair

#### Scenario: The user cancels setup

- **WHEN** the user cancels either the initial summary or final review
- **THEN** repository configuration, Git state, and workflow state remain unchanged
