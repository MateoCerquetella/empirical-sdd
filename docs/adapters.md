# Adapters

The core exposes a Rust `PhaseAdapter` trait and a product-neutral command
adapter. An adapter declares which phases and capabilities it supports, receives
a bounded phase context, and returns a versioned phase-result envelope.

## Command adapter

```toml
[adapters.verify]
program = "your-agent-runner"
args = ["verify", "--context", "{context}", "--result", "{result}"]
timeout_seconds = 1800
capabilities = ["tests", "browser", "screenshots", "screenshot_review"]

[adapters.review]
program = "your-independent-reviewer"
args = ["--context", "{context}", "--result", "{result}"]
capabilities = ["code_review"]
```

Available placeholders are `{root}`, `{spec}`, `{spec_dir}`, `{phase}`,
`{profile}`, `{workspace_hash}`, `{context}`, and `{result}`. Substitution occurs
inside individual arguments; no shell is involved. The same values are provided through
`EMPIRICAL_*` environment variables. `SDD_*` aliases remain available for v1
adapter compatibility.

The adapter must write JSON matching
[phase-result.schema.json](../schemas/phase-result.schema.json). A successful
process that omits this file fails the phase. Every entry in `artifacts` is a
repository-relative path to a non-empty regular file, not a directory or glob.
Evidence records use the `workspaceHash` supplied in the phase context; a
different current workspace is rejected at check-in and review.
Configured programs execute only when the caller passes `empirical loop
--allow-exec`.

## MCP and IDE hosts

MCP is a host capability, not a protocol dependency. For example, an agent may
receive the Verify context, use an installed browser MCP to drive the UI, save
screenshots into the spec, inspect those screenshots, and return neutral
evidence records. Another client can validate those records without having the
same MCP server.

An IDE can implement the Rust trait, invoke the CLI, or use the external flow:

1. call `empirical next --json`;
2. perform the phase using any internal tools;
3. write the result envelope; and
4. call `empirical check-in --expected-revision N --result result.json`.

The expected revision and current spec revision must be carried through the
interaction. Stale work is rejected instead of overwriting newer state.
