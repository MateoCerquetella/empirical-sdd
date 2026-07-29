# Separate The Pure Execution Loop From The

## Request

> Separate the pure execution loop from the Fast and Complex SDD starters, keep Quick only for backward compatibility, and make ordinary agent prompts choose the SDD workflow automatically

## Goal

Expose Fast and Complex as the two SDD workflows, while keeping Loop as a pure
resume/continue mechanism. Developers give the agent a normal request; the
agent chooses the workflow once and drives the loop without user-facing flags.

## Acceptance Criteria

- [ ] [AC-1] `empirical fast "<request>"`, `EmpiricalProject.fast`, and `empirical_fast` start the one-pass Fast SDD workflow with generated acceptance criteria and combined test/review evidence gates.
- [ ] [AC-2] `empirical complex "<request>"`, `EmpiricalProject.complex`, and `empirical_complex` start the full Specify, Design, Plan, Implement, Verify, Review workflow.
- [ ] [AC-3] `empirical loop`, `EmpiricalProject.loop`, and `empirical_loop` accept no request or profile and only return the current resumable action; they never select an SDD workflow or start new work.
- [ ] [AC-4] Generated repository guidance and native skills/commands activate on an ordinary coding request, choose Fast only for an obviously tiny low-risk non-UI change and Complex otherwise, then continue completion responses until a terminal state.
- [ ] [AC-5] Normal developer and generated-agent instructions require neither `--profile` nor `--json`; those switches and `empirical start` remain compatibility/advanced interfaces rather than the primary UX.
- [ ] [AC-6] Existing Quick projects and action packets remain readable and resumable, but Quick is not offered as a new public workflow in normal help, demos, or generated guidance.
- [ ] [AC-7] Unit, MCP, built Node CLI, integration, concurrency, schema, and npm package checks pass for the corrected separation.

## Scope

- Add first-class Fast and Complex starters to CLI, MCP, and JavaScript.
- Make Loop a zero-argument read/resume operation.
- Update automatic project integrations, CLI rendering/help, tests, and docs.
- Preserve legacy Quick state and the low-level start syntax without offering a legacy new-work workflow.

## Non-goals

- Launching or embedding an AI runtime from the CLI.
- Using network/model classification inside the library.
- Rewriting or deleting existing Quick history.
- Requiring a lifecycle hook or mandatory MCP server.

## Risks

- Older locally generated instructions may keep invoking the former loop shape
  until `empirical integrate` refreshes them and the agent is restarted.
- The automatic agent must choose Complex whenever Fast eligibility is unclear.
- Existing Quick and legacy Strong state must resume safely while all new work
  uses Fast or Complex.

## Verification

- Exercise Fast and Complex through core, CLI, and MCP entrypoints.
- Prove Loop cannot start or classify a request and resumes every legacy state.
- Inspect every generated integration for the flag-free two-workflow contract.
- Run the complete CI and npm package smoke pipeline.
