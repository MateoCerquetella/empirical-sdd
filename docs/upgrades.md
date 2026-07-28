# Safe repository-kit updates

Empirical SDD has two installation surfaces:

1. the globally installed CLI/embeddable library; and
2. the small `ai/` kit committed inside each project.

This keeps the engine easy to update while ensuring agents in any environment
can still read the repository's workflow instructions and state.

## Ownership

`ai/empirical.lock` records hashes for distribution-managed files:

- `ai/README.md`;
- contract templates;
- orchestration rules;
- role and skill playbooks; and
- spec templates, v1-compatible prompt helpers, and spec guidance.

The following remain project-owned and are never upgrade targets:

- `ai/context/**`;
- actual feature directories below `ai/specs/`;
- `ai/empirical.toml`;
- `ai/STATE.md` and `ai/events/**`; and
- evidence and screenshots.

## Workflow

```bash
# Update the CLI using your package manager first.
empirical upgrade --check
empirical upgrade
git diff -- ai/
```

An unmodified managed file can be replaced safely because its current hash
matches the installed baseline. A local edit or deliberate deletion becomes a
conflict and is preserved. A new managed file is added when its destination is
free. When the first upgrade finds a pre-existing v1 file with no Empirical
baseline, it records that path as a project-owned compatibility override and
never replaces it. If an override is later made byte-for-byte equal to the
distributed file, it automatically becomes managed. The lock advances to the
new distribution version only when true managed-file conflicts are resolved.

This is intentionally conservative. The library never interprets a newer
template as permission to replace a team's customized instructions.

## Agent command packs

The Empirical distribution ships agent-native command packs from one canonical
command source. The official installer updates every supported agent home
together; users do not enable agents one by one. Every generated command
calls the same `empirical` protocol and may be recreated without workflow-state
loss. No agent-specific directory belongs in the canonical repository kit.
