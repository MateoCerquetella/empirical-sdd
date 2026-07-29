# Design: One Empirical Entrypoint

## Product surface

The supported human terminal surface becomes:

```text
empirical install
empirical update
```

`empirical --help` explains those lifecycle operations and directs feature work
to the one native in-agent Empirical entrypoint. Existing CLI verbs remain an
advanced compatibility surface because generated instructions, MCP fallbacks,
scripts, and existing repositories depend on them. They remain validated but no
longer appear as choices in primary help or README.

The global installer writes one marker-owned `empirical/SKILL.md` for each
detected supported agent. Existing marker-owned `empirical-explore`,
`empirical-fast`, `empirical-complex`, and `empirical-loop` targets are removed;
unmanaged targets and symlinks are preserved. Project initialization configures
runtime/MCP files but creates no project-local workflow skills. Existing
marker-owned project skills and managed instruction blocks are reconciled so
they cannot shadow the global entrypoint.

## Agent catalog and lifecycle

Introduce `src/agents.ts` as the single catalog for Codex, Claude Code, Cursor,
Gemini CLI, and Windsurf. Each entry defines executable candidates, native skill
root, invocation syntax, reload guidance, and launch capability. Codex, Claude,
and Gemini are prompt-capable CLI sessions when executable on PATH; Cursor and
Windsurf are workspace-only unless a supported prompt contract is available.

Detection is injectable for tests and treats an existing Empirical-managed
target as installed even if its binary is temporarily absent, allowing update
to refresh it. `empirical install --all` remains an explicit recovery option;
the default installs detected or previously managed agents.

`empirical update` starts npm with `install -g empirical-sdd@latest`. After that
process succeeds, it starts a new `empirical install` process rather than using
the old process's loaded modules. Exit codes identify the package or integration
stage precisely.

## The one generated agent contract

All native renderers carry the same semantic contract with syntax adapted:

1. Work in the current host agent by default.
2. If `.empirical/` is missing, inspect the repository, ask only material
   first-run questions, invoke internal initialization, and complete context.
3. Refresh compact repository knowledge and retrieve only relevant pages.
4. If a selected feature exists, resume it; attached text must not replace it.
5. For a vague idea, run the five Socratic passes one at a time and wait for
   approval of the refined contract.
6. For concrete work, use internal Fast only when every eligibility condition
   holds; use internal Complex otherwise.
7. Consume returned actions through Done, Blocked, or awaiting-human while
   preserving revisions, evidence, Review, and Archive.
8. When Complex Specify advances to Design, offer Continue here, Save, or a
   detected-agent handoff. Never launch before exact approval.

This replaces all dedicated generated workflow skills. Internal MCP tools keep
their names so agents can execute structured operations directly.

## Compact repository knowledge

Add `src/knowledge.ts` and a public `RepositoryKnowledgeReport`. Initialization
and explicit refresh create:

```text
.empirical/context/
├── manifest.json
├── index.md
├── overview.md
├── architecture.md
├── commands.md
└── conventions.md
```

Git repositories use tracked plus non-ignored untracked paths. Non-Git fallback
uses a bounded walk. `.git`, `.empirical`, dependencies, build output, caches,
coverage, ignored paths, secret-like names, binaries, and oversized files are
excluded. The manifest stores normalized paths, sizes, and content hashes—not
source contents—and is capped by file count and total bytes.

`manifest.json` and `index.md` are generator-owned. Topic pages are created once
and preserved for agent synthesis. If the digest is unchanged, refresh writes
nothing. Action and exploration packets add `knowledgeContext` paths, separate
from policy and living capability paths, for progressive retrieval.

An internal CLI `empirical context` and MCP `empirical_context` expose refresh
and status. They are automation surfaces, not primary human commands.

## Explicit agent handoff

`src/agents.ts` builds read-only `AgentHandoffOffer` records after Complex
Specify passes. Each option includes agent identity and capability, active
feature and specification, absolute cwd, exact argv and prompt, and a SHA-256
approval token over all displayed fields.

`empirical_handoff` and the hidden `empirical handoff` return the offer. Approval
re-reads state, recomputes the option, and returns an authorized command only
when target, feature, spec digest, argv, and token still match. It never starts a
process itself. The current host executes that exact command only after explicit
human approval. Current and Save choices never create processes.

## Checkout-local active ownership

Portable state remains under each feature directory, but selection moves to a
path below each checkout's own absolute Git directory:

```text
<absolute git-dir>/empirical-sdd/active-feature
```

Empirical resolves the directory with `git rev-parse --path-format=absolute
--git-dir`. For a linked worktree this is below `.git/worktrees/<name>/`; for
the main checkout it is `.git/`. Starting or resuming writes one validated
feature ID atomically. Reaching Done clears only that checkout's pointer.

Compatibility recovery follows these rules:

1. A valid local pointer wins.
2. A new linked worktree ignores non-terminal features already claimed by
   another registered checkout.
3. If exactly one unclaimed feature remains, the checkout may recover it.
4. Multiple unclaimed candidates block rather than guess.
5. Non-Git repositories retain the single-candidate scan.

Worktree proposal reads the source checkout first, ensuring legacy work is
claimed before Git creates the new checkout. The new checkout does not inherit
that pointer and starts the approved feature normally.

## API and compatibility

- `IntegrationReport` gains `removed`; entrypoint reports contain one invocation.
- `ActionPacket` and `ExplorationPacket` gain `knowledgeContext`.
- Add agent detection, handoff, and repository-knowledge types and exports.
- Existing initialization, workflow, completion, archive, status, and migration
  methods remain.
- `integrate --global` aliases install; project `integrate` reconciles runtime
  configuration and removes only obsolete marker-owned command artifacts.
- Existing discoveries and schema-4 feature directories remain readable.
- This feature does not publish a package.

## Verification design

Focused suites cover the agent catalog, isolated-home lifecycle operations,
managed cleanup, knowledge bounds and convergence, packet context, single-skill
routing text, handoff approval integrity, and linked-worktree ownership. Existing
core, discovery, decision, delta, migration, and integration tests protect
compatibility. Final verification runs TypeScript, all tests, built CLI/MCP
smoke, npm pack dry-run, and a clean tarball consumer.
