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
agent integrations into a developer's home directory.
