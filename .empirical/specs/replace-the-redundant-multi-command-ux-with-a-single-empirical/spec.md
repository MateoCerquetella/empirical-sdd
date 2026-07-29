# Replace The Redundant Multi-Command UX With One Empirical Entrypoint

## Request

> Replace the redundant multi-command UX with a single Empirical entrypoint installed for every detected supported agent. Keep only empirical install and empirical update as normal human terminal lifecycle commands; the installed agent entrypoint must initialize an uninitialized repository, create and maintain compact repository knowledge, conduct Socratic discovery only when needed, choose Fast or Complex internally, resume active work, and after an approved spec offer to continue in the current agent, save, or launch a user-selected detected agent. Preserve structured MCP operations as internal automation APIs and hidden compatibility surfaces where necessary, remove separate Explore, Fast, Complex, and Loop installed skills from the normal user experience, never launch an agent without explicit approval, and verify lifecycle installation/update, agent-owned initialization, repository knowledge refresh, routing, resume, agent detection, explicit handoff, and worktree startup from repositories containing terminal or blocked historical feature state.

## Goal

A developer installs Empirical once, invokes one native `empirical` entrypoint
inside any supported coding agent, and lets that entrypoint initialize context,
clarify only genuine ambiguity, choose or resume the correct internal workflow,
and optionally hand the approved specification to another detected agent. The
terminal product surface is reduced to installation and update; existing CLI,
TypeScript, and MCP workflow operations remain stable automation machinery.

## Acceptance Criteria

- [ ] [AC-1] `empirical install` works outside a repository, detects supported
  local agents, installs exactly one managed global Empirical entrypoint for
  each detected or previously managed agent, and reports its native invocation
  and reload guidance without creating project state or launching an agent.
- [ ] [AC-2] Installation and update remove obsolete Empirical-managed Explore,
  Fast, Complex, and Loop global entrypoints, while preserving unmanaged files,
  directories, symbolic links, unrelated configuration, and destinations
  outside the selected home.
- [ ] [AC-3] `empirical update` upgrades `empirical-sdd@latest` and then refreshes
  the single managed entrypoint through the newly installed CLI; failures from
  either step are reported without claiming success.
- [ ] [AC-4] Normal human help and README present only `empirical install` and
  `empirical update` as terminal lifecycle commands plus the one in-agent
  Empirical invocation. Existing init, explore, fast, complex, loop, complete,
  archive, status, context, and handoff operations remain callable and typed for
  agents, MCP clients, scripts, and migration compatibility.
- [ ] [AC-5] On first invocation in an uninitialized repository, the single
  agent entrypoint performs Empirical initialization in the current runtime,
  applies safe configuration or asks only material first-run questions, and
  does not install redundant project-local workflow entrypoints.
- [ ] [AC-6] Initialization creates a compact `.empirical/context/` repository
  knowledge set with a deterministic manifest and navigable Markdown pages for
  overview, architecture, commands, and conventions. Refresh detects relevant
  repository changes, remains bounded and secret-safe, uses no embeddings,
  external service, or vector database, and action/discovery packets reference
  the knowledge paths for progressive retrieval.
- [ ] [AC-7] The one generated agent entrypoint deterministically routes an
  invocation: initialize and refresh context when needed; resume non-terminal
  work; conduct the five-pass Socratic interview only for genuinely vague work;
  otherwise select Fast only for an eligible tiny change and Complex for all
  other work. Users never need to invoke Explore, Fast, Complex, or Loop skills.
- [ ] [AC-8] After a Complex specification passes, the agent offers three clear
  choices: continue in the current agent, save the resumable specification, or
  hand off to one detected agent. The offer is not inserted before a concrete
  specification exists and saving performs no launch.
- [ ] [AC-9] Agent detection distinguishes prompt-capable CLI sessions from
  workspace-only IDE launchers and returns an exact cwd, argv, and approved-spec
  prompt. No subprocess is launched until the user explicitly selects the
  displayed target and approves the exact handoff.
