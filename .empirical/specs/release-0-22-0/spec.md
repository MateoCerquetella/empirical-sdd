# Release 0 22 0

## Request

> Release the complete intended Schema 5 trust/autonomy/delivery overhaul, migration hardening, documentation and distribution updates, and safe empirical uninstall implementation as empirical-sdd 0.22.0. Bump every public version surface consistently, run the full release CI and package inspection, commit the complete intended working tree on an agent/release-0.22.0 branch, push through protected GitHub pull requests and merge required checks without bypasses, publish empirical-sdd@0.22.0 to npm under latest, create and push the immutable annotated v0.22.0 git tag and GitHub release, verify the registry package and a clean consumer install, and preserve final evidence in the repository. Do not force-push, overwrite immutable artifacts, include generated build output, or publish any other version.

## Goal

Publish the complete, already implemented and independently verified Schema 5
release as one immutable `0.22.0` source, package, tag, and GitHub release whose
public behavior includes safe uninstall and whose durable evidence remains
auditable in the repository.

## Acceptance Criteria

- [ ] [AC-1] Every public version surface resolves to exactly `0.22.0`, including
  `package.json`, the lockfile, runtime version output, distribution smoke tests,
  clean-package expectations, consistency output, release documentation, tag,
  GitHub release, npm version, and the `latest` dist-tag.
- [ ] [AC-2] The complete intended 242-path Schema 5, migration-hardening,
  documentation, distribution, and uninstall working-tree change passes
  `git diff --check`, full CI, package dry-run inspection, and compiled CLI
  version/help checks without shipping generated coverage or build output.
- [ ] [AC-3] The source candidate is committed on
  `agent/release-0.22.0`, pushed, reviewed through a GitHub pull request, passes
  every required Ubuntu, macOS, and Windows check, and merges normally into
  `main` without force, admin bypass, history rewriting, or unrelated files.
- [ ] [AC-4] The exact merged source commit is bound to an annotated `v0.22.0`
  tag, public `empirical-sdd@0.22.0` package under `latest`, and published GitHub
  release; identical retries converge and any conflicting immutable artifact
  stops publication without replacement or deletion.
- [ ] [AC-5] A fresh temporary consumer installs `empirical-sdd@0.22.0` from the
  public registry, receives exact `0.22.0` version output, sees only Install,
  Update, and Uninstall as public lifecycle commands, and can read the supported
  root, protocol, MCP, and integrations exports while internal modules remain
  unavailable.
- [ ] [AC-6] Release notes clearly summarize Schema 5 routing and evidence,
  migration safety, protected delivery/publication, six agent skills, and the
  new ownership-bound `empirical uninstall` behavior and preservation contract.
- [ ] [AC-7] Final durable evidence records the exact source/evidence commits,
  pull requests, required checks, tag, GitHub release, npm integrity and
  dist-tag, clean-consumer result, and a synchronized repository state; missing
  GitHub or npm authority stops at the affected stage without weakening gates.

## Scope

- Treat the entire inspected working tree produced by the approved “do it all”
  work as the intended source candidate, including migrated Schema 5 history,
  living capabilities, implementation, tests, docs, CI, and uninstall feature.
- Bump the candidate from the repository-declared `0.21.0` to the unused next
  minor `0.22.0`; npm currently exposes `0.20.4` as `latest`.
- Deliver source and durable evidence through protected GitHub pull requests.
- Publish the exact merged source through npm, annotated Git tag, and GitHub
  release, then verify all public surfaces independently.

## Non-goals

- Publishing `0.21.x`, another package, another dist-tag, or a prerelease.
- Adding feature behavior after the release candidate is frozen.
- Shipping `coverage/`, `dist/`, temporary package archives, credentials, or
  repository-only files outside the declared npm package allowlist.
- Force-pushing, bypassing branch protection, moving/deleting existing tags or
  releases, replacing npm versions, or silently using unrelated user changes.
- Claiming publication if authentication or any remote surface cannot be
  independently verified.

## Verification

- Run `git diff --check`, `bun run ci`, version-surface scans, compiled CLI
  version/help assertions, and `npm pack --dry-run --json` before delivery.
- Inspect the source PR file list and required check rollup before normal merge.
- Re-run CI and package inspection on the exact merged source commit.
- Query local/remote Git tags, GitHub release metadata, npm exact-version and
  dist-tag metadata, and the registry tarball integrity/file list.
- Install the exact public version into a fresh temporary consumer and invoke
  its binary and supported/unsupported imports.
- Preserve immutable command, integration, delivery, and publication receipts;
  finish with Doctor, clean/synchronized Git status, and remote convergence.

## Capability Deltas

- `.empirical/specs/release-0-22-0/deltas/package-distribution.md`
