# Package Distribution

## Purpose

Ship a narrow supported API on maintained Node runtimes and preserve immutable
release convergence.

## MODIFIED Requirements

### Requirement: Published release integrity

Every published Empirical version MUST use one matching immutable version across
its manifest, runtime diagnostics, tests, tags, releases, and release-facing
documentation. It MUST pass repository CI, coverage gates, package dry-run, and
clean-consumer verification on supported Node 22, 24, and 26 before publication.

#### Scenario: A release candidate is explicitly requested

- **WHEN** the exact unused version is prepared
- **THEN** all version surfaces and supported-runtime checks converge
- **AND** publication remains pending until the release authorization is present

### Requirement: Public release surfaces converge

Every completed release MUST expose one immutable semantic version through the
merged default-branch commit, annotated Git tag, GitHub release, npm version,
and intended dist-tag. Retries MUST recognize identical existing artifacts;
conflicting tags, versions, or releases MUST stop without deletion or replacement.

#### Scenario: A retry finds the identical published version

- **WHEN** digests, merged commit, tag, release, package, and dist-tag all match
- **THEN** publication converges without creating replacements
- **AND** status reports published from verified remote state

## ADDED Requirements

### Requirement: Package exports are narrow and tested

The package MUST expose only its supported root API and explicit `./protocol`,
`./mcp`, and `./integrations` entrypoints. Internal source and storage modules
MUST be unreachable through package exports, and declaration/runtime shapes MUST
be verified from a clean packed consumer.

#### Scenario: A clean consumer imports supported entrypoints

- **WHEN** the packed package is installed without repository-local files
- **THEN** all four supported entrypoints import and type-check
- **AND** an attempted internal subpath import is rejected by package exports
