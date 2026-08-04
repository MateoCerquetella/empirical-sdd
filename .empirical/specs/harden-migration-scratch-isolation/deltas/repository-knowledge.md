## Purpose

Repository knowledge reflects product source without ingesting duplicated or
partially transformed migration transaction trees.

## ADDED Requirements

### Requirement: Migration scratch is excluded from knowledge fingerprints

Manifest v2 MUST exclude top-level paths whose names begin
`.empirical.schema5-` in Git-backed and filesystem-fallback inventories.

#### Scenario: An aborted stage is present

- **WHEN** repository knowledge is inspected with reserved migration scratch present
- **THEN** its source digest is unchanged while an ordinary source-file change still makes dependent context stale
