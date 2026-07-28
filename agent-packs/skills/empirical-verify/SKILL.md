---
name: empirical-verify
description: Produce and review criterion-bound Empirical SDD test and UI evidence. Use when a user asks to test, QA, verify, inspect screenshots, or prove a feature is complete.
---

# Verify Empirical acceptance criteria

1. Run `empirical next --json`; retain its spec revision and every acceptance
   criterion.
2. Run the smallest reliable test set, recording the exact argument vector,
   exit code, bounded output hash, producer, and covered criterion IDs.
3. For each `[UI]` criterion, drive the real flow with an available browser or
   browser MCP, assert the result, save a screenshot under the spec's evidence
   directory, and inspect the screenshot against the criterion.
4. Re-run `empirical next --json` after the checks and use its current
   `workspaceHash` in every record. Produce separate browser-assertion and
   screenshot-review records with artifact hashes and reviewer identity.
5. Run `empirical validate --json`. Missing proof is a failure, not a pass.
