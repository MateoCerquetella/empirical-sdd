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
- `src/knowledge.ts`: bounded repository inventory and compact context.
- `src/agents.ts` / `src/integrations.ts` / `src/lifecycle.ts`: supported-agent
  detection, one global skill, managed migration, and package updates.
- `src/cli.ts` / `src/mcp.ts`: adapters over the same core API.

## Data and control flow

A user invokes the global skill in a host agent. The host initializes or opens
`.empirical/`, retrieves relevant context, resumes selected work or routes a new
request, executes the returned exact action, and submits completion evidence.
Complex Review projects validated deltas into living capability specifications.
Git metadata selects the feature owned by each linked checkout.

## External dependencies

- Node.js 20+ runtime APIs and Git subprocesses invoked without a shell.
- `@modelcontextprotocol/sdk` and Zod for the stdio MCP adapter.
- Bun and TypeScript are development/build dependencies, not runtime
  requirements of the published package.
