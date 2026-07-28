# Empirical continuation prompt

Use this prompt with any coding agent, IDE, terminal, or CI host:

```text
Continue the active Empirical feature from repository state.

1. Run `empirical next --json`.
2. Read the matching role and procedure under `ai/`.
3. Perform exactly the returned phase and preserve unrelated work.
4. Return a versioned phase-result envelope at the observed revision.
5. Continue automatically while policy allows it.

Never weaken an acceptance criterion or evidence policy to obtain a pass. For
UI criteria, use an available real browser, capture a screenshot, inspect it,
and bind both the browser assertion and visual review to that criterion. Stop
at Done, Blocked, delivery-ready, a missing required capability, or a genuinely
necessary human decision.
```
