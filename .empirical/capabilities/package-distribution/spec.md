# Package Distribution Specification

## Purpose

Define how an Empirical npm release remains internally consistent and usable by
a clean consumer.

## Requirements

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

### Requirement: Clean registry consumption

After publication, the exact npm version MUST install in a new consumer without
repository-local files, and its packaged binary MUST report the published
version and expose the documented public CLI. Registry verification MUST confirm
the intended dist-tag before the release is reported complete.

#### Scenario: A developer installs the published version

- **WHEN** a clean consumer installs the exact released package from npm
- **THEN** the executable reports the same immutable version
- **AND** its help matches the documented public command surface
- **AND** the package contains only declared distribution files

### Requirement: Public release surfaces converge

Every completed release MUST expose one immutable semantic version through the
merged default-branch commit, annotated Git tag, GitHub release, npm version,
and intended dist-tag. Retries MUST recognize identical existing artifacts;
conflicting tags, versions, or releases MUST stop without deletion or replacement.

#### Scenario: A retry finds the identical published version

- **WHEN** digests, merged commit, tag, release, package, and dist-tag all match
- **THEN** publication converges without creating replacements
- **AND** status reports published from verified remote state

### Requirement: Package exports are narrow and tested

The package MUST expose only its supported root API and explicit `./protocol`,
`./mcp`, and `./integrations` entrypoints. Internal source and storage modules
MUST be unreachable through package exports, and declaration/runtime shapes MUST
be verified from a clean packed consumer.

#### Scenario: A clean consumer imports supported entrypoints

- **WHEN** the packed package is installed without repository-local files
- **THEN** all four supported entrypoints import and type-check
- **AND** an attempted internal subpath import is rejected by package exports
