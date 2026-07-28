---
name: empirical-next
description: Inspect and advance exactly one Empirical SDD phase using repository state and a typed result envelope. Use when a user asks what is next or asks to continue one step.
---

# Advance one phase

1. Run `empirical next --json` and use the returned revision, workspace hash,
   phase, criteria, and required capabilities.
2. Read the matching neutral role and skill in `ai/roles/` and `ai/skills/`.
3. Perform only that phase. Preserve unrelated work.
4. For Verify, run tests and use a real browser when UI criteria require it;
   capture and inspect screenshots.
5. Write a phase-result envelope matching `schemas/phase-result.schema.json` or
   the installed protocol documentation.
6. Run `empirical check-in --expected-revision <revision> --result <file>`.
7. Report the new state. Do not continue a second phase unless asked.
