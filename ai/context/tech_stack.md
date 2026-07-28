# Technology Stack

## Protocol

- Markdown for human-authored specifications, design notes, and reviews.
- JSON and JSON Schema for deterministic state, events, plans, and evidence.
- TOML for repository configuration.

## Reference implementation

- Rust 2024 edition, MSRV 1.85.
- One reusable library crate and one `empirical` CLI binary.
- Filesystem-backed canonical state with atomic writes and optimistic
  concurrency.
- No mandatory database, daemon, IDE, cloud service, or MCP installation.

## Integrations

- Command adapters are the portable baseline.
- MCP/browser and IDE integrations implement optional capability traits.
- Git and GitHub delivery are opt-in CLI adapters.

## Open

- Package-registry publication is deferred until the repository contract is
  stable; GitHub source and release binaries are the first distribution path.
