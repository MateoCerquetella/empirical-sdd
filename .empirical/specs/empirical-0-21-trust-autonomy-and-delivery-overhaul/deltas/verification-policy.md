# Verification Policy

## Purpose

Make verification executable, provenance-bound, tamper-evident, and suitable
for local and integration validation.

## MODIFIED Requirements

### Requirement: Evidence gates are explicit project configuration

Empirical MUST persist independently addressable criterion, UI-browser,
UI-screenshot, and code-review evidence settings plus exact verification command
vectors and bounded timeouts. Criterion evidence MUST require a valid immutable
receipt for every acceptance criterion when enabled. Browser and screenshot
sub-policies apply only to UI criteria while criterion evidence is enabled;
code-review evidence remains independent. All evidence gates default to enabled,
while default verification commands are detected conservatively and displayed
before persistence.

#### Scenario: Criterion evidence is disabled but review remains enabled

- **WHEN** configuration turns criterion evidence off and code-review evidence on
- **THEN** Verify does not demand criterion browser or screenshot receipts
- **AND** Review still requires a provenance-valid passing review receipt

#### Scenario: UI sub-policies are retained while inactive

- **WHEN** criterion evidence is turned off and later re-enabled
- **THEN** stored browser and screenshot choices remain unchanged
- **AND** the re-enabled gate validates fresh immutable receipts

## ADDED Requirements

### Requirement: Evidence receipts are immutable and provenance-bound

Executed and collected evidence MUST record a receipt id, kind, criterion ids,
specification revision and digest, repository identity and tree digest, exact
redacted provenance, bounded result summary, artifact digests, timestamp, and
receipt digest. Receipt files are append-only; edits, missing artifacts, stale
trees, unknown criteria, duplicate ids, or digest mismatch MUST fail validation.

#### Scenario: A screenshot changes after collection

- **WHEN** its current digest differs from the digest stored in the receipt
- **THEN** verification rejects that criterion as tampered
- **AND** names the receipt and artifact without exposing secret metadata

### Requirement: Verification commands execute without a shell

Configured commands MUST be stored and invoked as exact non-empty argument
vectors with a repository-contained working directory, positive bounded timeout,
bounded captured output, and allowlisted redacted environment metadata. Command
strings, shell operators, parent-directory working paths, and secret persistence
MUST be rejected before execution.

#### Scenario: Policy contains a shell pipeline

- **WHEN** a command is supplied as a string containing shell syntax
- **THEN** policy validation rejects it before process creation
- **AND** no receipt or environment snapshot is written

### Requirement: Integration verification uses an independent target base

Before integration completes, Empirical MUST replay the feature onto the current
target tip in an isolated validation checkout and run all configured commands
there. Receipts MUST bind both feature and target digests.

#### Scenario: The target advances after local verification

- **WHEN** integration starts against the newer target tip
- **THEN** policy commands run against a replay on that tip
- **AND** stale feature-base receipts alone cannot satisfy integration
