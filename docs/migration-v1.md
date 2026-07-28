# Migrating from Empirical v1

Migration is an adoption, not a rewrite.

## Before adoption

Commit or back up your working tree as you normally would. `empirical status` may be
run first; discovery does not modify the repository. Confirm that the active
spec referenced by `ai/STATE.md` has a `spec.md` with an Acceptance Criteria
section.

## Adopt

```bash
empirical --root /path/to/repository adopt
```

The command:

- reads legacy state and role names;
- defaults the repository to Strong;
- adds `ai/empirical.toml`;
- adds `ai/events/` and an adoption event;
- writes versioned frontmatter to `ai/STATE.md`; and
- appends the original state content in a preserved-history section.

That preserved section survives later phase transitions. An untouched v1
starter whose header still contains `<none | ...>` choice placeholders is
recognized as an idle repository.

It does not delete, rename, or replace user-authored specs, context, roles,
skills, contracts, or orchestration notes.

After adoption, `empirical upgrade` can install missing neutral playbooks. Existing v1
playbooks that differ from the distribution are registered as project-owned
compatibility overrides and are never overwritten. Existing files already
matching the distribution become safely managed; missing files are added.

To choose the shorter profile explicitly:

```bash
empirical adopt --profile quick
```

## Stable mappings

| v1 value | v2 phase |
|---|---|
| analyst, pm, specification | Specify (or Shape in Quick) |
| architect, architecture | Design (or Shape in Quick) |
| planning | Plan (or Shape in Quick) |
| developer, dev | Implement |
| tester, test, qa | Verify |
| reviewer, review | Review |
| completed, ready | Done |

The rendered state continues to include a legacy-compatible status block so
older agents can find `current_spec`, `current_role`, `current_phase`, and
`mode`. Existing `tasks.md` files remain valid compatibility checklists; Strong
features additionally use typed `plan.json` for machine validation.

## Rollback

Adoption is additive, but it does rewrite `ai/STATE.md` to add canonical
frontmatter. The prior body remains inside that file. If you must return to a
pure v1 checkout, use your version-control history to revert the adoption
changes; do not delete unrelated `ai/` content.
