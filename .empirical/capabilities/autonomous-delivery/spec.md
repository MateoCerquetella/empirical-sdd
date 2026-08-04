# Autonomous Delivery Specification

## Purpose

Deliver verified work through protected GitHub workflows under explicit,
bounded authorization while keeping release publication opt-in.

## Requirements

### Requirement: Standing authorization is bounded and durable

YOLO MUST persist the exact authorized scope, repository identity, requested
delivery ceiling, target branch, and expiry condition before autonomous work.
Policy configuration MAY choose defaults but MUST NOT itself grant authority.

#### Scenario: YOLO is requested without publication

- **WHEN** the user authorizes implementation and GitHub delivery only
- **THEN** standing authorization permits work through delivered
- **AND** any publication transition remains unauthorized

### Requirement: GitHub delivery uses a protected two-pull-request sequence

Authorized delivery MUST create intentional source commits, push without force,
open a source pull request, wait for configured required checks, request a normal
merge, and then submit resulting evidence and living-specification changes in a
follow-up evidence pull request. Exact Git and GitHub CLI argument vectors and
remote identifiers MUST be retained as redacted receipts.

#### Scenario: Source checks pass on a protected branch

- **WHEN** GitHub reports every required source check successful
- **THEN** Empirical requests an ordinary protected merge without admin bypass
- **AND** it waits for the merged commit before preparing the evidence pull request

### Requirement: Delivery failures remain resumable and truthful

Every remote mutation MUST have an idempotency key or observable convergence
check. A retry MUST reuse or recognize matching commits, branches, pull
requests, checks, and merges rather than duplicate them or report delivery from
local state alone.

#### Scenario: A process stops after opening the source pull request

- **WHEN** YOLO resumes with the same authorization and delivery record
- **THEN** it discovers and reuses the matching pull request
- **AND** continues from its actual remote check state

### Requirement: Publication is exact and explicitly requested

Publication MUST require a separate explicit request naming the immutable
version and intended dist-tag. Existing tags, package versions, or releases MUST
be verified and reused only when identical; conflicting immutable artifacts MUST
stop the workflow and MUST NOT be replaced.

#### Scenario: Ordinary YOLO reaches delivered

- **WHEN** no release version was explicitly authorized
- **THEN** the workflow terminates at delivered
- **AND** no tag, GitHub release, registry publish, or dist-tag mutation occurs
