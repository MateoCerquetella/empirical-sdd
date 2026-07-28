# Empirical CLI

The CLI-first, evidence-backed development workflow for any terminal, agent,
IDE, or CI system.

The installed product is one standalone command-line executable: `empirical`.
It does not install or run a GUI application, background service, Agentum
runtime, IDE plug-in, database, or MCP server. A Rust API is available for tool
authors, but it is an optional embedding surface over the same CLI protocol.

Empirical SDD keeps the approachable `ai/` workspace used by the original
[Empirical SDD + DDD starter](https://github.com/goempirical/empirical-sdd-ddd-starter),
then adds a deterministic continuation protocol, Quick and Strong profiles,
criterion-bound QA, crash recovery, and opt-in delivery. It is an independent,
MIT-licensed implementation designed to adopt existing v1 repositories without
renaming or deleting their files.

The central rule is simple: **the Git repository is the source of truth**.
SQLite, IDE databases, MCP, and cloud services are all optional adapters or
caches. Delete them and another conforming client can continue from
`ai/STATE.md` plus `ai/events/`.

## What changed

| Concern | Original v1 starter | Earlier runtime-coupled v2 | Empirical CLI |
|---|---|---|---|
| Portability | Markdown scaffold | Product/runtime coupled | Neutral schemas, files, Rust API, and CLI |
| Continuation | Role guidance | Runtime orchestration | Persistent `run-until-stop` loop |
| Small features | Full role path | Too much ceremony | Quick: Shape → Implement → Verify → Review |
| Risky features | Role path | Strong runtime controls | Strong: Specify → Design → Plan → Implement → Verify → Review |
| Completion proof | Mostly narrative | Runtime evidence | Per-criterion portable evidence and hashes |
| UI QA | Not enforced | Product/browser integration | Any browser/MCP adapter; assertions + screenshots + agent review |
| Recovery | Read `STATE.md` | Could depend on SQLite | Revision-linked repository events; SQLite is disposable |
| Git delivery | Manual | Product automation | Commit, push, and PR separately configured and authorized |

See [the design comparison](docs/design-comparison.md) for the reasoning.

## Install

The official installer installs the `empirical` executable and all supported
global agent command packs together. Inspect the script first if required by
your security policy.

```bash
curl -fsSL https://raw.githubusercontent.com/MateoCerquetella/empirical-sdd/main/scripts/install.sh | sh
```

The PowerShell equivalent is `scripts/install.ps1`. Rust 1.85 or newer is
required. If you install with Cargo directly, run `empirical agents sync` once;
the official installer already does this. Updates use the same installer and
refresh every supported agent pack together.

The initial distribution installs the Agent Skills commands
`empirical-init`, `empirical-spec`, `empirical-next`, `empirical-loop`,
`empirical-status`, `empirical-verify`, and `empirical-ship` for shared Agent
Skills hosts, Codex, and Claude Code, plus equivalent `/empirical:*` Gemini CLI
commands. There is no per-agent integration step. See
[global agent commands](docs/agent-commands.md).

Hosts can also embed the crate and implement `PhaseAdapter` or
`DeliveryProvider` directly.

## Start a project

```bash
empirical --root . init --profile quick --mode autonomous
empirical new 001-my-feature --profile quick
# Edit ai/specs/001-my-feature/spec.md
empirical next --json
```

For an existing Empirical v1 project:

```bash
empirical status                 # read-only discovery
empirical adopt                  # preserves v1 paths and Markdown
```

Legacy projects default to Strong so adoption does not silently remove gates.
You may explicitly choose `empirical adopt --profile quick` for narrow work.

## Keep the repository kit updated

The executable and the committed repository kit are versioned separately. After
updating the CLI, inspect and apply repository playbook changes with:

```bash
empirical upgrade --check
empirical upgrade
```

`ai/empirical.lock` records the distribution version and hashes only Empirical-managed
files. Clean roles, skills, orchestration rules, contracts, and spec templates
update automatically. Local modifications are preserved and reported as
conflicts. Project context, real specs, config, state, events, and evidence are
never overwritten by an upgrade. See [safe kit updates](docs/upgrades.md).

## Continue automatically

Configure phase adapters in `ai/empirical.toml`, then explicitly permit their
execution for this invocation:

```bash
empirical loop --allow-exec
```

The loop resumes from the recorded phase after a restart and continues until:

- Done;
- Blocked after the bounded repair limit;
- a genuinely required human decision;
- a required capability or adapter is unavailable; or
- QA and review pass and configured delivery is ready.

Missing adapters/capabilities are resumable stop conditions and do not poison
repository state. A workflow that exhausted its repair budget is deliberately
Blocked; after resolving the cause, resume it explicitly with `empirical retry
--expected-revision N`.

An IDE or agent that does its own execution can remain completely independent
of the command adapter:

```bash
empirical next --json
# The client performs the current phase and writes phase-result.json.
empirical check-in --expected-revision 7 --result phase-result.json
```

Exit code zero by itself never advances a phase. The client must return the
versioned [phase result envelope](schemas/phase-result.schema.json).

## Evidence, including UI work

Every acceptance criterion needs passing evidence bound to both the current
spec revision and a deterministic hash of the tested workspace. Any later
source edit makes that proof stale. Test evidence records the command arguments,
exit code, and output hash. A criterion marked `[UI]` additionally requires:

1. a real-browser assertion;
2. a screenshot stored under the spec's `evidence/` directory; and
3. an agent review that binds its verdict to that screenshot and criterion.

The browser may be Playwright, an MCP browser available to an agent, an IDE
service, or another adapter. The core protocol cares about capabilities and
evidence, not the vendor. See [evidence and browser QA](docs/evidence.md).

## Optional delivery

Delivery is off by default. `ai/empirical.toml` can enable commit, push, and pull
request independently. The invocation must separately authorize each enabled
action:

```bash
empirical deliver --allow-commit --allow-push --allow-pull-request
```

Delivery is rejected before QA and independent review pass. Commits are limited
to explicit configured paths, and commands are passed as argument vectors
without shell interpolation.

## Repository contract

```text
ai/
├── empirical.toml           # policy and adapter configuration
├── empirical.lock           # kit version and managed-file baselines
├── STATE.md                 # visible current projection
├── events/*.json            # immutable recovery history
├── context/                 # durable project knowledge
├── roles/                   # product-neutral role playbooks
├── skills/                  # product-neutral procedures
├── templates/               # host-neutral prompts retained from v1
├── orchestration/           # loop and handoff rules
└── specs/<id>/
    ├── spec.md
    ├── architecture.md      # Strong
    ├── plan.json            # Strong
    ├── tasks.md             # optional v1-compatible checklist
    ├── review.md            # Strong
    └── evidence/
        ├── index.json
        └── screenshots and attachments
```

No host-specific directory is created and no SQLite package is linked. Hosts
may build disposable indexes, but protocol correctness never consults them.

## Documentation

- [Protocol and lifecycle](docs/protocol.md)
- [Migrating from v1](docs/migration-v1.md)
- [Safe repository-kit updates](docs/upgrades.md)
- [Configuration](docs/configuration.md)
- [Adapters and MCP/browser hosts](docs/adapters.md)
- [Global agent commands](docs/agent-commands.md)
- [Evidence and browser QA](docs/evidence.md)
- [Embedding and host integration](docs/embedding.md)
- [Security model](docs/security.md)
- [Contributing](CONTRIBUTING.md)

## Development

```bash
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets
```

The conformance suite covers v1 adoption, Quick/Strong sequences, stale writer
rejection, event recovery, evidence gates, UI requirements, and delivery
authorization.

## License

MIT. See [LICENSE](LICENSE).
