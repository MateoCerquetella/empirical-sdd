# Package Distribution Delta

## ADDED Requirements

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
