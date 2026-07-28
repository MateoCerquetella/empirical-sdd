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
- defaults to Strong for safety; and
- installs the same project discovery used by new Empirical repositories.

Use `empirical adopt --profile quick` when the active work is deliberately
small and understood.
