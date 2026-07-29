# Plan: Worktree-First Empirical 0.20

## 1. Redesign public types and feature-scoped persistence

- Raise the workflow/config schema to 4 and set package/product versions to
  `0.20.0`.
- Remove workstream types, fields, parameters, manifests, selectors, paths, and
  resource locks from the public model and storage layer.
- Bind state, lock, event journal, evidence, and workflow artifacts to a
  descriptive feature directory; discover zero or one non-terminal feature per
  checkout and reject ambiguous repositories.
- Implement safe, idempotent migration of schema-1/2/3 default root state and
  events while deliberately ignoring historical named-workstream storage.
- Replace sequential IDs with validated descriptive slugs and explicit collision
  errors.
- Add focused storage/migration/recovery/concurrency tests before changing
  higher-level orchestration.

Addresses: AC-1, AC-2, AC-3, AC-10, AC-11.

## 2. Rewire the core workflow and packet contract

- Make project opening resolve the active feature store and make start reserve a
  new feature atomically at project scope.
- Remove workstream validation and text from start, complete, retry, archive,
  doctor, action packets, completion commands, discovery handoff, and capability
  archive reports.
- Preserve exact revisions, evidence checks, policy, event recovery, archive
  ordering, and Fast/Complex/Explore/Loop semantics.
- Add deterministic packet rationale from phase/status/artifact state.
- Update API exports and regression tests for the breaking contract.

Addresses: AC-1, AC-2, AC-3, AC-9, AC-10.

## 3. Add durable configuration and first-run CLI UX

- Extend project configuration with isolation mode, detected/editable base,
  worktree path template, branch pattern, decision-record preference, and setup
  completion.
- Add validation/defaulting and public `configure` behavior.
- Add an interactive `init`/`config` editor using readline, with prompts only on
  an eligible TTY; add deterministic non-interactive flags and `--defaults`.
- Test first-run-only prompting, reconfiguration, explicit flags, invalid
  templates, non-TTY behavior, and JSON/API/MCP defaults.

Addresses: AC-4, AC-10.

## 4. Implement safe proposal, approval, and Git worktree handoff

- Add shell-free Git discovery for repository root, cleanliness, default base,
  refs, branches, and registered worktrees.
- Infer an editable change type and resolve validated feature/branch/path/base
  into a read-only `WorktreeProposal`.
- Return the proposal when unrelated work is requested in an active checkout;
  render and approve it interactively, and require `approved: true` for
  structured creation.
- Revalidate every safety condition, execute exact `git worktree add -b` argv,
  initialize/migrate the new checkout, start the exact request, and return a
  structured handoff.
- Cover decline, dirty checkout, stale base, collisions, Git failure, successful
  handoff, and two independent linked worktrees with real temporary repositories.

Addresses: AC-2, AC-5, AC-6, AC-7, AC-10.

## 5. Add Complex decision records and Explain

- Add the managed Complex `decisions.md` template, parser, summaries, forbidden
  raw-reasoning/credential checks, and supersession validation.
- Enforce an Accepted material decision at Design completion and revalidate at
  Review while instructing implementation-alignment review.
- Add read-only `EmpiricalProject.explain()`, human/JSON `empirical explain`, and
  `empirical_explain` with current state, next-action reason, required/missing
  context, gate, and accepted decision summaries.
- Prove Explain performs no writes and exposes no prompts, tokens, environment,
  secrets, or hidden-reasoning fields.

Addresses: AC-8, AC-9, AC-10.

## 6. Replace CLI, MCP, and generated agent integrations

- Delete global `--workstream`, the workstream CLI family, MCP workstream inputs,
  and `empirical_workstreams`; make legacy invocations fail clearly.
- Add CLI `config`, `worktree create`, and `explain`, plus MCP proposal/create,
  configure, and Explain tools with correct mutability annotations.
- Teach Fast/Complex human and structured renderers about the packet-or-proposal
  discriminator and worktree handoff.
- Regenerate project/global skills and all supported agent formats so the current
  runtime asks for approval, executes creation, and resumes in the returned path.
- Update CLI/MCP/integration tests and assert the public surface contains no
  named-workstream vocabulary.

Addresses: AC-1, AC-4, AC-5, AC-7, AC-9, AC-10.

## 7. Documentation, migration guidance, and full verification

- Rewrite README, demos, changelog/release notes, command reference, OpenSpec
  comparison, and migration guidance around one feature per checkout.
- Explain first-run configuration, simple and Complex examples, decision records,
  Explain, worktree approval, the deliberate 2.x incompatibility, and how to
  inspect—not migrate—old named-workstream data.
- Update living capability deltas and ensure generated artifacts/documentation
  contain no obsolete commands or version numbers except explicit history.
- Run typecheck, full source tests, built-distribution smoke, package dry-run with
  isolated cache, packed-consumer install, real-worktree smoke, focused searches,
  and whitespace/diff checks. Record evidence for every acceptance criterion.

Addresses: AC-1 through AC-11.

## 8. Review, archive, publish, and permanently remove 2.x

- Complete Test and Review only after matching implementation and evidence to
  every accepted decision and acceptance criterion.
- Apply the validated capability deltas during Archive and finish the exact
  feature revision before release mutation.
- Commit and push the verified `0.20.0` source.
- Publish `empirical-sdd@0.20.0`, verify its tarball metadata and installability,
  set/verify `latest`, then individually unpublish `2.0.0`, `2.2.0`, `2.3.0`,
  and `2.3.1` with explicit npm authentication.
- Query versions/dist-tags one final time and report any partial registry state
  precisely; never unpublish the package as a whole.

Addresses: AC-8, AC-10, AC-11.
