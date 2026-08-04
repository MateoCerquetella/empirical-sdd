# Architecture

## Components and ownership

- `src/core.ts`: workflow state machine, phase gates, evidence, packets,
  initialization, orchestration, and handoff.
- `src/storage.ts`: schema, feature state, exact journals, atomic writes, locks,
  and migration.
- `src/specifications.ts` / `src/decisions.ts`: living capability deltas and
  evidence-backed Complex decisions.
- `src/worktrees.ts` / `src/checkouts.ts`: safe Git worktree creation and
  checkout-local active selection.
- `src/knowledge.ts` / `src/knowledge-templates.ts`: bounded repository
  inventory, compact context, and managed/legacy placeholder recognition.
- `src/discovery.ts`: ordered Socratic passes, progressive durable answers, and
  exact approved Complex handoff.
- `src/agents.ts` / `src/integrations.ts` / `src/lifecycle.ts`: supported-agent
  detection, the six-skill global catalog, managed migration, updates, and
  ownership-bound global uninstall.
- `src/cli.ts` / `src/mcp.ts`: adapters over the same core API.

## Data and control flow

A user invokes the automatic skill or explicit Init, Spec, Socratic, or Loop in
a host agent. The host initializes or repairs `.empirical/`, retrieves relevant
context, then routes, drafts, pauses for approval, or resumes according to that
skill's boundary. After source-changing implementation, invalid repository
knowledge routes through the persisted Context phase before Verify or Done.
Returned actions and evidence still use one state machine.
Complex Review projects validated deltas into living capability specifications.
Git metadata selects the feature owned by each linked checkout.

## External dependencies

- Node.js 22+ runtime APIs and Git subprocesses invoked without a shell.
- `@modelcontextprotocol/sdk` and Zod for the stdio MCP adapter.
- Bun and TypeScript are development/build dependencies, not runtime
  requirements of the published package.
