# Migration to Empirical 0.22

## Schema 4 → Schema 5

Empirical 0.22 supports one breaking, atomic migration from Schema 4. Invoke an
installed Empirical skill after upgrading. The migrator performs a read-only
preflight, rejects symbolic links and mixed/conflicting layouts, builds a
complete candidate tree, validates every transformed document and journal, and
only then promotes the candidate.

The transform creates strict Schema-5 feature state, Policy v2, Manifest v2,
impact manifests, completion state, hash-chained journals, and a compact
migration receipt. Legacy `archive` state becomes `integrate`; it is not marked
integrated without a new independent integration receipt. The previous layout
is retained in the transaction backup until promotion and recovery complete.
An interruption is either rolled forward from its verified transaction marker
or restored without leaving mixed versions.

Top-level `.empirical.schema5-*` stages/markers and
`.empirical.schema4-backup-*` directories are reserved migration transaction
state, not product source. A candidate failure before marker creation removes
only the exact stage created by that attempt. Doctor reports any unmarked orphan
read-only; inspect it before moving or removing it manually.

Schema 5 does not maintain a permissive compatibility reader. A project that
contains Schema-5 configuration plus legacy root state, legacy events, or
Schema-4 feature projections fails closed with a migration conflict.

## Earlier npm alpha schemas

Schemas 1–3 are not directly accepted by 0.22. First use the Empirical version
that created the repository to migrate it to Schema 4, verify that state, and
then upgrade to 0.22. Alternate historical parallel-state directories remain
unsupported because their histories cannot be assigned safely.

## Empirical v1 (`ai/`)

Use the existing non-destructive adoption operation before the Schema-5
migration. Adoption reads `ai/STATE.md`, copies an available current spec, and
leaves `ai/` untouched. Verify the resulting Schema-4 repository, then upgrade
to 0.22 and run the atomic migration.

## Operational checks

Run Doctor before and after migration. Doctor is read-only: it reports whether
migration is required and validates the final schema, journal chain, policy,
knowledge, receipts, claims, locks, worktrees, tools, and delivery artifacts.
Migration scratch is excluded from knowledge fingerprints, evidence tree
digests, and integration source overlays. Do not manually combine old and new
state trees.
