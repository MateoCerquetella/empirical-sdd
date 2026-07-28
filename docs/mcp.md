# MCP integration

`empirical mcp` starts the bundled stdio server. It exits with its host and does
not run as a background daemon.

`empirical init` safely merges project MCP configuration for:

- Codex: `.codex/config.toml`
- Claude Code: `.mcp.json`
- Gemini CLI: `.gemini/settings.json`
- Cursor: `.cursor/mcp.json`

Windsurf currently uses a user-level MCP configuration, so Empirical does not
silently modify the user's home directory. Windsurf automatically reads the
generated root `AGENTS.md` and uses the CLI fallback. A user may optionally add
this server through Windsurf's MCP settings:

```json
{
  "mcpServers": {
    "empirical": {
      "command": "empirical",
      "args": ["mcp"]
    }
  }
}
```

Project MCP configurations are code execution requests. Hosts may require the
developer to trust the repository before starting the server. That approval is
intentional and must not be bypassed.
