# Contributing

Keep the core product-neutral and preserve non-destructive adoption of existing
`ai/` repositories. Agent-specific files are generated discovery adapters; they
must never contain workflow state or business logic. Any protocol change needs
a migration note and conformance test. Fast must remain materially shorter than
Complex while both retain evidence and review gates.

Changes to living specifications must preserve strict delta validation, atomic
Archive rollback, and idempotent retry. Workstream changes must keep the default
state/event paths compatible, bind mutations explicitly, and test shared-resource
concurrency. Project policy may add context but must never become an enforcement
override. OpenSpec can be used for development planning, but it must not become a
runtime or published-package dependency.

Before opening a pull request:

```bash
bun install
bun run check
bun test
bun run test:dist
bun run test:package
npx --yes @fission-ai/openspec@latest validate evolve-empirical-living-specs --strict
```

The published package must run on Node.js 20+ even though Bun powers local
development. Do not add a required database, hosted service, or MCP vendor to
the canonical state path. New integrations call the exported TypeScript API.
