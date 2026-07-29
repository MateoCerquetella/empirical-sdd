# Decisions: Worktree-First Empirical 0.20

This file records concise, externally reviewable engineering decisions. It does
not store private chain-of-thought, prompts, credentials, or scratchpad text.

## D-001: Use Git worktrees as the only parallel-isolation model

Status: Accepted

### Evidence

- The existing product has a second named-workstream namespace layered over Git,
  while the intended users already isolate concurrent work with Git worktrees.
- `git worktree add -b <branch> <path> <base>` provides a native branch and
  checkout boundary with standard collision checks.
- Current packets, state paths, CLI flags, MCP schemas, and generated guidance
  repeat workstream identity, increasing concepts without isolating source files.

### Options

1. Keep named workstreams and add worktrees as another optional layer.
2. Hide workstreams internally but preserve the public compatibility surface.
3. Remove named workstreams and allow one active Empirical feature per checkout.

### Chosen approach

Choose option 3. Feature-local state provides the workflow boundary and Git
worktrees provide parallel source isolation. Existing named-workstream data is
left untouched but unsupported.

### Trade-offs and risks

- This intentionally breaks the 2.x API and CLI.
- Users with named-workstream history must inspect it with an older release.
- Git worktrees require a clean checkout and globally unique branch names.

### Verification

- Search public types, packets, CLI, MCP, integrations, tests, and docs for
  removed workstream fields and commands.
- Exercise two real linked worktrees and prove their feature state does not
  collide.

## D-002: Store mutable workflow state inside each feature directory

Status: Accepted

### Evidence

- Root `.empirical/state.json` and `.empirical/events/` collide when branches
  created from the same base independently start work.
- Specs, deltas, decisions, and evidence already have a natural feature owner.
- Transaction and event-journal guarantees depend on paths, not on a root-level
  location.

### Options

1. Retain root state and derive an implicit branch key.
2. Store state in an uncommitted machine-local cache.
3. Co-locate state, journal, lock, and evidence beneath each feature spec.

### Chosen approach

Choose option 3. Project-wide files remain configuration and capability data;
all revisioned mutable state becomes feature-local. Opening a checkout discovers
at most one non-terminal feature.

### Trade-offs and risks

- Schema-1/2/3 default state needs careful idempotent migration.
- Multiple active feature states indicate repository corruption and must block.
- Terminal states remain as history and must not reserve a checkout.

### Verification

- Migrate fixtures for every prior schema and an interrupted migration.
- Verify feature transactions, recovery, locks, and evidence use only the
  feature directory.

## D-003: Require explicit approval and a clean checkout before creation

Status: Accepted

### Evidence

- Creating a worktree and branch is a durable Git mutation.
- Uncommitted source changes make the intended base and ownership ambiguous.
- Git already offers safe collision behavior without force flags.

### Options

1. Automatically create and optionally stash local changes.
2. Return a complete proposal and require explicit approval.
3. Only print a command and require the user to run it manually.

### Chosen approach

Choose option 2. Interactive CLI asks once; structured callers must pass the
full proposal with `approved: true`. The creator revalidates cleanliness, base,
path, branch, and registered-worktree collisions immediately before Git runs.

### Trade-offs and risks

- Dirty repositories require manual cleanup before isolation.
- A successful Git command followed by initialization failure can leave a
  recoverable worktree that Empirical will report but not delete.
- Explicit approval adds one deliberate interaction for unrelated concurrent
  work.

### Verification

- Prove proposal is read-only and decline makes no writes.
- Test dirty checkout, stale proposal, branch/path collision, Git failure, and
  successful handoff using temporary repositories.

## D-004: Record decision summaries, never hidden model reasoning

Status: Accepted

### Evidence

- The reference toolkit's useful pattern is a visible trail from evidence to
  alternatives, choice, risks, and verification.
- Raw chain-of-thought is neither required for review nor appropriate to persist.
- Empirical already has gated Design and Review phases where concise material
  decisions can be validated.

### Options

1. Persist full prompts and private reasoning traces.
2. Add enterprise ADR/wiki/review-dossier machinery.
3. Keep one concise feature-local decision record plus deterministic Explain.

### Chosen approach

Choose option 3. Complex features maintain structured decisions; Explain derives
state-machine rationale and missing context without exposing private reasoning.

### Trade-offs and risks

- Structured records add a small amount of Complex-workflow ceremony.
- Mechanical validation cannot prove implementation alignment by itself, so
  Review must compare accepted decisions with the diff and evidence.
- Supersession links are required to preserve history when a choice changes.

### Verification

- Reject empty/malformed records, broken supersession, and forbidden raw-
  reasoning or credential sections.
- Prove CLI/API/MCP Explain parity and read-only filesystem behavior.

## D-005: Reset the alpha line by publishing before deleting old versions

Status: Accepted

### Evidence

- The product is still alpha and the owner approved `0.20.0` as the canonical
  line.
- npm unpublish is irreversible and removed version numbers cannot be reused.
- Unpublishing an entire package can delay republishing, whereas individual
  version removal can preserve a verified replacement.

### Options

1. Keep the current 2.x history and publish another 2.x release.
2. Delete 2.x first and then attempt to publish 0.20.0.
3. Publish and verify 0.20.0/latest, then individually delete all four 2.x
   versions.

### Chosen approach

Choose option 3. Registry deletion is the final release step and only begins
after the replacement package and dist-tag are verified.

### Trade-offs and risks

- Consumers pinned to removed 2.x versions can no longer install them.
- npm authentication or policy can interrupt cleanup after 0.20.0 is already
  public; registry verification will make any partial state explicit.
- The removed numbers are permanently unavailable.

### Verification

- Install the packed 0.20.0 artifact in an empty consumer before publishing.
- Verify `latest` and package contents, unpublish each exact version, then query
  versions and dist-tags again.

## D-006: Bind worktree approval to immutable proposal data

Status: Accepted

### Evidence

- A branch ref, active feature, or caller-supplied field can change after a
  proposal is displayed but before the approved create request executes.
- Passing a moving base ref to Git after validating its commit leaves a narrow
  time-of-check/time-of-use race.

### Options

1. Trust `approved: true` without checking which proposal was shown.
2. Revalidate only the user-visible branch and path strings.
3. Hash every approved proposal field, pin the resolved base commit, and reject
   any active-feature, base, or payload change before creation.

### Chosen approach

Choose option 3. The proposal carries a SHA-256 approval token and resolved base
commit. Creation recomputes the proposal, compares both plus the active feature,
and passes the approved commit—not the moving ref—to `git worktree add`.

### Trade-offs and risks

- Structured clients must echo three additional proposal fields.
- Any legitimate edit requires generating and approving a fresh proposal.
- The token provides integrity for the local approval exchange, not identity or
  remote authentication.

### Verification

- Reject changed branch, base commit, active feature, request, and approval
  token values.
- Assert the exact Git argv ends with the approved commit SHA.
