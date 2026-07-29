# Release Empirical 0.20.1

## Request

> Release the verified two-command CLI and interactive multi-agent installer as empirical-sdd 0.20.1, publish it to npm under latest, and verify the registry tarball and clean consumer installation.

## Goal

Publish the already verified two-command CLI and agent-selector implementation
as the immutable npm release `empirical-sdd@0.20.1`, make it the `latest`
release, and prove a clean consumer receives and can execute that exact package.

## Acceptance Criteria

- [ ] [AC-1] `package.json`, the runtime `PRODUCT_VERSION`, README release label,
  core version test, and built-package smoke all identify version `0.20.1`.
- [ ] [AC-2] Type checking, the full automated suite, built CLI/MCP smoke, and
  package dry-run pass against the exact release commit before publication.
- [ ] [AC-3] Authenticated npm publication succeeds once, and the registry
  reports both `empirical-sdd@0.20.1` and the `latest` dist-tag as `0.20.1`.
- [ ] [AC-4] A new temporary consumer installs `empirical-sdd@0.20.1` from the
  registry; its packaged binary reports `0.20.1`, and its help exposes Install
  and Update without exposing the retired workflow verbs.
- [ ] [AC-5] The published tarball contains the expected package manifest,
  README, license, declarations, and built JavaScript, with no source secrets or
  unrelated repository files.
- [ ] [AC-6] Publication does not rewrite history, reuse `0.20.0`, delete npm
  versions/tags, or introduce unrelated source changes.

## Scope

- Bump every intentional product-version assertion and release-facing document
  from `0.20.0` to `0.20.1`.
- Run the complete release checks, commit the version bump, publish publicly,
  and verify the registry and an isolated consumer.

## Non-goals

- Adding or changing CLI, selector, workflow, MCP, or TypeScript API behavior.
- Republishing or deleting `0.20.0`, changing alpha status, or creating a GitHub
  release.
- Globally installing the package into the developer's active agent setup.

## Risks

- npm publication is irreversible; a bad artifact requires a newer version.
- Registry propagation can briefly lag the publish response.
- A version mismatch between source, build, tests, or docs can make diagnostics
  and update behavior misleading.
- Credentials must remain inside npm tooling and never enter artifacts or logs.

## Verification

1. Search all product-version references and review every intentional update.
2. Run `bun run ci` and confirm the package dry-run contents.
3. Publish `0.20.1` with npm as the already authenticated account.
4. Query exact version and dist-tags from npm until they resolve consistently.
5. Install the exact registry version in a new temporary directory, exercise
   version/help, inspect the installed package, and remove the temporary fixture.

## Capability Deltas

See `deltas/package-distribution.md`.
