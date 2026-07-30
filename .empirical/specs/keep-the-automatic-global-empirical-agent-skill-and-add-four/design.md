# Design: Automatic and Explicit Agent Skills

## Overview

Empirical will expose one managed catalog of five global agent skills while
retaining a two-command public terminal CLI. The catalog separates intent from
the internal state machine:

| Skill | User intent | State mutation | Stop condition |
| --- | --- | --- | --- |
| `empirical` | Let Empirical choose and run the workflow | Setup, route, and complete | Done, Blocked, or Awaiting Human |
| `empirical-init` | Set up or repair this repository | Configuration, bridges, and context only | Setup is complete and context is current |
| `empirical-spec` | Turn a concrete request into a reviewable SDD contract | Start Complex and write Specify artifacts | Specify remains waiting for approval |
| `empirical-socratic` | Clarify an idea before writing its SDD contract | Save discovery, start Complex after approval, write Specify artifacts | Specify remains waiting for approval |
| `empirical-loop` | Continue the selected contract | Complete exact revisions and archive deltas | Done, Blocked, or Awaiting Human |

Fast and Complex remain internal routing profiles. Installation and update
remain the only public shell lifecycle operations.

## Generated skill catalog

`src/integrations.ts` will replace `SINGLE_AGENT_SKILL` with an exported,
ordered `EMPIRICAL_AGENT_SKILLS` catalog. Each entry contains the stable name,
description, and generated Markdown body. Common invariants are rendered into
every body: current host agent only, MCP first, private CLI fallback only,
repository evidence over assumptions, no private reasoning or credentials, and
no human instructions to run hidden verbs.

The automatic skill retains current routing and adds a setup preflight:

1. Inspect `.empirical/config.json` and context state.
2. If absent or partial, run the same setup/repair contract as Init.
3. Resume selected work before considering attached text as a new request.
4. Discover only genuine ambiguity; otherwise route internally.
5. Execute returned actions through terminal workflow state.

The explicit skills each state their input, forbidden behavior, durable output,
and next valid skill. Spec and Socratic deliberately do not submit the pending
Specify completion. Invoking Loop after reviewing their draft is the user's
explicit continuation approval.

## Installation and reconciliation

Global installation iterates the five-entry catalog beneath each selected
agent's existing native skill root. Invocation strings are derived from the
agent's canonical invocation style by replacing the `empirical` basename, so
reports list five accurate invocations in catalog order.

Current names are:

```text
empirical
empirical-init
empirical-spec
empirical-socratic
empirical-loop
```

Legacy names are only `empirical-explore`, `empirical-fast`, and
`empirical-complex`. Selection writes every current marker-owned file,
deselection removes every current marker-owned file, and all runs remove only
marker-owned legacy files. Managed-target detection considers both sets so an
old installation remains selectable during upgrade.

Project integration cleanup enumerates the same current and legacy names for
all historical local extension locations. Existing marker and path-containment
checks remain authoritative; unmanaged files, symbolic links, non-files, and
unrelated configuration are preserved and reported.

## Initialization and partial-project repair

`EmpiricalProject.initialize` currently migrates and refreshes an existing
store but ignores supplied configuration. The existing-store path will:

1. reconcile project integrations unless disabled;
2. migrate the store;
3. create the active/base project instance;
4. call `configure` only when the caller explicitly supplied isolation,
   decision, or `setupComplete` values;
5. refresh repository knowledge; and
6. return the resulting state and reports.

Merging remains field-wise through the existing `configure` contract, so
unspecified stored choices survive. Repeating identical input converges. Init's
skill contract inspects the repository before asking questions, uses safe
defaults for immaterial choices, passes explicit values to `empirical_init`,
refreshes context, verifies `setupComplete: true`, and stops without calling a
start operation.

## Durable agent-native Socratic discovery

