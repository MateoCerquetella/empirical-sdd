# Embedding and host integration

An IDE, agent runtime, or automation service should consume Empirical SDD as a
library or CLI, not own its workflow truth.

## Recommended integration

- Embed the Rust crate or invoke `empirical` with JSON output.
- Implement `PhaseAdapter` using the host's agents and available MCP tools.
- Translate browser MCP results into neutral browser assertion and
  screenshot-review evidence.
- Treat any database as a disposable search/index projection of repository
  events.
- Store no required phase, approval, evidence, or retry state exclusively in
  a host directory or database.
- Use state revisions for writes so the host interoperates with another IDE or
  CLI working in the same repository.
- Require the host's own user permission in addition to repository delivery
  configuration before commit, push, or PR.

## Recovery test

A valid integration must pass this scenario:

1. One host advances a feature and exits.
2. Its database and cache are deleted.
3. A different conforming client discovers the repository.
4. The client reconstructs state from `ai/events/`, validates evidence, and
   continues the exact current phase.

If step 4 requires a host-specific directory, SQLite, a prior chat, or host
credentials, the integration is not protocol-conforming.
