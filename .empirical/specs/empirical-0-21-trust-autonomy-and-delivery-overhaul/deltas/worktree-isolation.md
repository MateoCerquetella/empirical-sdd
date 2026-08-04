# Worktree Isolation

## Purpose

Coordinate feature ownership and capability integration across independent Git
worktrees without destructive cleanup.

## MODIFIED Requirements

### Requirement: One active feature per checkout

Empirical MUST run at most one selected non-terminal feature in a checkout,
store portable feature state beneath its feature directory, and keep selection
in checkout-local Git metadata. Repository-wide capability claims and delivery
coordination MUST instead live beneath the Git common directory and identify the
owning worktree. A primary checkout MAY recover one unambiguous feature; a linked
worktree MUST NOT inherit another checkout's selection.

#### Scenario: Two worktrees own separate features

- **WHEN** both features declare disjoint capability claims
- **THEN** each checkout retains only its own active selection
- **AND** the shared claim index records both owners without collision

## ADDED Requirements

### Requirement: Capability claims are shared and atomic

A behavioral Complex feature MUST atomically claim every affected capability in
the Git common directory before implementation. Overlapping live claims MUST be
reported with feature and worktree identity; stale claims MAY be diagnosed but
MUST NOT cause a real worktree or branch to be deleted automatically.

#### Scenario: A second worktree claims an occupied capability

- **WHEN** a live feature already claims that capability
- **THEN** the second claim is rejected without partial writes
- **AND** the existing owner and safe resolution choices are reported

### Requirement: Integration replays from recorded base digests

Each feature MUST record base tree and capability digests. Integration MUST lock
the shared capability set, reload the current target, replay validated deltas,
detect semantic conflicts, and atomically write projections plus a digest-bound
integration receipt.

#### Scenario: An unrelated capability changes on the target

- **WHEN** replayed deltas remain valid against the current projections
- **THEN** integration succeeds and preserves the unrelated change
- **AND** the receipt records original base, target, delta, and result digests

#### Scenario: A modified requirement changed concurrently

- **WHEN** replay cannot unambiguously apply the feature's replacement
- **THEN** integration stops with a semantic conflict
- **AND** no capability projection or claim is partially released
