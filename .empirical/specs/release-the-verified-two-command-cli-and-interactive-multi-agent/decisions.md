# Decisions: Empirical 0.20.1 Release

## D-001: Bump explicit version surfaces without automatic Git tagging

Status: Accepted

### Evidence

- `npm version` can create a commit and Git tag as side effects.
- This release needs a reviewed source commit but does not request a GitHub or
  Git tag release.
- The project has a small, auditable set of intentional version surfaces.

### Options

1. Run `npm version patch` with its default Git behavior.
2. Edit the explicit version surfaces and commit them normally.
3. Publish `0.20.0` again.

### Chosen approach

Choose option 2. Option 3 is impossible because npm versions are immutable.

### Trade-offs and risks

Manual editing can miss a version assertion, so search plus CI and packaged
runtime verification are mandatory.

### Verification

Search intentional references, run core and smoke assertions, and compare the
registry package's reported version with its manifest.

## D-002: Publish once only after the release commit passes CI

Status: Accepted

### Evidence

- npm publication is externally visible and irreversible.
- The implementation commit already passed CI, but the exact versioned artifact
  must pass again.

### Options

1. Publish first and test the registry afterward.
2. Test, commit, publish once, then independently verify the registry artifact.
3. Publish with a temporary tag and promote later.

### Chosen approach

Choose option 2 because the user explicitly requested `latest` and the artifact
already has complete pre-release coverage.

### Trade-offs and risks

Registry propagation may lag briefly. Read-only polling is allowed, but a
publish command is never repeated without proving the exact version is absent.

### Verification

Capture successful CI, publish output, exact registry metadata, and clean
consumer results.

## D-003: Verify through a local temporary consumer

Status: Accepted

### Evidence

- A repository build can accidentally rely on undeclared or unpackaged files.
- A global install would mutate the developer's active agent configuration.

### Options

1. Trust the repository smoke test only.
2. Globally install the release.
3. Install the exact registry version locally in a new temporary project.

### Chosen approach

Choose option 3.

### Trade-offs and risks

The verification downloads the artifact once more and creates temporary files,
which are isolated and disposable.

### Verification

Run the installed binary's version and help from the temporary project's
`node_modules/.bin`, and inspect the installed package file set.
