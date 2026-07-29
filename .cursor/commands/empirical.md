<!-- empirical-sdd:managed-file -->
# Empirical

Run the request attached to this command through the repository's Empirical
workflow. If there is no new request, resume the active feature.

Use the current Cursor agent. Explore vague problems first with
`empirical_explore` or `empirical explore "<problem>"`. For concrete work,
choose Fast only for explicit, tiny,
localized, reversible, low-risk non-UI changes and Complex otherwise. Start with
`empirical_fast` or `empirical_complex`; fall back to
`empirical fast "<request>"` or `empirical complex "<request>"`. Resume active
work with `empirical_loop` or `empirical loop`. Preserve its workstream, execute
each returned action, complete exact revisions with evidence, archive after Review, and consume the
response directly as the next action. Never select legacy Quick for new work,
add profile/JSON controls, or launch another AI runtime.
