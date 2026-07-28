---
name: empirical-status
description: Report the current Empirical SDD spec, profile, phase, revision, evidence state, and next stop condition without changing work. Use when a user asks for status, progress, health, or what remains.
---

# Report Empirical status

Run `empirical status --json`, `empirical next --json`, and `empirical doctor
--json`. Summarize the current spec, Quick or Strong profile, phase, workflow
status, revision, required capabilities, adapter availability, and repository-kit
version. If evidence can be evaluated, run `empirical validate --json` and name
missing proof. Do not mutate the workflow.
