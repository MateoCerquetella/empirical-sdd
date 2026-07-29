# npm-installed agent-neutral Empirical

## Request

Replace the Rust implementation with one npm-installed TypeScript package, a
self-guiding CLI, and optional MCP support for Codex, Claude, Gemini, Cursor,
and Windsurf.

## Goal

A developer installs Empirical once with npm, initializes one repository, and
can then use the same resumable workflow from every supported coding agent
without installing an agent-specific command pack.

## Acceptance Criteria

- [ ] [AC-1] `npm install -g empirical-sdd` installs one `empirical` executable without requiring Rust, Cargo, or Bun at runtime.
- [ ] [AC-2] `empirical init` creates portable `.empirical/` state and safely adds automatic project guidance without overwriting existing instructions.
- [ ] [AC-3] The package exposes a self-guiding CLI and importable TypeScript API backed by the same revisioned Quick and Strong workflow engine.
- [ ] [AC-4] The package exposes an on-demand stdio MCP server whose tools operate on the same repository state as the CLI.
- [ ] [AC-5] Codex, Claude Code, Gemini CLI, and Cursor receive safe project MCP configuration; Windsurf and every terminal-capable agent retain the CLI fallback.
- [ ] [AC-6] Verification requires criterion evidence, UI evidence requires browser plus screenshot proof, and review requires review evidence.
- [ ] [AC-7] Existing v1 `ai/` repositories can be adopted without deletion, and stale revisions cannot overwrite newer work.
- [ ] [AC-8] Type checks, Bun tests, Node runtime checks, cross-platform CI configuration, and npm package inspection pass.

## Scope

The TypeScript library, CLI, stdio MCP server, repository store, discovery
adapters, v1 adoption, documentation, installer, tests, and CI.

## Non-goals

Running an AI model, a GUI, daemon, hosted service, database, automatic Git
delivery, or guaranteed integration with agents that have neither terminal nor
MCP access.

## Risks

Host MCP configuration formats can drift. MCP therefore remains optional and
the CLI is the stable portability boundary.

## Verification

Run `bun run check`, `bun test`, build the package, execute the compiled CLI
with Node.js, exercise the MCP server through an SDK client, and inspect the npm
package contents.
