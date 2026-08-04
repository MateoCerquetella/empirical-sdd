## Purpose

Verification provenance binds product source rather than internal migration
copies that cannot affect the built behavior.

## ADDED Requirements

### Requirement: Evidence tree digests exclude migration scratch

Repository tree digests MUST ignore top-level `.empirical.schema5-*` transaction
paths in both Git and filesystem traversal modes.

#### Scenario: Scratch appears between evidence operations

- **WHEN** reserved migration scratch is created without changing product source
- **THEN** the tree digest remains stable and ordinary source changes still produce a new digest
