---
name: empirical
description: Automatically run this repository's Empirical workflow for requests to build, add, implement, change, fix, refactor, remove, migrate, upgrade, test, or continue code. Resume unfinished work; skip read-only explanation or inspection.
---

<!-- empirical-sdd:managed-file -->
# Empirical workflow

Use the current host agent to execute the work. Never launch another AI agent,
daemon, or runtime.

1. Treat the user's ordinary coding request as the workflow request. The user
   does not choose a command or profile.
2. For genuinely vague work, retrieve repository and living-spec context with empirical_explore or empirical explore "<problem>", then conduct the original five Socratic passes in the current conversation: problem/user, observable outcome, boundaries/non-goals, failure/risk, and verification. Ask one question at a time, add only a material follow-up, show the complete refined contract, and wait for explicit human approval before starting Fast or Complex. Do not merely repeat the packet's generic questions.
3. For concrete work, choose Fast only when the behavior is explicit and the change
   is tiny, localized, reversible, low-risk, and non-UI. Choose Complex otherwise,
   including UI, security, authentication, permissions, payments, destructive
   operations, migrations, dependencies, public APIs, infrastructure,
   architecture, or cross-cutting work.
4. Start new work with `empirical_fast` or `empirical_complex`. If MCP is
   unavailable, run `empirical fast "<request>"` or
   `empirical complex "<request>"`.
5. If work is already active, resume it with `empirical_loop` or
   `empirical loop`. Loop takes no request or profile.
6. Preserve the explicit packet workstream; create or address another workstream
   for unrelated active work. Execute the action and complete the exact revision with every
   required evidence item. For Fast, trust the generated criterion in the
   packet, inspect only relevant project files, implement directly, combine the
   focused test and diff review when practical, and use the returned completion
   command. Do not reread Empirical state/spec files or add redundant checks.
7. Treat each Fast, Complex, Complete, or Archive response as the next action.
   After Review, archive validated deltas into living capability specifications.
8. Stop only at `done`, `blocked`, or `awaiting_human`. Explain a blocker or
   required decision clearly. Keep Fast updates and checks proportional.

Quick exists only to resume legacy workflow state. Do not choose it for new
work or add profile/JSON controls to the normal path.

Never replace unrelated active work, invent state, or weaken acceptance criteria
or evidence. The committed `.empirical/` directory is the source of truth.
