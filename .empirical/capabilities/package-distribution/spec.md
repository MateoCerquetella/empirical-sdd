# Package Distribution Specification

## Purpose

Define how an Empirical npm release remains internally consistent and usable by
a clean consumer.

## Requirements

### Requirement: Published release integrity

Every published Empirical version MUST use one matching version across its npm
manifest, runtime diagnostics, tests, and release-facing documentation. The
release MUST pass the complete repository CI and package dry-run before npm
publication.

#### Scenario: A release candidate is ready to publish

- **WHEN** the maintainer prepares a new immutable npm version
- **THEN** all intentional product-version surfaces report that exact version
- **AND** type checking, tests, built smoke, and package inspection pass

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

Every completed Empirical release MUST expose one immutable semantic version
through the merged default-branch commit, an annotated git tag, a published
GitHub release, the npm package version, and the intended npm dist-tag. The git
tag and GitHub release MUST identify the merged release commit, and public
registry verification MUST succeed before the release is reported complete.

#### Scenario: A maintainer completes a public release

- **WHEN** the release pull request has passed required checks and merged
- **THEN** the annotated version tag points at that merged release commit
- **AND** GitHub publishes release notes for the same version tag
- **AND** npm exposes the same exact version under the intended dist-tag
- **AND** a clean consumer installs and runs that immutable registry version
