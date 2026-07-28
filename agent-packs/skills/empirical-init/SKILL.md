---
name: empirical-init
description: Initialize Empirical SDD in a new repository or non-destructively adopt an existing Empirical v1 ai/ workspace. Use when a user asks to set up, install, initialize, migrate, or adopt Empirical SDD.
---

# Initialize Empirical

1. Find the repository root.
2. If `ai/STATE.md` exists, run `empirical status --json` and use
   `empirical adopt` only when it reports a v1 repository.
3. Otherwise run `empirical init`, choosing Quick for narrow understood work
   and Strong only when the project requires the full default.
4. Ask the user to fill missing `ai/context/` facts that materially affect
   implementation. Do not invent them.
5. Run `empirical doctor --json` and report the resulting repository state.

Never create a host-specific directory or IDE database as workflow authority.
