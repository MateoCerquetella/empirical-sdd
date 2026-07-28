---
name: empirical-loop
description: Autonomously continue an Empirical SDD feature across its remaining phases until Done, Blocked, delivery-ready, or a necessary human decision. Use when a user asks to keep going, finish, loop, or run autonomously.
---

# Run the Empirical loop

Repeatedly follow the `empirical-next` procedure using fresh repository state.
Continue automatically across Quick or Strong phases. On Verify or Review
failure, apply the bounded repair route recorded by the engine and retry. Stop
only at Done, Blocked, delivery-ready, missing required capability, or a human
decision that cannot safely be inferred.

Do not weaken evidence to make the loop pass. For `[UI]` criteria, use an
available real-browser or browser MCP capability, save screenshots under the
current spec, inspect them visually, and bind both browser and screenshot-review
records to the criterion. Code review must be independent when configured.

Delivery requires repository configuration and separate caller authority.
If a workflow exhausted its bounded repair budget, resolve the reported cause
before running `empirical retry --expected-revision <revision>` and continuing.
