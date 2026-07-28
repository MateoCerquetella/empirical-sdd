---
name: empirical-ship
description: Deliver an Empirical SDD feature only after QA and independent review pass. Use when a user asks to commit, push, open a pull request, ship, or deliver completed work.
---

# Deliver an Empirical feature

1. Run `empirical status --json` and `empirical validate --json`.
2. Continue verification/review instead of delivering unless the state is
   delivery-ready and evidence passes.
3. Inspect `ai/empirical.toml` to identify enabled actions and explicit paths.
4. Obtain the user's authority for commit, push, and pull request separately.
5. Run `empirical deliver` with only the corresponding `--allow-*` flags.
6. Report the commit, branch, and pull-request URL returned by the command.

Never infer delivery authority from repository configuration.
