---
name: empirical-spec
description: Create or refine an Empirical SDD feature specification with testable acceptance criteria and select Quick or Strong. Use when a user asks to define, scope, plan, or start a feature.
---

# Create an Empirical spec

1. Read `ai/context/` and the user's request.
2. Choose Quick for a small, understood, reversible change. Choose Strong for
   ambiguity, broad impact, migration, security risk, or a durable contract.
3. Run `empirical new <numbered-id> --profile <quick|strong>`.
4. Replace every placeholder in the new `spec.md` with the problem, goal,
   numbered observable acceptance criteria, scope, non-goals, risks, and
   verification wiring.
5. Mark visual criteria `[UI]`; do not mark backend behavior as UI.
6. Run `empirical next --json` and summarize the selected profile and phase.
