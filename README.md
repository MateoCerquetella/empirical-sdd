# Empirical SDD

Agent-neutral, resumable spec-driven development for Codex, Claude Code,
Cursor, Gemini CLI, Windsurf, and MCP clients.

> Empirical is alpha software. It supports one active feature per checkout and
> uses Git worktrees for isolated parallel work.

## Install

```bash
npm install -g empirical-sdd
empirical install
```

Choose your coding agents in the installer, then restart or reload them.

## Use

Invoke Empirical from your coding agent with a request:

```text
Codex:      $empirical <request>
Claude:     /empirical <request>
Cursor:     empirical <request>
Gemini:     empirical <request>
Windsurf:   @empirical <request>
```

Empirical initializes the repository, selects the appropriate workflow, and
continues through specification, implementation, verification, and review.
These are agent skills, not shell commands.

## Development

Requires Node.js 20+ and Bun.

```bash
bun install
bun run ci
```

## Documentation

[Architecture](docs/architecture.md) · [Demos](docs/demo.md) ·
[MCP](docs/mcp.md) · [Security](docs/security.md) ·
[Migration](docs/migration-v1.md)

## License

[MIT](LICENSE)
