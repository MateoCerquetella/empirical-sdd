# Migrating from Empirical v1

Run adoption from the existing repository root:

```bash
empirical adopt
```

Adoption:

- leaves `ai/` untouched;
- reads the active v1 spec and phase when available;
- creates the `.empirical/` state and event journal;
- copies the active spec into `.empirical/specs/`;
- defaults to Complex for safety; and
- installs the same project discovery used by new Empirical repositories.

Quick state from an older repository remains readable and resumable through
`empirical loop`, but Quick is not offered for new work. After adoption, the
agent chooses `empirical fast "<request>"` for an explicit, trivial, local,
low-risk non-UI change and `empirical complex "<request>"` for everything else.

Adoption also installs the same repository-local skills and manual command
fallbacks as `empirical init`. It does not install lifecycle hooks or write
agent integrations into a developer's home directory. Global Agent Skills are
a separate opt-in operation that can be run before or after adoption:

```bash
empirical integrate --global
```

## Protocol schema 1 or 2

Repositories already using `.empirical/` do not need adoption. Version 2.2 reads
schema 1 and 2 directly and upgrades them on the next mutation, or explicitly:

```bash
empirical migrate
```

Migration is additive:

- existing `.empirical/state.json` and `.empirical/events/` become the `default`
  workstream without moving;
- specs, evidence, legacy Quick state, and adopted `ai/` content remain unchanged;
- `.empirical/workstreams.json` is created with `default` selected;
- `.empirical/policy.json` is created with empty context and guidance; and
- new living capability specs are added only when reviewed Complex deltas are
  archived.

Older in-flight Complex changes created before capability deltas remain resumable.
New Complex changes require validated deltas and the Archive phase.
