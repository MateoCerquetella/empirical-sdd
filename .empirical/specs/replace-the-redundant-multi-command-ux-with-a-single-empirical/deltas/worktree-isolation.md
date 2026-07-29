# Worktree Isolation

## Purpose

Use Git worktrees for source isolation while binding active workflow ownership
to the checkout that actually owns the session.

## MODIFIED Requirements

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

### Requirement: Worktree preferences are explicit and durable

The single agent entrypoint SHALL initialize safe worktree and decision defaults
inside the current conversation and SHALL ask only material first-run questions.
Internal CLI and MCP initialization flags MUST remain deterministic for automation.

#### Scenario: An agent initializes a repository

- **WHEN** no Empirical configuration exists
- **THEN** the current agent applies or confirms isolation, base, path, branch, and decision settings
- **AND** the user does not need a separate terminal initialization step
