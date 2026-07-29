# Design: Empirical 0.20.1 Release

## Release boundary

The release changes only intentional version surfaces and workflow records. The
already reviewed two-command CLI commit remains the implementation payload.
`package.json` is the npm publication authority; `PRODUCT_VERSION`, assertions,
smoke checks, and release-facing documentation mirror it.

## Sequence

1. Replace the intentional `0.20.0` product assertions/labels with
   `0.20.1`; retain historical migration prose that specifically describes the
   original `0.20.0` reset.
2. Run the full CI from the release candidate and inspect the npm dry-run file
   list.
3. Commit the version and Empirical release artifacts so the published tarball
   corresponds to a stable source commit.
4. Reconfirm npm identity and that `0.20.1` does not exist, then run one public
   `npm publish --access public` from the repository.
5. Query the exact version and `latest` dist-tag, create a temporary consumer,
   install `empirical-sdd@0.20.1`, exercise the packaged binary, and inspect the
   installed file boundary.

## Failure handling

Before publication, any failed check stops the release and remains reversible.
After npm acknowledges publication, never retry blindly: first query the exact
version. Registry propagation is polled read-only. A bad immutable release is
corrected only by a newer version, never by deletion or overwrite.

## Credential and filesystem safety

npm owns authentication; no token is read, printed, copied, or written by the
release workflow. Consumer verification uses a newly created temporary
directory and a local dependency installation, leaving global agent skills and
the working repository untouched.
