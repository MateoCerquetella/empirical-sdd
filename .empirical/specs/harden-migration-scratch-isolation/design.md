# Design: Migration Scratch Isolation

Define one semantic boundary: a top-level path beginning
`.empirical.schema5-` is migration transaction state, never repository source.
Keep small local predicates in modules that cannot safely depend on migration
internals, with parity tests proving the same prefix behavior.

Wrap candidate transformation and validation before marker creation in a cleanup
guard. Once a marker exists, retain the existing roll-forward/rollback recovery
protocol unchanged. Extend Doctor's read-only migration inspection to enumerate
orphan stage and backup directories only when no recovery marker is active.

Evidence and knowledge walkers exclude the prefix in both Git-backed and
filesystem-fallback inventories. The integration overlay filters the prefix at
its top-level status boundary, so no scratch file is copied or restored.
