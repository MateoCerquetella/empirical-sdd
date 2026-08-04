# Worktree Isolation Specification

## Purpose

Use Git worktrees as Empirical's single parallel-work isolation model while
keeping workflow state feature-scoped and safely resumable.

## Requirements

### Requirement: One active feature per checkout

Empirical MUST run at most one selected non-terminal feature in a checkout,
store portable feature state beneath its feature directory, and keep the active
selection in checkout-local Git metadata. A primary checkout without local
metadata MAY recover one unambiguous non-terminal feature for compatibility; a
new linked worktree MUST NOT inherit another checkout's active selection.

#### Scenario: A linked worktree starts from history containing blocked state

- **WHEN** the approved linked worktree is created from a commit containing a blocked feature owned by another checkout
- **THEN** the new checkout starts its intended feature rather than inheriting the blocked selection
- **AND** the owning checkout can still resume its blocked feature

### Requirement: Unrelated work requires approved isolation

When the current checkout has selected active work, Empirical SHALL propose an
editable base, change type, branch, and sibling path and SHALL NOT create a
worktree until the human explicitly approves that exact proposal. Successful
creation MUST establish checkout-local ownership of the intended new feature.

#### Scenario: The user approves a proposed feature worktree

- **WHEN** the user approves the exact branch, path, base, and request
- **THEN** Empirical creates the linked worktree without force
- **AND** starts the exact request there even if portable history contains another checkout's feature state

### Requirement: Worktree creation preserves repository safety

Empirical MUST block worktree creation for a dirty source checkout, unresolved
base, existing branch, occupied path, or registered worktree collision and MUST
never stash, move changes, reset branches, or pass a force option.

#### Scenario: Local changes are present

- **WHEN** approved worktree creation sees tracked or untracked changes
- **THEN** it stops with a precise recovery message before invoking `git worktree add`

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

### Requirement: Source overlays exclude migration scratch

Integration overlays MUST ignore reserved top-level `.empirical.schema5-*`
paths while preserving conflict detection and restoration for ordinary source.

#### Scenario: Source contains an aborted migration stage

- **WHEN** independent integration validates reviewed source containing reserved scratch
- **THEN** no scratch path appears in the target and every ordinary overlaid path is restored afterward
