# Design: Worktree-First Empirical 0.20

## System boundary

Empirical will model exactly one active feature in each Git checkout. Parallel
development belongs to Git worktrees, not to a second Empirical namespace.
The committed `.empirical/` tree remains the source of truth, but mutable
workflow data moves beside the feature contract that it describes:

```text
.empirical/
  config.json
  policy.json
  capabilities/
  discoveries/
  specs/
    <descriptive-feature-slug>/
      spec.md
      design.md
      decisions.md
      plan.md
      state.json
      state.lock
      events/
      evidence/
      deltas/
```

There is no workstream manifest, selector, command, option, packet field, API,
or MCP input. A checkout finds its active feature by scanning feature-local
states for a non-terminal workflow. `done` and idle legacy state do not reserve
the checkout. Blocked work remains resumable and therefore still reserves its
checkout. If more than one non-terminal feature is found, the
project is inconsistent and Doctor/Explain report a repairable error rather
than choosing one silently.

## Feature identity and state migration

New feature identifiers are portable descriptive slugs derived from the full
request. They are not prefixed with a sequence number. An explicit `id` remains
available to structured callers. Existing paths are never silently reused or
renamed: a collision returns an actionable error asking for a distinct ID.

`ProjectStore` becomes either project-scoped or bound to one feature. Project
scope owns configuration, policies, capability projections, discovery records,
and a root lock used only for feature creation. Feature scope owns state,
events, the transaction lock, evidence, and workflow artifacts. Transactional
write/recovery behavior remains unchanged after resolving those new paths.

Opening a schema-1, schema-2, or schema-3 project performs an idempotent default
state migration:

1. Validate and normalize `.empirical/state.json` without following symbolic
   links.
2. Resolve its existing `activeFeature` directory. If the state is meaningful,
   write the normalized schema-4 state and each valid root event into that
   feature directory using atomic writers.
3. Only after every destination write succeeds, remove the migrated root state,
   lock, and event files. A terminal state may be retained as feature history
   but is not returned as active.
4. Ignore `.empirical/workstreams.json` and `.empirical/workstreams/`; they are
   unsupported historical data and are never merged into current state.

Migration is safe to repeat after interruption. Existing destination records
must either match or be newer valid records; disagreement blocks with a
diagnostic rather than overwriting history.

## Persisted configuration

Schema 4 adds a versioned configuration section:

```json
{
  "isolation": {
    "mode": "ask",
    "baseBranch": "auto",
    "worktreePath": "../{repo}-{feature}",
    "branchPattern": "{type}/{feature}"
  },
  "decisions": {
    "complexRecords": "required"
  },
  "setupComplete": true
}
```

`empirical init` prompts only when stdin and stdout are interactive, no
configuration flags were supplied, and setup has not been completed. The
questions show the detected default branch and the safe defaults before asking
for isolation mode, base, sibling path, branch pattern, and Complex decision
records. `empirical config` repeats the same editor intentionally. `--defaults`
suppresses prompts. The following flags support scripts and agents:

- `--isolation ask|off`
- `--base <ref|auto>`
- `--worktree-path <template>`
- `--branch-pattern <template>`
- `--decisions required|off`
- `--defaults`

API and MCP initialization never prompt and use the same defaults. Templates
must contain `{feature}`; branch templates must also contain `{type}`. Resolved
branches and paths are validated before they become proposals.

## Worktree proposal and approval

Starting a different request while a feature is active returns a typed
`WorktreeProposal` instead of mutating either workflow. The proposal contains:

- exact request and selected Fast/Complex workflow;
- inferred but editable `feature`, `fix`, or `chore` change type;
- feature slug, `<type>/<feature>` branch, absolute sibling path;
- detected/editable base ref and exact argv preview;
- the active feature that caused isolation and `requiresApproval: true`.

Interactive CLI entrypoints render the proposal and ask once. Declining leaves
everything unchanged. Structured callers approve through a dedicated
`empirical_worktree_create` operation with `approved: true` and the complete
proposal, preventing approval from being inferred from an earlier read.

Before `git worktree add`, the creator revalidates all proposal fields, confirms
that the source checkout has no tracked or untracked changes, resolves the base
commit, and rejects branch, path, or registered-worktree collisions. Git is
invoked with an argument array, never a shell:

```text
git worktree add -b <branch> <absolute-path> <resolved-base-commit>
```

