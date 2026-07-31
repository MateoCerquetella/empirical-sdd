# Decisions: Release 0 20 4

Record concise, externally reviewable evidence and choices here. Do not store
private chain-of-thought, prompts, credentials, secrets, or scratchpad text.

## D-001: Release only from a reviewed merge commit

Status: Accepted

### Evidence

- `main` and `origin/main` began at `3907023` with the intended `0.20.4` change
  uncommitted and no unrelated worktree changes.
- GitHub PR #6 established merge-commit releases with required Ubuntu, macOS,
  and Windows CI checks; annotated `v0.20.3` points at that merge commit.
- npm currently exposes only versions `0.20.0` through `0.20.3`, with `latest`
  at `0.20.3`; `npm whoami` identifies the authorized maintainer account.

### Options

1. Commit and publish directly from `main`.
2. Publish from a release-branch commit before merge.
3. Merge a reviewed release pull request, then tag and publish its merge commit.

### Chosen approach

Use option 3. The release source is the successful GitHub pull-request merge
commit after all configured platform checks pass.

### Trade-offs and risks

This adds a PR/check round trip but provides a stable reviewed source identity.
The release must stop on a failed check rather than merge with an override.

### Verification

Record the PR URL, green check rollup, merge SHA, and prove the annotated tag
peels to that SHA before publication.

## D-002: Separate source publication from post-release evidence

Status: Accepted

### Evidence

- The release workflow cannot contain final npm/GitHub evidence until those
  external mutations have completed.
- PR #7 records `0.20.3` release evidence in a follow-up changeset so the shipped
  tag remains attached to the reviewed source PR rather than a self-referential
  evidence commit.

### Options

1. Commit an incomplete release-state directory in the source PR and amend it
   after publication.
2. Exclude release-process evidence from the source PR, then merge one focused
   evidence PR after verification and archival.

### Chosen approach

Use option 2. The source PR includes the completed CLI-branding work but excludes
`.empirical/specs/release-0-20-4/`; the follow-up includes final release records
and the archived package-distribution delta.

### Trade-offs and risks

The default branch will advance past the release tag after the evidence PR, but
the tag remains on the exact source merge and the evidence commit has no runtime
or package impact. Explicit path staging prevents accidental scope crossover.

### Verification

Inspect both PR file lists: the source PR must contain product work only, and the
evidence PR must contain release records/capability archival only.

## D-003: Publish provenance before announcing the GitHub release

Status: Accepted

### Evidence

- npm versions are immutable and the registry currently has no `0.20.4` entry.
- A public annotated tag gives the npm artifact an immutable source reference.
- This repository has a `v0.20.3` tag but no GitHub Release object, so `0.20.4`
  will explicitly add the missing release-notes surface requested by the user.

### Options

1. Publish npm first, then create/push the source tag and GitHub release.
2. Push the immutable annotated tag, publish npm, then create the GitHub release
   only after the registry artifact is verified.

### Chosen approach

Use option 2. A GitHub release is the completion announcement and must not exist
until the exact npm version is public.

### Trade-offs and risks

An npm authentication failure can temporarily leave a tag without a GitHub
release. The tag must never be moved; publication resumes from the same tested
merge commit. This is safer than announcing a release with no installable build.

### Verification

Confirm the tag is annotated and targets the merge SHA, npm `latest` resolves to
`0.20.4`, and the GitHub release is published for that exact tag afterward.
