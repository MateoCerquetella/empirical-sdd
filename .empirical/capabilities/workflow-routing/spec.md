# Workflow Routing Specification

## Purpose

Make workflow selection, approval behavior, and completion reporting exact and
machine-readable.

## Requirements

### Requirement: Routing is deterministic and inspectable

Every routed request MUST return the selected profile, execution mode, risk
floor, rationale codes, and material gates. Equal repository state, policy, and
request inputs MUST produce an equal routing decision.

#### Scenario: Automation routes the same request twice

- **WHEN** the repository, policy, and request are unchanged
- **THEN** both route packets select the same profile and risk floor
- **AND** their rationale codes and required gates are identical

### Requirement: Fast has a contract-neutral risk floor

Fast MAY handle only work classified as contract-neutral. Behavioral,
security-sensitive, migration, integration, delivery, publication, or otherwise
material work MUST be promoted to Complex even when a caller asks for Fast.

#### Scenario: A caller requests Fast for a schema migration

- **WHEN** routing detects persisted-state or compatibility impact
- **THEN** the request is promoted to Complex with a migration rationale
- **AND** no Fast feature state is created

### Requirement: Execution modes have exact approval semantics

Normal mode MUST pause at material human approval gates. YOLO mode MUST record
standing authorization and continue through non-blocking gates, but MUST NOT
claim authority over host prompts, credentials, protected branches, destructive
Git operations, or publication that was not explicitly requested.

#### Scenario: A YOLO workflow encounters a host permission prompt

- **WHEN** the host requires user approval to access an external resource
- **THEN** Empirical reports the prompt as an external blocker
- **AND** it does not synthesize, suppress, or claim that approval

### Requirement: Completion levels are precise

Status MUST distinguish implemented, verified, integrated, delivered, and
published completion and MUST derive each level from durable state and receipts.
A lower level MUST never be described using a higher-level success term.

#### Scenario: Verification passes before integration

- **WHEN** all verification receipts pass but capability replay has not completed
- **THEN** status reports `verified` as the highest completion level
- **AND** integrated, delivered, and published remain false with reasons
