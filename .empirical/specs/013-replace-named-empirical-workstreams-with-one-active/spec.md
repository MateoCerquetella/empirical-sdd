# Replace Named Empirical Workstreams With Worktree-First Execution

## Request

> Replace named Empirical workstreams with one active feature per Git worktree; add approved, configurable worktree creation; add an evidence-backed decision trail and explain command; and reset the public alpha version line to 0.20.0.

## Goal

Give developers one obvious isolation model: each checkout runs at most one
active Empirical feature, and unrelated work is offered a real Git worktree.
Make every material Complex design choice reviewable through concise evidence,
alternatives, consequences, and verification without storing private model
chain-of-thought.

## Acceptance Criteria

- [ ] [AC-1] Named workstreams are absent from the TypeScript API, packet
  schema, CLI flags and commands, MCP tools, persisted layout, generated agent
  guidance, tests, and user documentation; normal actions and completion
  commands contain no workstream field.
- [ ] [AC-2] Every feature owns its state, event journal, lock, specification,
  decisions, and evidence below `.empirical/specs/<feature>/`; descriptive
  portable slugs replace sequential feature numbers, and two branches created
  from the same base can progress without colliding on root state, events, or
  feature paths.
- [ ] [AC-3] Existing schema-1/2/3 default root state and events migrate
  non-destructively into the corresponding feature directory, while named
  workstream manifests/directories are unsupported and not migrated. Terminal
  legacy root state does not block a new feature.
- [ ] [AC-4] First interactive `empirical init` asks once about isolation mode,
  detected/editable base branch, sibling worktree-path template,
  `<type>/<feature>` branch pattern, and Complex decision records, persists the
  answers, and can be rerun with `empirical config`; non-interactive CLI/API/MCP
  paths use deterministic safe defaults or explicit flags without prompting.
- [ ] [AC-5] Starting unrelated work in an active checkout returns or displays
  a complete proposal containing request, detected base, inferred editable
  change type, branch, and sibling path, and requires explicit approval before
  any Git or filesystem mutation.
- [ ] [AC-6] Approved creation checks that the current Git checkout is clean,
  resolves the chosen base, rejects existing branch/path/worktree collisions,
  and executes `git worktree add -b <type>/<slug> <path> <base>` without
  `--force`; failures leave the original checkout and workflow unchanged.
- [ ] [AC-7] A successful worktree handoff initializes or migrates the new
  checkout, starts the exact requested Fast or Complex feature there, and
  reports its absolute path, branch, base, feature, revision, and resume command
  for human and structured consumers.
- [ ] [AC-8] Every Complex feature contains a managed `decisions.md` whose
  material entries record evidence, options, decision, trade-offs/risks, and
  verification; Design cannot pass with an empty or malformed record and Review
  cannot pass when implementation contradicts accepted decisions without an
  explicit superseding entry.
- [ ] [AC-9] `empirical explain` and `empirical_explain` are read-only and show
  current state, why the current action is next, required and missing context,
  the stop/proceed gate, and accepted decision summaries in human and JSON/MCP
  forms without exposing hidden reasoning, secrets, or token-level traces.
- [ ] [AC-10] Existing Fast/Complex/Explore/Loop, exact revisions, evidence,
  Archive, capability deltas, project policy, global skills, integrations,
  concurrency recovery, and Windows lock tolerance remain verified after the
  storage and packet redesign.
- [ ] [AC-11] Package and product versions are `0.20.0`; typecheck, tests,
  distribution smoke, package dry-run, clean packed-consumer, real temporary Git
  worktree, and documentation checks pass before publishing. After `0.20.0` is
  published and tagged `latest`, npm versions `2.0.0`, `2.2.0`, `2.3.0`, and
  `2.3.1` are permanently unpublished using explicit registry authentication.

## Scope

- Replace project-global workflow state with feature-scoped state and journals.
- Remove named-workstream code and vocabulary rather than retaining a hidden
  compatibility layer.
- Safely migrate only the historical default root state used by all existing
  Empirical projects.
- Add persisted project configuration for worktree and decision behavior.
- Add interactive init/config UX plus non-interactive flags and structured API
  equivalents.
- Add proposal, approval, creation, and handoff operations for Git worktrees.
- Add Complex decision records, validation, summaries, packet rationale, and
  Explain surfaces.
- Refresh project/global skills so current agents ask for approval and execute
  the returned worktree operation in the same runtime.
- Publish the reset alpha release before removing the four public 2.x versions.

## Non-goals

- Automatic stash, commit, movement, or copying of uncommitted changes.
- `git worktree --force`, destructive removal, pruning, branch deletion, or
  automatic cleanup of completed worktrees.
- Launching or switching an AI runtime, terminal, editor, or GUI.
- Jira, Confluence, corporate ADR, repository-classification, wiki, MR-dossier,
  or subagent-role machinery from the reference toolkit.
- Persisting private chain-of-thought, prompt transcripts, credentials, secrets,
  or unrestricted scratchpads.
- Migrating named workstream state or preserving its public commands and types.

## Risks

- Git discovery differs across local-only repositories, multiple remotes, and
  detached checkouts; ambiguous bases must remain editable and block automation.
- Worktree creation is a durable external mutation. Preview, explicit approval,
  clean-tree validation, collision checks, and absence of force flags are hard
  gates.
- Relocating state can strand existing default workflows. Migration must be
  atomic, idempotent, symlink-safe, and covered from schema 1, 2, and 3 fixtures.
- Feature slugs derived concurrently must match globally shared Git branch
  uniqueness and reject collisions without fallback that hides intent.
- Decision records can become ceremony or disguised chain-of-thought. Validation
  must require concise externally reviewable rationale only for Complex work.
- Publishing a lower SemVer than existing 2.x requires an explicit `latest`
  dist-tag, and npm unpublish is irreversible. Publish and verify 0.20.0 first.

## Verification

- Run core/API/CLI/MCP tests proving every workstream field and command is gone.
- Create real temporary Git repositories and linked worktrees to verify prompts,
  editable base/type/path, clean-tree and collision guards, exact `-b` behavior,
  failure atomicity, handoff state, and parallel non-collision.
- Exercise interactive init/config through piped terminal fixtures and validate
  non-interactive defaults and explicit overrides.
- Test schema-1/2/3 default-state migration, terminal legacy states, malformed
  state, symlinks, concurrency, and retry behavior.
- Test decision parsing and Design/Review gates, superseding entries, Explain
  human/JSON/MCP parity, and absence of forbidden raw-reasoning fields.
- Run `bun run check`, `bun test`, `bun run test:dist`, package dry-run with an
  isolated npm cache, clean packed-consumer smoke, and `git diff --check`.
- Verify npm 0.20.0 contents and dist-tag before individually unpublishing each
  authorized 2.x version and confirming registry state.

## Capability Deltas

- `deltas/parallel-workstreams.md`
- `deltas/worktree-isolation.md`
- `deltas/decision-traceability.md`
- `deltas/living-specifications.md`
