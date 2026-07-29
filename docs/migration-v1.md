# Migration to Empirical 0.20

## Empirical v1 (`ai/`)

```bash
empirical adopt
```

Adoption reads `ai/STATE.md`, copies the current spec when available, writes
schema-4 configuration and feature-local state, and leaves `ai/` untouched.

## Earlier npm alpha schemas

```bash
empirical migrate
```

Schema-1, schema-2, and schema-3 default state at `.empirical/state.json` and
its root journal are normalized and copied to:

```text
.empirical/specs/<existing-feature>/state.json
.empirical/specs/<existing-feature>/events/
```

Only after every destination write succeeds are the old projection, lock, and
journal removed. The migration is idempotent, rejects symbolic links and
conflicting newer history, and does not let terminal idle/done state reserve the
checkout.

Earlier alternate named parallel-state directories are intentionally
unsupported and are not combined with current history. If you need to inspect
that data, use the package version that created it before upgrading. Empirical
0.20 removes its commands, flags, packet fields, API types, and MCP tool rather
than pretending to migrate ambiguous concurrent histories.

## Version reset

The canonical alpha release is `0.20.0`. It is intentionally breaking. Public
2.x versions are removed from npm only after 0.20.0 is published, installed in
an empty consumer, and verified as `latest`. Removed npm versions cannot be
reused.
