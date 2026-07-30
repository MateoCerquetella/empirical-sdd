# Migration to Empirical 0.20

## Empirical v1 (`ai/`)

Invoke an installed Empirical skill in the repository. Adoption reads
`ai/STATE.md`, copies the current spec when available, writes
schema-4 configuration and feature-local state, and leaves `ai/` untouched.

## Earlier npm alpha schemas

Invoke `$empirical-init` (or the equivalent native Init skill) after upgrading.
It removes only marker-owned stale local skills, repairs partial schema-4 setup,
and then normalizes schema-1, schema-2, or schema-3 default state at
`.empirical/state.json` with its root journal into:

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

The canonical alpha line is `0.20.x` and is intentionally breaking while the
workflow stabilizes. Removed npm versions cannot be reused.
