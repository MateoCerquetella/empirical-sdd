# Contributing

Keep the core product-neutral and preserve non-destructive adoption of existing
`ai/` repositories. Agent-specific files are generated discovery adapters; they
must never contain workflow state or business logic. Any protocol change needs
a migration note and conformance test. Quick must remain materially shorter
than Strong while both retain evidence and review gates.

Before opening a pull request:

```bash
bun install
bun run check
bun test
bun run test:package
```

The published package must run on Node.js 20+ even though Bun powers local
development. Do not add a required database, hosted service, or MCP vendor to
the canonical state path. New integrations call the exported TypeScript API.
