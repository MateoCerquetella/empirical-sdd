## MODIFIED Requirements

### Requirement: Published release integrity

The context-refinement fix release candidate MUST use version `0.22.1` across
all public surfaces and pass every existing release gate. Delivery and npm
publication MUST remain pending until exact source, evidence, and publication
authorizations are present.

#### Scenario: The context-refinement patch is prepared

- **WHEN** the repository produces the `0.22.1` candidate
- **THEN** tests, packed-consumer checks, runtime diagnostics, and manifest versions agree
- **AND** no protected delivery or publication step is bypassed
