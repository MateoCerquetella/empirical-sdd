# Empirical 0 21 Trust Autonomy And Delivery Overhaul

## Request

> Implement the approved Empirical 0.21 Trust, Autonomy, and Delivery overhaul as one breaking Schema-5 change: add a sixth empirical-yolo skill with standing authorization and blocker-only questions; deterministic risk-floor routing with contract-neutral Fast; behavioral/non-behavioral Complex paths; immutable executed/collected evidence receipts; cross-worktree capability claims, base-digest replay, integration validation, and precise completion levels; GitHub source/evidence PR delivery with green-CI merge and explicit-release-only publication; Manifest-v2 stale knowledge, Policy-v2 verification/delivery configuration, Doctor diagnostics, hash-chained compacted terminal journals; shared runtime schemas and operation registry; narrower package exports; subcommand help; six-skill installer; Node >=22 CI and coverage gates. Preserve hard safety floors: never bypass host permissions or branch protection, force Git, replace immutable releases, extract credentials, infer publication, or delete real worktrees/branches. Migrate this repository atomically from Schema 4 to Schema 5, verify comprehensively, merge capability deltas, and do not publish or create a release.

## Goal

Empirical 0.21 provides a deterministic, evidence-backed workflow whose safe
default remains approval-bound while an explicit YOLO entrypoint can carry
standing authorization through implementation and GitHub delivery. The system
must report exactly what is complete, preserve trustworthy evidence and living
specifications across parallel worktrees and restarts, migrate Schema 4 state
atomically, and expose a smaller, coherent public API without weakening host,
Git, branch-protection, credential, publication, or deletion safety floors.

## Acceptance Criteria

- [ ] [AC-1] Installing or updating Empirical installs exactly six native skills—`empirical`, `empirical-init`, `empirical-loop`, `empirical-socratic`, `empirical-spec`, and `empirical-yolo`—and every install, update, discovery, help, and documentation count is derived from the same registry.
- [ ] [AC-2] Normal workflows stop only at material approval gates, while `empirical-yolo` records explicit standing authorization and autonomously advances specification, design, planning, implementation, verification, review, integration, and authorized delivery.
- [ ] [AC-3] YOLO asks only questions that block a correct product decision and never suppresses host or operating-system permission prompts, forces Git, bypasses branch protection, replaces immutable tags or versions, extracts credentials, infers publication, or deletes real worktrees or branches.
- [ ] [AC-4] Routing is deterministic and reports the selected profile, mode, risk floor, rationale, and required gates; Fast is available only for contract-neutral work and material behavioral, security, migration, integration, delivery, or publication risk is promoted to Complex.
- [ ] [AC-5] Every Complex feature records a machine-readable impact manifest. Behavioral work requires capability deltas; non-behavioral work forbids fabricated deltas and instead records a concrete regression rationale and affected capabilities.
- [ ] [AC-6] Acceptance criteria have stable unique identifiers, evidence references resolve to known criteria and artifacts, and boolean-only assertions cannot satisfy verification.
- [ ] [AC-7] Executed and collected evidence are immutable receipts bound to the specification revision, repository tree, command or artifact provenance, result digest, and timestamp; missing, stale, modified, or tampered receipts fail verification deterministically.
- [ ] [AC-8] Project commands execute without a shell from exact argument vectors, an explicit working directory, bounded timeout and output, and redacted environment metadata; secrets are neither persisted nor copied into evidence.
- [ ] [AC-9] Parallel worktrees coordinate capability claims through the repository common directory, record base digests, detect overlapping claims, replay deltas against the current integration base, and emit a signed-by-digest integration receipt or a precise conflict without corrupting living specifications.
- [ ] [AC-10] Integration validation runs the configured verification policy against an independently advanced target branch and rejects source/evidence that is green only against a stale feature base.
- [ ] [AC-11] Status and completion APIs distinguish `implemented`, `verified`, `integrated`, `delivered`, and `published`; legal phase transitions and terminal states make partial completion impossible to misreport.
- [ ] [AC-12] With explicit GitHub delivery authorization, Empirical uses shell-free Git and GitHub CLI argument vectors to create intentional commits, push without force, open a source pull request, wait for required checks, request a normal protected merge, and then open a follow-up evidence pull request; it never uses admin bypass or treats a local commit as delivery.
- [ ] [AC-13] Publication requires an explicit release request and exact version. Retries are idempotent and immutable existing tags, versions, or releases are reported rather than replaced; ordinary YOLO or delivery requests never imply publication.
- [ ] [AC-14] Manifest v2 records source fingerprints and freshness, retrieves only fresh knowledge by default, marks stale pages explicitly after source changes, and Doctor reports actionable schema, journal, lock, claim, toolchain, policy, knowledge, evidence, worktree, and delivery diagnostics without mutating the repository.
- [ ] [AC-15] Policy v2 validates exact verification command vectors, timeouts, evidence requirements, delivery target/provider/check policy, and preferred external agent. Configuration grants no authority by itself and repository-local policy cannot redirect execution outside the current repository.
- [ ] [AC-16] Schema 5 state uses hash-chained terminal journals and transactional compaction with a verifiable snapshot boundary. Schema 4 repositories migrate atomically with a recoverable preflight, deterministic transforms, validation, and no mixed-version state.
- [ ] [AC-17] MCP tools, CLI commands, integrations, documentation, and generated skills derive operations from one registry, while package exports expose only the supported root API plus `./protocol`, `./mcp`, and `./integrations` entrypoints.
- [ ] [AC-18] Every CLI subcommand has usable `--help`; runtime and CI support Node 22, 24, and 26; documentation describes the six workflows, safety floors, exact completion levels, migration, evidence, delivery, and release opt-in behavior.
- [ ] [AC-19] Unit, integration, migration, tamper, replay, concurrency, CLI, and clean-consumer tests pass with aggregate line and function coverage at or above 90% and per-module line coverage at or above 80%.

