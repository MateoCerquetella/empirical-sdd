# Project Overview

## Purpose

Empirical SDD is a TypeScript library, Node.js CLI, and stdio MCP server for
agent-neutral, resumable spec-driven repository work. It turns feature requests
into exact Fast or Complex state-machine actions backed by committed contracts,
evidence, review, living capability specifications, and safe Git worktrees.

## Boundaries

- One active feature is selected per checkout; parallel work uses real linked
  Git worktrees.
- Five globally installed Empirical skills provide automatic and deliberate SDD
  modes. Public CLI commands remain Install and Update; workflow operations are
  MCP/private automation APIs.
- Repository knowledge is bounded and file-backed. There are no embeddings,
  hosted indexing services, or persisted private reasoning.
- Empirical does not publish, commit user work, force Git, or launch another
  agent without exact explicit approval.

## Evidence

- Product contract and usage: `README.md`
- Runtime/package boundary: `package.json`, `scripts/build.ts`
- Architecture and security: `docs/architecture.md`, `docs/security.md`
- Core workflow and adapters: `src/core.ts`, `src/cli.ts`, `src/mcp.ts`