- [ ] [AC-10] A newly created linked worktree can start its intended feature
  even when the base commit contains terminal history or a blocked feature from
  another checkout; checkout-local active selection preserves resumability in
  the owning checkout without allowing two active features in one checkout.
- [ ] [AC-11] Project/global migration is repeatable: managed obsolete entrypoints
  are reconciled, existing schema-4 projects and discoveries remain readable,
  unmanaged content is untouched, and a second install, init, context refresh,
  or migration produces no unnecessary changes.
- [ ] [AC-12] Type checking, focused lifecycle/knowledge/routing/handoff/worktree
  tests, the full test suite, built CLI and MCP smoke, and package dry-run all
  pass; a packed install exposes the simplified help and one-entrypoint output.

## Scope

- Add `empirical install` and make it the supported global integration command;
  retain `integrate --global` as a hidden compatibility alias.
- Refresh `empirical update` so package and managed entrypoints converge.
- Replace the five generated project/global entrypoints with one global
  Empirical entrypoint and safely reconcile older managed artifacts.
- Move initialization, discovery routing, workflow selection, resume, context
  refresh, and handoff guidance into that one agent contract.
- Add deterministic compact repository knowledge and expose it to packets.
- Add agent detection and exact, approval-bound handoff proposals.
- Fix active-feature ownership for linked Git worktrees.
- Update public types, MCP, tests, documentation, architecture, and package
  smoke behavior while preserving internal automation calls.

## Non-goals

- Embeddings, semantic-vector storage, a hosted RAG service, network crawling,
  or indexing ignored files, credentials, build output, or dependency trees.
- Automatically choosing or launching another AI runtime without the user's
  explicit approval of a displayed target and command.
- Pretending Cursor or Windsurf can accept an interactive prompt when only a
  workspace launcher is detected.
- Removing the internal state machine, Fast/Complex profiles, exact revisions,
  evidence gates, living capability deltas, or MCP tools.
- Deleting unmanaged legacy agent commands or rewriting arbitrary user agent
  configuration.
- Publishing a new npm release in this implementation feature.

## Risks

- A global skill can be shadowed by stale project-local managed skills; safe
  reconciliation must remove only marker-owned artifacts.
- Agent binaries and invocation flags vary across platforms and versions;
  detection and proposals must be explicit and conservative.
- Repository scanning can leak secrets or become expensive; use Git-aware
  bounded metadata, exclusions, path safety, and no file-content ingestion into
  the manifest.
- Checkout-local ownership can make a cloned repository's intended resume state
  ambiguous; the fallback must be deterministic and must reject multiple
  candidates rather than guessing.
- Updating the running global package cannot hot-reload its own module graph;
  refresh must be delegated to the newly installed CLI process.

## Verification

- Run isolated-home tests for detected, absent, existing-managed, unmanaged,
  symlink, repeated, install, update, and compatibility-alias cases.
- Initialize representative TypeScript, mixed, empty, ignored-file, and linked
  worktree fixtures; inspect manifests, Markdown pages, packet references,
  staleness, bounds, and repeatability.
- Assert the single generated skill contains every routing and approval gate and
  that no dedicated skills are reported or left when marker-owned.
- Test fake PATH agent detection, CLI/workspace capability classification,
  exact handoff argv/prompt, save/current choices, and approval rejection.
- Reproduce the observed worktree handoff failure from a base containing a
  blocked feature and prove both owning-checkout resume and new-checkout start.
- Run `bun run ci`, inspect the final diff, and install the packed tarball in an
  empty consumer with an isolated home.

## Capability Deltas

- `deltas/agent-integrations.md`
- `deltas/exploratory-discovery.md`
- `deltas/repository-knowledge.md`
- `deltas/agent-handoff.md`
- `deltas/worktree-isolation.md`
