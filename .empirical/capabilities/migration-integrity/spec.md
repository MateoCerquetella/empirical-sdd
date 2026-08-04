# Migration Integrity Specification

## Purpose

This capability keeps Schema migration transaction scratch recoverable,
diagnosable, and separate from promoted repository state.

## Requirements

### Requirement: Unmarked failed candidates are cleaned

The migrator MUST remove the exact stage it created when candidate transform or
validation fails before a durable migration marker is written, while preserving
the original Schema-4 source.

#### Scenario: Candidate transformation fails

- **WHEN** a Schema-4 candidate contains an unsupported historical event
- **THEN** migration fails with the source unchanged and no stage, backup, or marker remains

### Requirement: Orphan migration scratch is diagnosed read-only

Doctor MUST report reserved migration stage or backup directories that have no
active recovery transaction and MUST NOT remove or modify them.

#### Scenario: Doctor finds an orphan stage

- **WHEN** a reserved stage directory exists without a migration marker
- **THEN** Doctor returns actionable orphan-scratch diagnostics and preserves its bytes

### Requirement: Migration reports use portable repository paths

Every migration report MUST identify repository-contained artifacts with
forward-slash relative paths regardless of the host operating system.

#### Scenario: Schema 4 migrates on Windows

- **WHEN** migration writes its immutable Schema-4-to-Schema-5 receipt
- **THEN** the report returns `.empirical/migrations/schema-4-to-5.json`
- **AND** the same observable path is returned on macOS and Linux
