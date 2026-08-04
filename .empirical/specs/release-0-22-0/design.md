# Design: Release 0.22.0

## Overview

Ship the complete approved Schema 5 candidate through Empirical's protected
two-pull-request delivery, then bind the independently confirmed evidence merge
commit to one immutable npm, Git tag, and GitHub release identity. Preserve
post-publication receipts in a final focused evidence update.

## Release identity and inputs

- Exact package: `empirical-sdd`
- Exact version/tag/dist-tag: `0.22.0`, `v0.22.0`, `latest`
- Target repository/branch: `MateoCerquetella/empirical-sdd` / `main`
- Source branch: `agent/release-0.22.0`
- Delivery evidence branch: `agent/release-0.22.0-evidence`
- Current manifest baseline: `0.21.0`
- Current public npm baseline: `0.20.4`
- Candidate scope: the full inspected migration, capability, implementation,
  tests, docs, CI, and completed-feature tree, plus the `0.22.0` bump and this
  release contract.
- Excluded artifacts: `coverage/`, `dist/`, packed tarballs, temporary
  consumers/worktrees, logs, credentials, and any file outside the inspected
  repository diff.

## Version convergence

Use a targeted version scan to classify every `0.21` occurrence. Update true
release surfaces—including manifest/lock metadata, runtime/product constants,
smoke and clean-package expectations, consistency assertions, and current
release-facing documentation—to `0.22.0`. Preserve historical feature records
and migration statements when they describe an actual older version.

The consistency gate, built `empirical --version`, package dry-run manifest, and
clean packed consumer jointly prove that the shipped artifact is internally
`0.22.0`.

## Validation and integration

1. Validate formatting, types, 169+ source tests, coverage, built CLI/MCP smoke,
   clean-package consumption, consistency, and `npm pack --dry-run --json`.
2. Verify the tarball allowlist is limited to `dist/`, `README.md`,
   `LICENSE`, and package metadata; generated repository artifacts are
   quarantined outside the checkout after each run.
3. Complete Implement, Verify, and independent Review with immutable CI
   receipts covering all seven release criteria that can be proven locally.
4. Replay the package-distribution delta against an independent detached target,
   run Policy v2 integration CI, promote the living capability only on success,
   and preserve the integration receipt.

## Protected GitHub delivery

Record standing authorization through `delivered` for this exact repository,
feature, and `main` target. Empirical delivery then:

1. commits only the explicit candidate paths on
   `agent/release-0.22.0`, pushes them, opens the owned source PR, waits for
   every configured Ubuntu/macOS/Windows required check, and merges normally;
2. writes a digest-bound `delivery-source.json` for the observed source merge,
   creates `agent/release-0.22.0-evidence` from the new remote `main`, commits
   explicit evidence paths, pushes a second owned PR, waits for the same checks,
   and merges normally;
3. records both PRs, head commits, merge commits, check names, command digests,
   and the evidence merge commit in an immutable delivery receipt.

No delivery command may force-push, bypass checks, delete branches/tags, use
admin merge, expose credentials, or accept an ambiguous/unowned PR.

## Immutable publication

Publication is a separate exact operation bound to:

- repository identity and feature `release-0-22-0`;
- package/version/dist-tag `empirical-sdd@0.22.0` / `latest`;
- the confirmed delivery evidence merge commit;
- literal approval and a digest-verified publication authorization.

Before mutation, inspect the remote tag, GitHub release, exact npm version, and
selected dist-tag. Any non-identical existing artifact is a hard conflict.
Otherwise execute the deterministic missing actions in order: create annotated
tag, push tag, create GitHub release, publish npm, set/confirm `latest`.
Reinspect every surface and write a publication receipt only after convergence.

Because local npm authentication is currently unavailable, attempt publication
only if a legitimate configured npm or trusted-publishing identity is present.
An authentication failure leaves already-created immutable artifacts in place,
records the exact partial state, and stops for user authority; it never rewrites
or fabricates success.

## External verification and final evidence

Install `empirical-sdd@0.22.0` from npm into a fresh temporary consumer.
Assert exact version output, lifecycle help including Uninstall, supported
exports, rejected private subpaths, package integrity, and `latest` resolution.
Verify the annotated remote tag and GitHub release resolve to the publication
commit. Commit any post-publication receipts/context in a final focused evidence
PR, wait for checks, merge normally, fast-forward local `main`, and run Doctor.

## Failure recovery

- Local validation failure: fix only within approved candidate scope and rerun.
- PR check failure: diagnose and commit a normal fix; never bypass or force.
- Immutable conflict: stop before mutation and report the conflicting surface.
- npm authority failure: stop at the registry boundary, preserve exact GitHub/tag
  state, and request authentication for an identical retry.
- Partial publication: resume only through convergence planning for the same
  commit/version; never replace existing public artifacts.
