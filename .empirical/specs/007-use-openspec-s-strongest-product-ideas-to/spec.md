# Use Openspec S Strongest Product Ideas To

## Request

> Use OpenSpec's strongest product ideas to evolve Empirical into a 10/10 npm-only SDD workflow: add living capability specifications and delta archival, an exploratory discovery path, safe multiple active workstreams, strong customization where it improves UX, preserve automatic ordinary-request activation, Fast and Complex workflows, exact revisions, mandatory evidence, MCP, and cross-agent portability, and deliver cohesive documentation, migration, tests, and packaging.

## Goal

Empirical combines OpenSpec's strongest planning ergonomics with its existing
execution guarantees: users can explore vague work, run multiple independently
revisioned changes, maintain living capability specifications through validated
deltas and archive, and customize project context while retaining automatic
Fast/Complex selection, mandatory evidence, MCP, CLI, and npm portability.

## Acceptance Criteria

- [ ] [AC-1] `empirical explore`, `EmpiricalProject.explore`, and
  `empirical_explore` return the same read-only discovery packet for a vague
  request without creating a feature, changing a revision, or launching an AI.
- [ ] [AC-2] Complex changes declare validated requirement deltas by capability,
  and reviewed work cannot reach Done until archive atomically applies those
  deltas to committed `.empirical/capabilities/<name>/spec.md` living specs.
- [ ] [AC-3] Capability delta validation rejects duplicate additions, missing
  modifications/removals, malformed requirements, path traversal, and archive
  attempts before review, while repeated archive requests converge safely.
- [ ] [AC-4] Multiple named workstreams can be created, listed, selected for human
  convenience, addressed explicitly, resumed, and completed with independent
  revisions and event journals; changing the selected workstream cannot redirect
  an action packet or stale completion from another workstream.
- [ ] [AC-5] Existing schema-1/schema-2 repositories migrate additively to the new
  layout as a `default` workstream without losing state, events, specs, evidence,
  legacy Quick compatibility, or adopted `ai/` content.
- [ ] [AC-6] Project-local context and per-phase guidance can be configured in
  committed Empirical policy, appear in relevant action packets, and cannot
  replace the mandatory safety/evidence instructions.
- [ ] [AC-7] Generated agent guidance uses Explore for genuinely vague work, Fast
  only for explicit tiny low-risk non-UI changes, Complex otherwise, explicit
  workstream identity for active work, and archive after passing review—all from
  ordinary user requests without requiring profile or JSON switches.
- [ ] [AC-8] Fast remains an artifact-light one-revision workflow, while Complex
  remains Specify, Design, Plan, Implement, Verify, Review plus enforced Archive;
  all current revision, repair, evidence, browser, screenshot, and review gates
  continue to pass.
- [ ] [AC-9] CLI, MCP, TypeScript API, migration, integration, concurrency, delta,
  archive, built Node smoke, npm package, and documentation checks pass, and the
  committed OpenSpec change validates without adding OpenSpec as a package runtime
  dependency.

## Scope

- Living capability specifications and per-change delta files.
- Read-only exploratory discovery packets.
- Independently stored and revisioned workstreams with a default selection.
- Lightweight committed policy/context customization.
- CLI, MCP, JavaScript API, integrations, migrations, docs, tests, and packaging.
- OpenSpec planning artifacts for this repository.

## Non-goals

- Depending on or wrapping OpenSpec at Empirical runtime.
- A hosted service, visual dashboard, daemon, database, telemetry, or API keys.
- Multi-repository stores, arbitrary workflow schemas, or automated Git delivery.
- Launching a second agent or choosing a model for the host.

## Verification

- TypeScript typecheck and the complete Bun unit/MCP suite.
- Built JavaScript smoke flows under Node.js 20-compatible output.
- Focused migration, independent-workstream, delta validation, archive idempotency,
  project-policy, and concurrency tests.
- npm package dry-run proving no OpenSpec runtime dependency or accidental files.
- `openspec validate evolve-empirical-living-specs --strict`.
- Final criterion-by-criterion evidence and independent diff review.
