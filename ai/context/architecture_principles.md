# Architecture Principles

1. **The repository is canonical.** Semantic workflow state must survive the
   loss of every IDE database and cache.
2. **Adapters do not own the protocol.** Editors, agents, MCP servers, hosted
   runtimes, and CLIs are interchangeable clients.
3. **Compatibility before migration.** Reading an existing v1 repository must
   not require an eager rewrite.
4. **Evidence before completion.** A green label without criterion-bound
   evidence is not Done.
5. **Fast paths remain short.** Quick mode has fewer artifacts and transitions,
   not weaker truthfulness.
6. **Side effects require two keys.** Repository configuration enables a
   delivery action; the invoking human or host separately authorizes execution.
7. **Fail closed only where required.** Missing optional capabilities are
   reported; missing required capabilities block with a useful reason.
8. **Protocol first, implementation second.** Schemas and conformance fixtures
   define behavior independently of Rust.
