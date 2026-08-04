# Package Distribution Delta

## Purpose

Bind minor releases to the complete intended, integrated source candidate and
make generated-output exclusion and durable delivery provenance observable.

## MODIFIED Requirements

### Requirement: Published release integrity

Every published Empirical version MUST use one matching immutable version across
its manifest, lockfile, runtime diagnostics, tests, tags, releases, npm package,
dist-tag, and release-facing documentation. The release source MUST contain the
complete explicitly approved candidate and its integrated capability evidence,
while excluding generated coverage, build output, temporary archives, and
credentials. It MUST pass repository CI, coverage gates, package dry-run,
supported Node 22, 24, and 26 checks, and clean-consumer verification before
publication. Protected delivery and publication receipts MUST bind the exact
source commit to the evidence commit and public artifacts.

#### Scenario: A complete minor release candidate is explicitly requested

- **WHEN** the exact unused minor version and intended working-tree scope are approved
- **THEN** every public version surface and supported-runtime check converges
- **AND** generated output and unrelated files are absent from the package and source commit
- **AND** publication remains pending until exact source, evidence, and publication authorizations are present
