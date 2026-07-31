# Release 0 20 4

## Request

> Release the already implemented and verified Empirical CLI branding update as version 0.20.4. Include the complete intended working-tree changes, rerun release validation, commit them on a release branch, push and merge through GitHub with required checks passing, publish empirical-sdd@0.20.4 to npm with the latest dist-tag, create and push the matching annotated v0.20.4 git tag and GitHub release notes, then verify the public npm package, tag, GitHub release, and a clean install. Do not alter feature behavior or include unrelated changes.

## Goal

Publish the completed CLI-branding capability as one internally consistent,
publicly consumable `0.20.4` release across GitHub and npm.

## Acceptance Criteria

- [ ] [AC-1] The complete intended CLI-branding diff is committed on a release
  branch, opened as a GitHub pull request, passes the repository's required
  checks, and is merged into the default branch without unrelated changes.
- [ ] [AC-2] The merged release commit passes `bun run ci`, package inspection,
  and version-consistency checks for exactly `0.20.4` before publication.
- [ ] [AC-3] npm publicly exposes `empirical-sdd@0.20.4`, the `latest` dist-tag
  resolves to `0.20.4`, and the registry tarball contains only declared
  distribution files.
- [ ] [AC-4] The annotated `v0.20.4` git tag points at the merged release commit,
  is present on `origin`, and has a published GitHub release with notes that
  describe the CLI identity, responsive/color behavior, and automation-safe
  output contracts.
- [ ] [AC-5] A clean temporary consumer can install
  `empirical-sdd@0.20.4` from npm, run `empirical --version` and receive only
  `0.20.4`, and run public help with the GoEmpirical banner visible before the
  documented command surface and no ANSI bytes in captured output.
- [ ] [AC-6] Final external verification confirms GitHub's default branch and
  release tag, npm's exact version and `latest` tag, and a clean local worktree
  all converge on the published `0.20.4` release.

## Scope

- Revalidate the already completed `0.20.4` implementation and package.
- Commit the full intended current worktree on `agent/release-0.20.4`.
- Publish through a GitHub pull request with required checks and merge it.
- Create the annotated git tag and GitHub release for the merged commit.
- Publish `empirical-sdd@0.20.4` publicly to npm under `latest`.
- Verify registry metadata, packaged contents, and a clean consumer install.

## Non-goals

- Changing CLI branding behavior after the approved implementation.
- Publishing any version other than `0.20.4` or moving unrelated npm tags.
- Including unrelated local changes, force-pushing, bypassing checks, or
  rewriting existing Git history.
- Publishing unpublished source, test, evidence, or repository-only files in
  the npm tarball.

## Verification

- Run `bun run ci` and `git diff --check` before the release commit.
- Inspect `npm pack --dry-run --json` and the built CLI version/help output.
- Wait for required GitHub pull-request checks and confirm the merge commit.
- Query npm for the exact version, `latest` dist-tag, and published file list.
- Query GitHub and git for the release, annotated tag, target commit, and notes.
- Install the exact registry version into a new temporary directory and invoke
  its packaged binary independently of this checkout.

## Capability Deltas

- `.empirical/specs/release-0-20-4/deltas/package-distribution.md`
