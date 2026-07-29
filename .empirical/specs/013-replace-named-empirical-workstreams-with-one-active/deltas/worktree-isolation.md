# Worktree Isolation

## Purpose

Use Git worktrees as Empirical's single parallel-work isolation model while
keeping workflow state feature-scoped and safely resumable.

## ADDED Requirements

### Requirement: One active feature per checkout

Empirical MUST run at most one non-terminal feature in a checkout and MUST store
its state, journal, lock, decisions, specification, and evidence inside that
feature's portable directory.

#### Scenario: Parallel branches start from one base

- **WHEN** two clean linked worktrees start different features from the same base
- **THEN** their descriptive feature directories, states, journals, and revisions do not share mutable root paths

### Requirement: Unrelated work requires approved isolation

When a checkout already has active work, Empirical SHALL propose an editable
base, change type, branch, and sibling path and SHALL NOT create a worktree until
the human explicitly approves that exact proposal.

#### Scenario: The user approves a proposed feature worktree

- **WHEN** the user approves the displayed branch, path, and base
- **THEN** Empirical creates the linked worktree without force and starts the exact request there

#### Scenario: The user cancels

- **WHEN** the user declines or edits without final approval
- **THEN** Git, project files, and the active workflow remain unchanged

### Requirement: Worktree creation preserves repository safety

Empirical MUST block worktree creation for a dirty source checkout, unresolved
base, existing branch, occupied path, or registered worktree collision and MUST
never stash, move changes, reset branches, or pass a force option.

#### Scenario: Local changes are present

- **WHEN** approved worktree creation sees tracked or untracked changes
- **THEN** it stops with a precise recovery message before invoking `git worktree add`

### Requirement: Worktree preferences are explicit and durable

Interactive initialization SHALL ask once for worktree and decision preferences,
persist them in project configuration, and allow later interactive or flag-based
reconfiguration while automation uses deterministic safe defaults.

#### Scenario: A developer initializes in a terminal

- **WHEN** no worktree preferences exist
- **THEN** Empirical confirms isolation mode, detected base, path template, branch pattern, and decision-record policy one question at a time
