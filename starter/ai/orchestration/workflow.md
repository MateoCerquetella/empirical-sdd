# Workflow

Quick:

`Shape → Implement → Verify → Review → optional Deliver → Done`

Strong:

`Specify → Design → Plan → Implement → Verify → Review → optional Deliver → Done`

Continue automatically when `loop_policy.auto_continue` is true. Verification
or review failure routes back to implementation. Stop after the configured
repair limit, when a required capability is missing, or when a decision truly
needs a human. Never call a phase complete without its result envelope and
evidence gate.

Missing capabilities are resumable: install or expose the capability and run
the loop again. A Blocked state after exhausted repairs needs an explicit
`empirical retry --expected-revision N` after its cause is resolved.
