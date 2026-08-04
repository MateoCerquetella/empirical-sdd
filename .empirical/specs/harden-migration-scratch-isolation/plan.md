# Plan: Migration Scratch Isolation

1. Add candidate cleanup around pre-marker transform/validation and a regression
   containing supported historical Schema-3 events plus one invalid candidate.
2. Exclude top-level `.empirical.schema5-*` paths from knowledge inventories,
   evidence tree hashing, and source overlay selection; prove ordinary files are
   still observed.
3. Add read-only Doctor orphan-stage/backup diagnostics and minimal-environment
   snapshot coverage.
4. Run focused checks, refresh Manifest v2, and execute fresh full-CI Verify and
   Review receipts.
5. Replay the four capability deltas against a detached target, validate there,
   promote living specs, compact the journal, and rerun Doctor.
