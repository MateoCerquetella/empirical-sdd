## ADDED Requirements

### Requirement: Legacy placeholder context remains managed

Schema migration MUST distinguish exact legacy placeholder topic templates from
custom agent-maintained content. Placeholder templates MUST remain managed and
refinement-required; custom content MUST be preserved as unmanaged.

#### Scenario: Schema 4 contains untouched TODO templates

- **WHEN** the project migrates to Schema 5
- **THEN** those templates are marked as managed/refinement-required
- **AND** custom non-placeholder topic pages remain unmodified
