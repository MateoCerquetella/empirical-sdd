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

The single agent entrypoint SHALL initialize safe worktree and decision defaults
inside the current conversation and SHALL ask only material first-run questions.
Internal CLI and MCP initialization flags MUST remain deterministic for automation.

#### Scenario: An agent initializes a repository

- **WHEN** no Empirical configuration exists
- **THEN** the current agent applies or confirms isolation, base, path, branch, and decision settings
- **AND** the user does not need a separate terminal initialization step
