## Purpose

Migration reports must be portable evidence that can be compared across every
supported operating system.

## ADDED Requirements

### Requirement: Migration reports use portable repository paths

Every migration report MUST identify repository-contained artifacts with
forward-slash relative paths regardless of the host operating system.

#### Scenario: Schema 4 migrates on Windows

- **WHEN** migration writes its immutable Schema-4-to-Schema-5 receipt
- **THEN** the report returns `.empirical/migrations/schema-4-to-5.json`
- **AND** the same observable path is returned on macOS and Linux
