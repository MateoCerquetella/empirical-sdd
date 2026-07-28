# Architecture — Portable resumable SDD library

## Components

### Language-independent protocol

- `schemas/config.schema.json` — repository configuration.
- `schemas/state.schema.json` — canonical state snapshot represented in
  `ai/STATE.md` frontmatter.
- `schemas/event.schema.json` — append-only, revision-linked transitions.
- `schemas/evidence.schema.json` — criterion-bound test/browser/review proof.
- `schemas/phase-result.schema.json` — adapter result envelope.
- `schemas/kit-lock.schema.json` — managed starter version and baselines.
- `docs/protocol.md` — lifecycle and interoperability rules.

### Rust reference library

- `src/model.rs` — profiles, phases, status, criteria, events, and evidence.
- `src/config.rs` — TOML parsing, defaults, validation, and capability policy.
- `src/legacy.rs` — non-destructive v1 `STATE.md` and spec discovery.
- `src/spec.rs` — acceptance-criterion parsing and stable criterion IDs.
- `src/repository.rs` — atomic filesystem projection, event journal, hashing,
  optimistic revision checks, and recovery.
- `src/evidence.rs` — policy evaluation and artifact/hash validation.
- `src/engine.rs` — profile state machines, next actions, repair routing, and
  run-until-stop behavior.
- `src/adapter.rs` — product-neutral phase/browser/review capability traits and
  the reference command adapter.
- `src/delivery.rs` — delivery policy and optional Git/GitHub implementation.
- `src/init.rs` — neutral starter creation and v1 adoption.
- `src/kit.rs` — managed-file manifest and non-destructive starter upgrades.
- `src/agents.rs` — synchronized global command packs for supported agents.
- `src/lib.rs` — stable embedding API.

### CLI

- `src/main.rs` — `init`, `adopt`, `status`, `next`, `run`, `check-in`,
  `evidence`, `validate`, `recover`, `doctor`, and `deliver` commands.

### Portable repository surface

```text
ai/
├── empirical.toml
├── empirical.lock
├── STATE.md
├── events/<ulid>.json
├── context/
├── roles/
├── skills/
├── orchestration/
└── specs/<id>/
    ├── spec.md
    ├── architecture.md
    ├── plan.json
    ├── review.md
    └── evidence/
        ├── index.json
        └── <portable screenshots and attachments>
```

An existing v1 repository without `empirical.toml`, events, or structured evidence
remains readable. Adoption adds protocol metadata; it does not rename specs or
replace user-authored Markdown.

## State and recovery

`STATE.md` remains the single visible status surface. Versioned YAML-like
frontmatter carries the deterministic fields; the Markdown body remains for
humans and legacy agents.

Every transition:

1. Acquires a host-local repository lock outside the checkout.
2. Re-reads state and compares `expected_revision`.
3. Creates one immutable event with the complete post-transition state.
4. Atomically projects that state into `STATE.md`.
5. Releases the lock.

If a process stops after step 3, `recover` projects the newest valid linear
event. Two events claiming the same expected revision form a detectable fork
and require reconciliation; neither silently wins.

SQLite and IDE databases may index events, but are never consulted for
protocol correctness.

## Lifecycle

```text
Quick:  Shape → Implement → Verify → Review → [Deliver] → Done
Strong: Specify → Design → Plan → Implement → Verify → Review → [Deliver] → Done
```

Failed Verify or Review returns to Implement while incrementing the repair
counter. A third failure blocks. Missing required capability blocks before
execution. A result requesting human input enters Awaiting Human.

## Adapter contract

A phase adapter receives a bounded context containing repository root, spec,
phase, profile, revision, criteria, required capabilities, and an output path.
It returns a versioned `PhaseResult` envelope. The command adapter communicates
the same values through arguments/environment and requires the envelope file;
exit code alone never proves completion.

Browser implementations may be direct drivers, MCP-backed agents, or IDE
services. The core evaluates their neutral evidence records rather than knowing
which browser product produced them.

## Evidence gate

- Every acceptance criterion must have current-revision passing evidence.
- Test evidence binds command, exit status, output hash, and criterion IDs.
- UI criteria additionally bind browser assertions and screenshot hashes.
- Screenshot review binds each screenshot and criterion to a textual verdict.
- Review evidence identifies its actor; configured independent review rejects
  the implementation actor as reviewer.
- Any change to the specification revision makes prior evidence stale.

## Delivery boundary

Delivery is available only after Verify and Review pass. Repository
configuration independently enables commit, push, and pull request. The caller
must also grant delivery authority for the current invocation. A repository
cannot grant that authority to itself.

The library exposes a `DeliveryProvider` trait. The CLI implementation invokes
`git` and optionally `gh` using argument vectors, never generated shell text.

## Key tradeoffs

- **Filesystem protocol over SQLite:** slower for large event histories, but it
  enables cross-tool recovery and makes databases disposable.
- **Rust reference implementation over a runtime-specific script:** produces a
  single cross-platform binary that hosts can embed while schemas keep the
  protocol language-independent.
- **Command adapters before direct MCP transports:** one small portable
  integration works now; direct transports can be added without changing the
  protocol.
- **Retain `ai/` over renaming to `.sdd/`:** compatibility and adoption matter
  more than namespace aesthetics.

## Risks and mitigations

- **Quick mode becomes slow:** fixed short phase sequence and no mandatory
  design/plan artifacts.
- **Evidence is cosmetic:** criterion IDs, hashes, current revision, and typed
  verdicts are validated before Done.
- **Repository commands are malicious:** CLI execution requires an explicit
  `--allow-exec`; hosts implement their own trust decision.
- **Delivery surprises users:** configuration plus invocation authority, with
  all actions off by default.
- **Concurrent state forks:** optimistic revisions, immutable events, external
  local locks, and explicit reconciliation.
- **v1 behavior breaks:** read-only fixtures are tested before adoption and
  legacy phase names have deterministic mappings.

## Boundaries

The first release does not implement a product-specific UI, a daemon, a
database, a cloud coordinator, deployment, release automation, or a mandatory
direct MCP client. It defines adapter interfaces for those later integrations.

## Repository-kit ownership

`ai/empirical.lock` records the installed distribution and baseline hashes for only
the neutral roles, skills, orchestration, contracts, and spec templates. An
upgrade replaces a file only when its content still matches that baseline. It
adds missing new files, preserves edited/deleted managed files as conflicts, and
never targets context, actual specs, configuration, state, events, or evidence.

## Global agent commands

The official Empirical installer installs one canonical set of branded workflows
into every supported global agent-command location. Agent Skills content is
identical across shared hosts, Codex, and Claude Code; Gemini receives equivalent
TOML commands. A disposable user-level manifest enables safe updates. These
commands invoke `empirical` and the repository protocol; they never store
workflow state or require a per-agent integration action.
