# Keep The Automatic Global Empirical Agent Skill And Add Four

## Request

> Keep the automatic global empirical agent skill and add four explicit globally installed agent skills: empirical-init for first-run setup or repair and repository context only, empirical-spec for drafting a concrete Complex SDD specification and stopping for approval, empirical-socratic for a five-pass interview that saves and crystallizes an approved specification, and empirical-loop for resuming an active specification through completion. All skills must use MCP first with the private CLI namespace as fallback, install through the existing agent selector, remove stale managed project-local skills during initialization, preserve the public terminal CLI as only Install and Update, update documentation and tests, and do not restore separate Fast or Complex user skills.

## Goal

A developer can choose between one automatic Empirical workflow and explicit
SDD entrypoints without learning internal Fast/Complex state-machine commands.
Installation places all five native skills in each selected agent. The explicit
Init skill establishes or repairs repository context, Spec and Socratic produce
a reviewable contract and stop, and Loop resumes approved work through the
existing evidence-gated state machine.

## Acceptance Criteria

- [ ] [AC-1] `empirical install` writes exactly five marker-owned global skills
  for every selected agent: `empirical`, `empirical-init`, `empirical-spec`,
  `empirical-socratic`, and `empirical-loop`. Repeating the same selection is
  byte-stable, and deselecting an agent removes those managed skills while
  preserving unmanaged files, directories, links, and unrelated settings.
- [ ] [AC-2] Installation safely removes marker-owned legacy
  `empirical-explore`, `empirical-fast`, and `empirical-complex` skills. The
  restored `empirical-loop` name is current rather than obsolete, and
  repository initialization removes any marker-owned project-local copies of
  all current or legacy Empirical skills so they cannot shadow global updates.
- [ ] [AC-3] Installation reports every installed skill with native syntax and
  accurate reload guidance for Codex, Claude Code, Cursor, Gemini CLI, and
  Windsurf. Structured reports expose the same deterministic set.
- [ ] [AC-4] The automatic `empirical` skill remains the default end-to-end
  router: it initializes or repairs the repository first, resumes active work,
  conducts Socratic discovery only for material ambiguity, selects Fast or
  Complex internally, and continues through required gates without asking the
  user to choose an implementation profile.
- [ ] [AC-5] `empirical-init` inspects the repository, asks only material setup
  questions one at a time, applies safe defaults, reconciles a missing or
  partial schema-4 setup, creates or refreshes `.empirical/context/`, and stops
  without creating a feature, specification, or workflow revision.
- [ ] [AC-6] Reinitializing an existing project applies explicitly supplied
  isolation, decision, and setup-complete values instead of silently retaining
  an incomplete configuration. A project with `setupComplete: false`, missing
  context, or stale managed local skills converges to a complete usable setup
  without changing unmanaged content.
- [ ] [AC-7] `empirical-spec` accepts a concrete feature request, ensures setup
  is complete, starts the internal Complex workflow, drafts the Specify
  contract and capability deltas from repository evidence, presents them for
  review, and stops before completing the Specify revision until the user
  explicitly approves. It never exposes Fast/Complex as a user choice.
- [ ] [AC-8] `empirical-socratic` conducts the five discovery passes one
  question at a time—problem and user, observable outcome, boundaries and
  non-goals, risks and failure modes, and verification—asks only material
  follow-ups, persists the answers, presents the refined contract for explicit
  approval, starts Complex Specify from that exact contract, drafts the spec
  and deltas, and stops for specification approval.
- [ ] [AC-9] `empirical-loop` accepts no new feature-routing responsibility. It
  resumes the selected non-terminal workflow, follows each returned action and
  exact revision, records required evidence, and continues until Done, Blocked,
  or Awaiting Human. With no active feature it directs the user to the automatic,
  Spec, or Socratic skill and does not invent workflow state.
- [ ] [AC-10] All five generated skills prefer Empirical MCP operations and use
  only `empirical __internal ...` as a fallback. They never instruct humans to
  run hidden workflow verbs, and the public terminal CLI and README command
  surface remain limited to `empirical install` and `empirical update`.
- [ ] [AC-11] Skill names, descriptions, routing boundaries, stop conditions,
  approval gates, and fallback operations are generated from one catalog and
  validated in isolated homes for every supported agent. The shipped package
  contains no stale one-skill assumptions.
- [ ] [AC-12] Type checking, focused initialization/discovery/integration/CLI
  tests, the full CI suite, built CLI and MCP smoke tests, generated-artifact
  inspection, package dry-run, and a clean-consumer install all pass.

## Scope

- Replace the single generated-skill constant with a five-entry managed skill
  catalog and reconcile selected, deselected, legacy, and project-local targets.
- Author concise agent-native contracts for automatic routing, initialization,
  concrete specification, Socratic specification, and workflow continuation.
- Repair existing-project initialization so explicit setup values take effect
  and compact repository context is refreshed before feature work starts.
- Add a structured MCP/private-operation path for persisting an approved
  five-pass discovery and starting Complex Specify from its exact refined text.
- Update installer reports, README, architecture/protocol documentation, tests,
  package fixtures, and release-facing generated artifacts.

## Non-goals

- Restoring separate public `empirical-fast`, `empirical-complex`, or
  `empirical-explore` skills; Fast and Complex remain internal profiles.
- Re-exposing Init, Spec, Socratic, Loop, Complete, or other workflow verbs as
  normal terminal CLI commands.
- Allowing Spec or Socratic to implement code before specification approval, or
  allowing Loop to create an unrelated feature from free-form text.
- Replacing the existing state machine, revisions, living capability deltas,
  evidence gates, worktree isolation, or approval-bound agent handoff.
- Deleting or overwriting unmanaged agent extensions or user configuration.
- Adding embeddings, a hosted RAG service, or unbounded source-content indexing.

## Risks

- Five installed skills can drift into contradictory workflow advice; a shared
  catalog, common invariants, and generated-content assertions must keep their
  responsibilities disjoint.
- A stale repository-local skill can shadow a corrected global skill; cleanup
  must recognize every managed name while refusing unmanaged collisions.
- Stopping Spec before revision completion is intentional but can look stalled;
  its final response must name the pending approval and the exact Loop handoff.
- Persisting Socratic answers and starting workflow state must be atomic enough
  that a failed start does not falsely claim a bound active specification.
- Applying init options to an existing project can alter policy; only explicit
  values may overwrite stored choices, and repeat initialization must converge.

## Verification

- Install, repeat, deselect, and upgrade all five skills in isolated homes for
  every supported agent; cover marker-owned legacy files, unmanaged collisions,
  links, path containment, and native invocation reports.
- Initialize missing and partial repositories, including the observed
  `setupComplete: false` plus missing-context case; assert current context,
  applied explicit configuration, local managed-skill cleanup, no active
  feature, and byte-stable repetition.
- Validate every generated skill's frontmatter and content, MCP-first/private
  fallback contract, routing rules, approval boundary, and absence of public
  hidden-command guidance.
- Exercise persisted five-pass discovery with valid, missing, duplicate, and
  rejected answers; prove the approved refined request is exactly the request
  bound to Complex Specify and that worktree proposals remain non-mutating.
- Run focused tests and `bun run ci`, inspect the built package, run MCP/CLI
  smoke checks, dry-pack, and install the tarball into an empty consumer home.

## Capability Deltas

- `deltas/agent-integrations.md`
- `deltas/exploratory-discovery.md`
- `deltas/repository-knowledge.md`