No force, stash, commit, cleanup, branch deletion, or worktree removal is
performed. The human-readable base ref remains in the handoff, while the exact
commit approved in the proposal is passed to Git so the ref cannot move between
validation and creation. A Git failure leaves the original workflow untouched. After success,
Empirical opens the new checkout, initializes/migrates it, starts the exact
request there, and returns `WorktreeHandoff` with path, branch, base, feature,
revision, action, and `cd <path> && empirical loop` guidance. If post-creation
initialization fails, the durable Git result is reported explicitly for manual
recovery rather than being hidden or destructively rolled back.

Base detection is deterministic: `refs/remotes/origin/HEAD`, then an existing
`main`, then an existing `master`. Ambiguous or missing detection blocks until
the caller supplies a base. The proposal stores the resolved ref so approval
cannot race a second implicit detection.

## Decision records without private reasoning

Complex start creates `decisions.md` with a short authoring contract and one
proposed entry. Each material entry uses stable IDs and these externally
reviewable fields:

```markdown
## D-001: Decision title

Status: Accepted

### Evidence
### Options
### Chosen approach
### Trade-offs and risks
### Verification
```

`Superseded` entries additionally name `Superseded by: D-nnn`; the replacing
entry names `Supersedes: D-nnn`. The parser rejects empty required sections,
unknown statuses, duplicate IDs, broken supersession links, raw
chain-of-thought headings, and secret-like credential fields. It returns only
concise summaries and validation issues.

Design completion requires at least one Accepted material decision when
decision records are required. Review revalidates the record and instructs the
reviewer to compare accepted choices against implementation and evidence. A
contradiction requires an accepted superseding decision; editing old history in
place is not sufficient. Fast features do not create or validate the file.

## Explain and packet rationale

Every action packet gains a deterministic `rationale` assembled from workflow
state and artifact existence, not model internals:

- current state and next action;
- why that action follows from the state machine;
- required context and missing files/evidence;
- stop/proceed gate.

`EmpiricalProject.explain()`, `empirical explain [--json]`, and
`empirical_explain` return the same fields plus accepted decision summaries.
They are read-only: Explain neither repairs, migrates, creates artifacts, nor
advances revisions. The output deliberately excludes prompts, hidden
chain-of-thought, tokens, scratchpads, environment values, and credentials.

## Public interfaces

The TypeScript API removes workstream types and parameters and adds:

- `WorktreeProposal`, `WorktreeHandoff`, and `FeatureStartResult`;
- `proposeWorktree`, `createWorktree`, `configure`, and `explain`;
- schema-4 worktree/decision configuration and action rationale types.

The CLI removes `--workstream` and `empirical workstream ...`, adds
`empirical config`, `empirical worktree create`, and `empirical explain`, and
updates all completion/resume commands. Unknown legacy flags fail normally.

MCP removes every workstream property and `empirical_workstreams`, adds
read-only `empirical_explain`, read-only `empirical_worktree_propose`, and
destructive `empirical_worktree_create`. Tool annotations distinguish the
mutating approval operation. Fast/Complex tool results may be an action packet
or a proposal and expose a discriminator.

Generated project and global skills tell the current agent to show the proposal,
obtain explicit approval, call the creation operation, and continue from the
returned checkout. They never launch another agent runtime.

## Release and irreversible registry cleanup

All package, product, documentation, and fixture versions become `0.20.0`.
Release order is a hard safety invariant:

1. Build, test, package, and install the exact tarball in an empty consumer.
2. Publish `empirical-sdd@0.20.0`.
3. Verify package contents and set/verify `latest` points to `0.20.0`.
4. Individually unpublish `2.0.0`, `2.2.0`, `2.3.0`, and `2.3.1`.
5. Verify the registry exposes only `0.20.0`.

The package itself is never unpublished, avoiding npm's whole-package
republish cooldown. Removed version numbers are documented as permanently
unavailable.

## Verification architecture

Unit tests cover configuration parsing, slug/type inference, decision parsing,
rationale, feature-state discovery, and schema migrations. Integration tests
use real temporary Git repositories to prove clean/dirty guards, default-base
detection, exact argv behavior, collisions, approval, linked-worktree handoff,
and two checkouts progressing independently. CLI tests cover interactive and
non-interactive init/config, proposal rendering/decline/approval, Explain, and
legacy flag rejection. MCP/API tests prove schema parity and absence of
workstream vocabulary.

The final gate runs typecheck, source tests, built-distribution smoke, package
dry-run, packed-consumer installation, real-worktree smoke, documentation
searches, and `git diff --check` before any npm mutation.
