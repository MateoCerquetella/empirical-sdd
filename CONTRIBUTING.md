# Contributing

Keep changes product-neutral and preserve read-only compatibility with existing
`ai/` repositories. Any protocol change should include a schema update,
migration note, and conformance test. Quick must remain materially shorter than
Strong, while both retain evidence and review gates.

Before opening a pull request:

```bash
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets
```

Do not add a required database, IDE directory, hosted service, or MCP vendor to
the canonical state path. New integrations belong behind capability or provider
interfaces.
