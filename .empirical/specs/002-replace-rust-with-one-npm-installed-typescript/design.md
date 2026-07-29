# Design

Use one Node-compatible TypeScript library as the only workflow implementation.
Expose it through a thin CLI and a thin stdio MCP adapter. Store canonical state
as committed JSON and Markdown under `.empirical/`, with revision checks,
append-only transition events, atomic projection, and a short-lived local lock.

`empirical init` writes managed instruction blocks and merges only the named
`empirical` MCP entry into supported project configurations. Existing content
or conflicting entries are preserved. `AGENTS.md` supplies the shared fallback
for Codex, Cursor, and Windsurf; Claude and Gemini receive their native root
instruction files.
