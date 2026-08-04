# Plan: Safe Empirical Uninstall

1. Add `uninstallGlobalAgentSkills` using the installer catalog's unique roots,
   existing managed-file removal guard, and owner-validated selection metadata;
   cover shared roots, unmanaged files, unsafe paths, invalid metadata,
   idempotence, and project-artifact snapshots.
2. Add an injectable package-uninstall lifecycle that invokes exact platform npm
   argv after integration cleanup and reports stage-specific failures.
3. Add the public CLI route, help, fail-closed confirmation, `--yes`/`-y`, JSON
   report, human outcome rendering, and private-command rejection guidance.
4. Update root help, README, demo, architecture/context wording, bundled smoke,
   and clean-package checks, including a previous-versus-new behavior table.
5. Run focused type/tests, refresh Manifest v2, issue independent full-CI Verify
   and Review receipts, replay the capability delta against a detached target,
   compact terminal history, and run Doctor without external delivery.
