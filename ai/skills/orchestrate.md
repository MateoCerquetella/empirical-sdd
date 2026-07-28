# Orchestrate

Read the repository state, choose the active profile sequence, invoke one phase
at a time, validate its result envelope, and keep advancing while automatic
continuation is enabled. Recover from repository events after interruption.
Stop only for Done, Blocked, Awaiting Human, or a missing required adapter.