## Scope

- Schema, protocol, state machine, journal, receipt, policy, knowledge, routing,
  execution, worktree coordination, integration, delivery, release, Doctor,
  CLI, MCP, installer, generated skills, public exports, documentation, CI, and
  test changes required by the acceptance criteria.
- An atomic in-repository migration from the current Schema 4 state to Schema 5.
- GitHub as the first delivery provider, with provider-neutral internal types
  only where they make the GitHub implementation clearer.
- Local implementation and comprehensive verification. Publication and release
  creation remain explicitly excluded from this request.

## Non-goals

- Suppressing host approval or operating-system permission surfaces.
- Force-pushing, deleting real branches or worktrees, bypassing protected-branch
  policy, extracting credentials, or replacing immutable remote artifacts.
- Supporting additional forge or package-registry providers in this change.
- Preserving undocumented Schema 4 TypeScript APIs or package-root internals.
- Publishing npm packages, creating Git tags, or creating GitHub releases.

## Verification

- Run the complete unit and integration suite on the migrated Schema 5 fixture
  and on clean Schema 4 migration fixtures, including interrupted migration and
  compaction recovery.
- Exercise routing, risk promotion, normal gates, YOLO standing authorization,
  hard safety floors, evidence tamper/staleness, shell-free execution, bounded
  output, redaction, capability-claim concurrency, replay conflicts, and exact
  completion reporting.
- Exercise GitHub delivery and release state machines against deterministic fake
  process/provider adapters; assert exact argument vectors and forbidden flags.
- Pack the package and test clean consumers through the root, `./protocol`,
  `./mcp`, and `./integrations` exports; assert internal paths are unavailable.
- Run formatting, type checking, linting, tests, coverage thresholds, package
  integrity checks, documentation checks, and Node 22/24/26 CI configuration
  validation.
- Run Doctor before and after migration and verify journal chains, snapshots,
  receipts, knowledge freshness, worktree claims, and delivery state.

## Capability Deltas

- `workflow-routing`: deterministic modes, risk floors, Fast eligibility, and
  exact completion levels.
- `autonomous-delivery`: standing authorization, GitHub source/evidence delivery,
  and explicit-only publication.
- `verification-policy`: executable policy, immutable receipts, and tamper gates.
- `worktree-isolation`: shared claims, base digests, replay, and integration.
- `living-specifications`: behavioral impact manifests and safe delta merging.
- `project-policy`: Policy v2 validation and authority boundaries.
- `repository-knowledge`: Manifest v2 freshness and Doctor diagnostics.
- `agent-integrations`: six generated skills and preferred external-agent use.
- `agent-handoff`: mode-aware approval and authorization semantics.
- `exploratory-discovery`: blocker-only YOLO questions and deterministic routing.
- `package-distribution`: supported exports, runtime matrix, and release integrity.
