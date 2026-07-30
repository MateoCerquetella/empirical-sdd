# Verification

## Full pipeline

- `bun run ci`: passed.
- TypeScript check: passed.
- Full source suite: 83 tests passed, 0 failed, 637 expectations.
- Built distribution smoke: passed, including MCP discovery, internal workflow,
  real Git worktree, public help, and 25 generated skill files.
- npm package dry-run: passed with 22 declared files.

## Packed clean consumer

A fresh `empirical-sdd-0.20.1.tgz` was installed under an isolated temporary
prefix with a private npm cache.

- Installed binary reported `0.20.1`.
- Public help exposed only Install and Update as terminal lifecycle commands and
  listed all five in-agent skills.
- Direct packaged `empirical init` failed with `UNKNOWN_COMMAND`.
- The packed TypeScript export installed 25 files: five skills for each of five
  agents.
- Structured reports contained five native invocations for every agent.
- The skill-creator validator passed the packed Codex copies of `empirical`,
  `empirical-init`, `empirical-spec`, `empirical-socratic`, and
  `empirical-loop`.

## Focused behavior

- Partial schema-4 initialization applies explicit settings, preserves omitted
  settings, repairs missing context, removes marker-owned local shadows, starts
  no feature, and converges on repetition.
- Agent-native discovery creates an empty durable draft, returns exactly one
  next question, saves each ordered answer, requires only material follow-ups,
  rejects invalid or changed submissions, binds the approved refined request
  exactly to Complex Specify, and is available through MCP and private CLI.
- Installation covers all supported agents, exact selection/deselection,
  idempotence, current and legacy reconciliation, unmanaged collisions,
  symbolic links, non-files, and path containment.
- Loop's idle packet creates no state and directs users to Automatic, Spec, or
  Socratic.
- `git diff --check`: passed.
