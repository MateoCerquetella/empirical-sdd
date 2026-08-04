## Purpose

Independent target validation receives reviewed product source without internal
migration candidates or rollback copies.

## ADDED Requirements

### Requirement: Source overlays exclude migration scratch

Integration overlays MUST ignore reserved top-level `.empirical.schema5-*`
paths while preserving conflict detection and restoration for ordinary source.

#### Scenario: Source contains an aborted migration stage

- **WHEN** independent integration validates reviewed source containing reserved scratch
- **THEN** no scratch path appears in the target and every ordinary overlaid path is restored afterward
