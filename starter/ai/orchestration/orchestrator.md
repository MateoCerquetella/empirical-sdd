# Orchestrator

1. Read `ai/STATE.md`, `ai/empirical.toml`, current spec, and only the context needed
   for the active phase.
2. Compare the expected revision before every transition.
3. Use Quick for a narrow, understood change; use Strong when design risk,
   ambiguity, migration, or broad impact warrants it.
4. Invoke a capable phase adapter or let an external client check in a typed
   result.
5. Bind evidence to current acceptance criteria, spec revision, and workspace
   hash.
6. Continue until Done, Blocked, or Awaiting Human. Do not invent approval.
