<!-- empirical-sdd:managed-file -->
# Empirical

Start or resume the repository's Empirical workflow for the current request.

1. Use the current Cascade agent; never launch another AI runtime.
2. For new work, choose Fast only for explicit, tiny, localized, reversible,
   low-risk non-UI changes and Complex otherwise.
3. Start with `empirical_fast` or `empirical_complex`; fall back to
   `empirical fast "<request>"` or `empirical complex "<request>"`.
4. Resume active work with `empirical_loop` or `empirical loop`.
5. Execute the returned action and complete its exact revision with all required
   evidence.
6. Consume each completion response directly as the next action.
7. Stop only at Done, Blocked, or awaiting human input.

Never select legacy Quick for new work or add profile/JSON controls to the
normal workflow.
