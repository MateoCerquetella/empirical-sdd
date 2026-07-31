# Verification Policy Specification

## Purpose

Make Empirical's evidence gates visible and configurable while retaining strict,
deterministic defaults and exact automation behavior.

## Requirements

### Requirement: Evidence gates are explicit project configuration

Empirical MUST persist four independently addressable evidence settings:
criterion evidence, browser evidence for UI criteria, screenshot artifacts for
UI criteria, and code-review evidence. Criterion evidence MUST require passing
test evidence for each acceptance criterion when enabled. Its browser and
screenshot sub-policies MUST apply only to criteria marked UI and only while
criterion evidence is enabled. Code-review evidence MUST remain an independent
Review gate. All four settings MUST default to enabled for a new repository.

#### Scenario: Criterion evidence is disabled but review remains enabled

- **WHEN** configuration sets criterion evidence off and code-review evidence on
- **THEN** Verify does not demand per-criterion test/browser/screenshot records
- **AND** Review still requires one passing review record

#### Scenario: UI sub-policies are retained while inactive

- **WHEN** criterion evidence is turned off and later turned back on
- **THEN** the stored browser and screenshot choices are preserved
- **AND** the re-enabled policy resumes enforcing those choices

### Requirement: Init presents evidence choices before persistence

The in-agent Init contract MUST show the effective values of all four evidence
settings in its initial summary and final review. Customize MUST offer a clear
checklist, explain inactive dependent policies, and require confirmation before
persisting changes. Existing values MUST be labeled current and remain unchanged
unless edited.

#### Scenario: A developer customizes first-run verification

- **WHEN** the developer changes one evidence toggle and saves the final review
- **THEN** the effective configuration reflects exactly that change and the shown defaults for the others
- **AND** cancelling instead would leave no partial configuration write

### Requirement: Configuration surfaces have evidence parity

The TypeScript configuration input, MCP Init and Configure operations, JSON
results, and private non-interactive CLI transport MUST accept equivalent
partial inputs for all four evidence settings. Missing fields MUST use strict
defaults for new setup and preserve persisted values during repair or
reconfiguration. Invalid textual flags MUST fail before mutation.

#### Scenario: Automation changes only screenshot policy

- **WHEN** a structured caller submits only `screenshotForUi: false`
- **THEN** Empirical persists that value and preserves the other evidence,
  isolation, and decision settings
- **AND** the returned configuration reports the complete effective policy
