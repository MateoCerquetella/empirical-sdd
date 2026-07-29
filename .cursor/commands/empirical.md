<!-- empirical-sdd:managed-file -->
# Empirical

Run the request attached to this command through the repository's Empirical
workflow. If there is no new request, resume the active feature.

Use the current Cursor agent. For new work, choose Fast only for explicit, tiny,
localized, reversible, low-risk non-UI changes and Complex otherwise. Start with
`empirical_fast` or `empirical_complex`; fall back to
`empirical fast "<request>"` or `empirical complex "<request>"`. Resume active
work with `empirical_loop` or `empirical loop`. Execute each returned action,
complete its exact revision with required evidence, and consume the completion
response directly as the next action. Never select legacy Quick for new work,
add profile/JSON controls, or launch another AI runtime.
