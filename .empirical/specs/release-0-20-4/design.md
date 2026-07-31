# Design: Release 0.20.4

## Overview

Ship the already reviewed CLI-branding implementation from a pull-request merge
commit, bind that immutable commit to `v0.20.4`, publish the exact npm package,
and verify the result as an external consumer. Keep the release workflow's own
post-publication evidence out of the shipped source snapshot and record it in a
small follow-up pull request, matching the established `0.20.3` release pattern.

## Release inputs

- The intended product change is the full pre-existing `0.20.4` worktree diff:
  branding renderer, CLI integration, version surfaces, tests, smoke coverage,
  context refresh, archived CLI-branding capability, and its completed feature
  record.
- `.empirical/specs/release-0-20-4/` and its not-yet-archived package delta are
  release-process evidence, not inputs to the npm artifact or first source PR.
- The source branch is `agent/release-0.20.4`; the target is `main`.

## Flow

1. Confirm `origin/main`, npm, and GitHub still expose `0.20.3`, and confirm no
   `0.20.4` package, tag, or GitHub release already exists.
2. Run repository CI and package inspection against the intended source diff.
3. Create `agent/release-0.20.4`, stage only the intended product paths, commit,
   push, and open a draft pull request. Mark it ready after local validation,
   wait for required Ubuntu, macOS, and Windows checks, then merge normally.
4. Switch to `main`, fast-forward from `origin/main`, rerun CI on the merged
   commit, and inspect the generated package manifest/file list.
5. Create annotated tag `v0.20.4` at that exact merge commit and push it. Publish
   `empirical-sdd@0.20.4` with public access and the `latest` dist-tag.
6. After npm succeeds, create the GitHub release from the verified tag with
   concise notes for identity, responsive color behavior, automation safety,
   tests, and installation.
7. Verify npm metadata, tarball contents and integrity, tag targets, GitHub
   release metadata, and an install into a new temporary consumer directory.
8. Complete Empirical verification/review/archive, commit its durable release
   evidence on `agent/release-0.20.4-evidence`, pass CI, merge that follow-up,
   and leave local `main` clean and synchronized.

## Failure handling

- Never reuse or overwrite an existing npm version or git tag.
- If pull-request checks fail, fix on the release branch and repeat validation;
  do not bypass the checks.
- Once the tag is public, never move it. If npm publication fails, preserve the
  tag as the immutable source candidate, resolve authentication/registry issues,
  and retry publication of the same tested commit.
- Create the GitHub release only after npm publication succeeds so its presence
  means the package is publicly consumable.
- Use temporary directories for package/install inspection and remove generated
  tarballs from the checkout before final cleanliness checks.

## Verification mapping

- AC-1: explicit staged paths, PR metadata, required check rollup, merge SHA.
- AC-2: `bun run ci`, `git diff --check`, version scan, package dry-run/manifest.
- AC-3: npm exact-version and dist-tag queries plus registry tarball file list.
- AC-4: local/remote annotated-tag inspection and GitHub release metadata/notes.
- AC-5: clean exact-version npm install and captured binary version/help output.
- AC-6: remote default-branch ancestry, public surfaces, and clean synchronized
  local `main` after the evidence pull request.
