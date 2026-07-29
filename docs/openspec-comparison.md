# Empirical 0.20 compared with OpenSpec

Empirical adopts OpenSpec's strongest idea: repository-native change contracts
and explicit deltas from current behavior. It adds an executable state machine,
evidence gates, Socratic discovery, safe isolation, and living-spec projection.

| Capability | OpenSpec | Empirical 0.20 |
|---|---|---|
| Change contract | Proposal/spec/design/tasks artifacts | Spec/design/plan plus observable criteria |
| Behavior change | ADDED/MODIFIED/REMOVED deltas | Same delta vocabulary with archive projection |
| Discovery | User/agent decides context process | Persisted five-pass Socratic interview and approval |
| Execution | Agent follows tasks | Exact revisioned Fast or seven-gate Complex state machine |
| Verification | Defined by the change | Criterion-scoped test/browser/screenshot/review evidence |
| Decisions | Design narrative | Validated evidence/options/choice/risks/verification record |
| Explanation | Read the artifacts | Deterministic Explain report with context gaps and gate |
| Parallel code | Multiple change directories | One feature per checkout plus approved Git worktrees |
| Current behavior | Specs remain repository artifacts | Reviewed deltas transactionally update living capabilities |
| Agent support | Tool-specific integrations vary | CLI, TypeScript, MCP, and native skills for five agents |

## Where Empirical is stronger

- A vague request cannot quietly become an implementation: the current agent
  asks problem/user, outcome, boundaries, risk, and verification one at a time,
  then waits for approval.
- Every mutation has an exact revision and recoverable event journal.
- Complex Design cannot pass with empty decision ceremony; evidence, alternatives,
  trade-offs, and verification are mechanically required.
- UI criteria require real-browser and screenshot evidence.
- An unrelated active request becomes a complete read-only Git proposal and an
  explicit approval gate, not a second hidden state namespace.
- Archive validates the frozen delta digest and applies current-behavior changes
  transactionally.

## Where OpenSpec remains simpler

OpenSpec is ideal when a team wants a lightweight artifact convention without a
runtime state machine, evidence protocol, or Git automation. Empirical has more
guardrails and therefore more structure. Fast keeps that cost proportional for
truly tiny work.

## Scorecard

For repository-native spec quality, Empirical and OpenSpec use the same proven
core concepts. Empirical's additional Socratic, execution, verification,
decision, and isolation contracts make it better suited to autonomous coding
agents that must continue safely across sessions. Teams wanting documentation
only may prefer OpenSpec's smaller surface.