The existing discovery model and rendering remain canonical. A new
`empirical_discovery` MCP operation and matching private
`empirical __internal discovery --input <json>` fallback accept:

```ts
interface DiscoverySubmission {
  id?: string;
  problem: string;
  answers: SocraticAnswer[];
  approved?: true;
}
```

Without `approved`, the operation creates or updates one draft record and
returns its ID, paths, and exactly one next pass or material follow-up. The
Socratic skill begins with an empty draft and calls it after each response,
preserving progress and letting the engine drive one question at a time.
Validation requires answers to be a prefix of the canonical five pass order,
with unique passes and non-empty questions, answers, and complete follow-up
pairs; unnecessary or skipped material follow-ups are rejected.

With `approved: true`, validation requires all five passes. Empirical derives
the refined request with `buildRefinedRequest`, persists the approved record,
and starts internal Complex with that exact text. If startup returns an action,
the record becomes `started` with feature and revision. If it returns a
worktree proposal or throws, the approved record remains durable but is not
falsely marked started. Repeating a started submission returns the selected
action without creating another feature.

The tool returns the record, portable paths, refined request when available,
and optional start result. MCP input schemas validate shape; domain validation
and persistence live below adapters so TypeScript and private CLI behavior
match.

## Workflow interactions

### Concrete Spec

Spec preflights initialization, refuses to overwrite unrelated active work,
calls `empirical_complex` with the exact request, inspects relevant source and
living specifications, and writes `spec.md` plus capability deltas. It then
summarizes acceptance criteria and explicitly says Specify is awaiting review.
It does not call Complete.

### Socratic Spec

Socratic preflights initialization, retrieves the read-only Explore packet,
asks the five canonical questions one at a time, saves after every answer,
shows the complete refined request, and waits for approval. After approval it
uses `empirical_discovery` to bind the exact Complex request, drafts the same
Specify artifacts as Spec, and stops for specification approval.

### Loop

Loop calls `empirical_loop` with only the repository root. If idle, it reports
the three valid starting choices and makes no state. Otherwise it executes the
returned action, submits the exact revision and evidence, consumes each response
as the next action, and archives validated deltas. It never routes invocation
text as a new request.

## Interfaces and compatibility

- Public shell commands remain `install` and `update`; direct `init`, `spec`,
  `socratic`, and `loop` stay rejected.
- MCP gains `empirical_discovery`; existing tools remain compatible.
- The private CLI gains `discovery --input`, reachable only below
  `__internal`, for generated-skill fallback and tests.
- TypeScript exports add discovery submission/result types and catalog metadata
  where useful; no schema-version bump is required because stored discovery
  and project formats do not change.
- Installer human wording changes from one entrypoint to five skills. Update
  continues to execute the newly installed `empirical install --yes` process.

## Failure handling and safety

- Invalid or out-of-order discovery input fails before feature creation.
- An unknown discovery ID, changed problem, or mutation of a started record is
  rejected with stable `EmpiricalError` codes.
- Approved discovery is saved before Complex startup so an isolation proposal
  or interrupted start is recoverable.
- Global and local integration writes retain marker ownership, symlink refusal,
  root containment, atomic file replacement, and unmanaged preservation.
- Explicit skills do not launch an external agent. Existing approval-bound
  handoff remains available only at its current workflow gate.

## Documentation and verification

README will introduce the two modes, list all five native invocations, show Init,
concrete Spec, Socratic Spec, automatic, and Loop examples, and clearly state
that none are terminal commands. Architecture, conventions, and MCP listings
will remove the obsolete one-skill assumption.

Focused tests will cover catalog content and frontmatter, every agent's five
invocations, install/deselect/legacy cleanup/idempotence, partial initialization,
project-local shadow cleanup, draft/approve/invalid discovery, private CLI and
MCP parity, idle Loop guidance, public CLI rejection, distribution smoke, and
clean packed installation. The final gate is `bun run ci` plus package and diff
inspection.
