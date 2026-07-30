# Decisions: Keep The Automatic Global Empirical Agent Skill And Add Four

Record concise, externally reviewable evidence and choices here. Do not store
private chain-of-thought, prompts, credentials, secrets, or scratchpad text.

## D-001: Expose one automatic and four explicit skills

Status: Accepted

### Evidence

- Version 0.20.1 installs one automatic skill and retains the complete internal
  state machine behind MCP/private CLI operations.
- The user wants the automatic experience preserved and also wants deliberate
  Init, direct Spec, Socratic Spec, and Loop entrypoints comparable to v1.
- Separate Fast and Complex entrypoints previously duplicated a routing choice
  that the automatic workflow already makes safely.

### Options

1. Keep only the single automatic skill.
2. Restore every historical Explore, Fast, Complex, and Loop skill.
3. Install the automatic skill plus explicit Init, Spec, Socratic, and Loop
   skills while keeping Fast/Complex internal.

### Chosen approach

Choose option 3. It supports automation and deliberate SDD use without making
users select an implementation profile.

### Trade-offs and risks

Five skills increase documentation and drift risk. Generate them from one
ordered catalog, state disjoint responsibilities, and assert shared invariants
and stop conditions in tests.

### Verification

Install every supported agent in an isolated home and assert exactly the five
current skill names, descriptions, responsibilities, and native invocations.

## D-002: Make specification approval the explicit mode boundary

Status: Accepted

### Evidence

- The automatic skill is valuable precisely because it can execute the whole
  state machine without extra commands.
- A deliberate Spec or Socratic invocation is valuable when a user wants to
  inspect and change the contract before implementation.
- Complex Specify already has required artifacts and an exact completion call,
  so it provides a natural durable pause point.

### Options

1. Let every skill execute end to end.
2. Make Spec and Socratic stop after drafting Specify; let Loop represent
   explicit continuation.
3. Add a second persistent approval phase to the state-machine schema.

### Chosen approach

Choose option 2. Spec and Socratic leave the current Specify revision waiting;
invoking Loop after review authorizes completion and continuation.

### Trade-offs and risks

The waiting revision may appear unfinished. Each explicit skill must clearly
report the artifact paths, pending approval, and next invocation. This avoids a
schema migration and keeps the automatic route unchanged.

### Verification

Generated-skill tests assert that Spec and Socratic prohibit Complete and that
Loop consumes the selected action without accepting a new feature request.

## D-003: Persist Socratic progress through one structured operation

Status: Accepted

### Evidence

- `src/discovery.ts` already owns canonical questions, follow-ups, refined-text
  construction, durable JSON/Markdown records, and safe path validation.
- The old interactive CLI saves each answer, but the current agent skill has no
  operation that can do so and therefore cannot fulfill its persistence claim.
- MCP and private CLI already adapt the same core primitives.

### Options

1. Tell the agent to write discovery files directly.
2. Persist only the final approved interview.
3. Add one structured operation that saves partial answers and, when approved,
   binds the exact refined request to Complex startup.

### Chosen approach

Choose option 3 as `empirical_discovery`, with a private input-file CLI
fallback. It centralizes validation, safe persistence, and exact handoff.

### Trade-offs and risks

The operation is stateful and needs idempotence rules. Require ordered canonical
passes, reject mutations after start, save approval before startup, and mark
`started` only after an action exists.

### Verification

Test progressive saves, complete approval, exact request binding, repeated
submission, invalid order/duplicates/empties, missing IDs, worktree proposal,
MCP parity, and private CLI parity.

## D-004: Reconcile all skill names from one catalog

Status: Accepted

### Evidence

- Marker ownership and path-safety logic already prevents Empirical from
  overwriting unmanaged global or local extensions.
- `barik-enhanced` demonstrated that a marker-owned project-local old skill can
  shadow the corrected global skill.
- The existing obsolete list includes `empirical-loop`, which becomes current
  again in this design.

### Options

1. Leave project-local shadows for users to delete manually.
2. Hard-delete all known paths.
3. Enumerate current and legacy names centrally and reuse safe managed-file
   reconciliation globally and during repository initialization.

### Chosen approach

Choose option 3. Current names are the five catalog entries; legacy names are
Explore, Fast, and Complex only.

### Trade-offs and risks

An unmanaged file with a matching name will continue to shadow a global skill.
That is intentional: preserve and report it rather than deleting user content.

### Verification

Cover marker-owned and unmanaged current/legacy files, symbolic links,
non-files, selected and deselected agents, repeated runs, and local cleanup.

## D-005: Apply only explicit setup values during reinitialization

Status: Accepted

### Evidence

- The existing-store branch of `EmpiricalProject.initialize` ignores all
  supplied configuration options, even `setupComplete: true`.
- A real schema-4 repository remained at `setupComplete: false` with no context
  after global installation, causing confusing first use.
- `EmpiricalProject.configure` already performs field-wise merging.

### Options

1. Keep initialization create-only and require a second configure operation.
2. Reset every existing project to defaults during Init.
3. Apply only explicitly supplied configuration through the existing merge and
   then refresh context.

### Chosen approach

Choose option 3. It repairs partial setup in one operation without overwriting
stored choices the caller did not mention.

### Trade-offs and risks

Callers that explicitly pass values can change policy, which is intended. A
presence check must distinguish omitted values from defaults synthesized by an
adapter.

### Verification

Initialize an existing partial fixture with explicit and omitted values; assert
only explicit fields change, setup completes, context exists, no feature starts,
and a repeated call converges.
