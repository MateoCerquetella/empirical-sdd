# Empirical and OpenSpec

Empirical uses OpenSpec's strongest product ideas where they improve the actual
development loop, while retaining a different center of gravity.

OpenSpec is excellent at change-centered planning: Explore, a proposal/design/task
artifact graph, requirement deltas, living specifications, and archive. Empirical
is an execution protocol: automatic request routing, resumable exact revisions,
mandatory test/browser/review evidence, repair loops, and the same behavior over
CLI, MCP, and TypeScript.

## At a glance

| Product quality | OpenSpec strength | Empirical 2.2 adaptation |
|---|---|---|
| Vague-problem discovery | Explore before formalizing a change | Persisted five-pass terminal interview plus pure agent/API packets |
| Proposed behavior | Delta specs grouped by capability | OpenSpec-compatible ADDED/MODIFIED/REMOVED requirement subset with scenarios |
| Current behavior | Living specs after archive | Canonical `.empirical/capabilities/<name>/spec.md` contracts |
| Safe completion | Archive closes a planned change | Review must pass first; Archive is exact-revisioned, atomic, rollback-capable, and idempotent |
| Parallel change work | Multiple change directories | Independent named workstream state, journals, revisions, packet binding, and shared-resource locks |
| Project customization | Project context and artifact rules | Committed policy context plus additive per-phase guidance that cannot disable gates |
| Agent ergonomics | Slash-command workflow | Ordinary requests still activate Empirical automatically; CLI commands remain fallbacks |
| Execution assurance | Primarily planning and specification | Acceptance criteria, real evidence, UI browser/screenshots, review, retry, stale-client rejection |
| Portability | Node-based CLI and agent integrations | One npm package; Node 20 runtime; no Rust, daemon, database, API key, or OpenSpec runtime dependency |

## What Empirical intentionally adopted

### Explore without ceremony

`empirical explore "<problem>"` now conducts the original persisted five-pass
Socratic interview in an interactive terminal, requires approval, and hands the
refined request directly to Fast or Complex. Agent/API automation retains a pure
context packet, and generated skills conduct the same one-question-at-a-time
interview in the existing host conversation.

### Deltas plus living behavioral truth

Complex Specify records only the proposed requirement changes. After implementation,
evidence, and review, Archive projects them onto current capability specs. A future
agent can read what the product does now without reconstructing every historical
feature document.

### Parallelism with identity

Change directories alone do not prevent two active agents from racing on workflow
state. Empirical therefore adds independently revisioned workstreams and includes
the workstream in every action and completion. Selection is only a human shortcut;
issued packets remain bound to their original workstream.

### Useful customization with hard boundaries

Project context belongs in the repository, close to the work. Policy can add domain
facts and phase guidance, but it cannot redefine the workflow or turn off safety,
evidence, review, delta, or archive validation.

## What Empirical intentionally did not adopt

- OpenSpec is not a package dependency or subprocess in normal Empirical use.
- Users do not need to learn an artifact command graph for ordinary coding requests.
- Fast stays a one-revision lane for truly tiny work; it does not require delta files.
- Complex retains enforced implementation, verification, review, and repair phases.
- Empirical does not embed or choose an AI runtime, host a dashboard, or automate Git delivery; an approved terminal interview can explicitly launch installed Codex when requested.

## Practical verdict

For specification-first exploration and manually directed planning, OpenSpec remains
the more specialized tool. For a repository-wide, agent-neutral workflow that must
carry a change through implementation and prove the result, Empirical is now the
more complete execution system. The combination closes Empirical's previous biggest
gap—durable current-behavior knowledge—without sacrificing its strongest advantage:
observable, resumable enforcement.

The OpenSpec artifacts used to design this release are committed under
`openspec/changes/evolve-empirical-living-specs/` and validate strictly. They are
development evidence, not shipped runtime code.
