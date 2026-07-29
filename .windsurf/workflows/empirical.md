<!-- empirical-sdd:managed-file -->
# Empirical

Start or resume the repository's Empirical workflow for the current request.

1. Use the current Cascade agent; never launch another AI runtime.
2. Explore vague problems with `empirical_explore` or
   `empirical explore "<problem>"` before starting workflow state.
3. For concrete work, choose Fast only for explicit, tiny, localized, reversible,
   low-risk non-UI changes and Complex otherwise.
4. Start with `empirical_fast` or `empirical_complex`; fall back to
   `empirical fast "<request>"` or `empirical complex "<request>"`.
5. Resume active work with `empirical_loop` or `empirical loop`.
6. Preserve its workstream, execute the action, and complete its exact revision with all required
   evidence.
7. Archive validated capability deltas after Review and consume every response.
8. Stop only at Done, Blocked, or awaiting human input.

Never select legacy Quick for new work or add profile/JSON controls to the
normal workflow.
