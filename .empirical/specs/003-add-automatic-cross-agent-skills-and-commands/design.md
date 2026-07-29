# Design

## Workflow model

Add `fast` as an additive profile. Do not shorten Quick or Strong.

```text
Fast:   Implement + Verify + Review (one revision) -> Done
Quick:  Shape -> Implement -> Verify -> Review -> Done
Strong: Specify -> Design -> Plan -> Implement -> Verify -> Review -> Done
```

Fast reuses the existing `implement` phase and persists no new state shape. Its
start operation writes a minimal spec containing `AC-1` derived from the
whitespace-normalized request. The returned action instructs the agent to make
the change, run the smallest real behavioral check, inspect the diff, and
submit behavioral and review evidence together.

Passing Fast completion validates the same evidence rules used by Verify plus
the same review rule used by Review, including browser and screenshot proof if
a `[UI]` criterion exists. It then transitions directly to Done. A reported
Fast failure escalates the active workflow to Quick at Implement so repair is
followed by separate Verify and Review gates.

Fast selection remains agent judgment, not deterministic keyword matching.
Generated instructions select it only when behavior is explicit and the change
is localized, reversible, non-UI, and unrelated to security, permissions,
authentication, payments, data/schema migrations, dependencies, public APIs,
infrastructure, or architecture. Uncertainty selects Quick; high-risk or
cross-cutting work selects Strong.

## Cooperative loop

Add `EmpiricalProject.loop(request?, options?)` as a start-or-resume operation:

- idle or Done plus a request: start a new feature;
- active plus no request or the identical request: return the current action;
- active plus a different request: reject it as a competing feature;
- no request: return Idle, current, or terminal state without mutation.

Expose this as `empirical loop ["request"]` and `empirical_loop`. It is one
cooperative tick, not an AI runtime. The current coding agent performs the
returned action, calls Complete at the exact revision, and consumes the next
returned action until status is Done, Blocked, or awaiting human input.

## Agent discovery

Keep the short managed block in `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` as
the universal automatic layer. Refresh it to use the loop operation, ordinary
requests, conservative profile selection, and terminal stop conditions.

Generate these repository-local managed files:

```text
.agents/skills/empirical/SKILL.md       # Codex and Agent Skills hosts
.claude/skills/empirical/SKILL.md       # Claude Code
.cursor/commands/empirical.md           # /empirical fallback
.gemini/commands/empirical.toml         # /empirical fallback
.windsurf/workflows/empirical.md        # /empirical fallback
```

The two skills have the same open-format workflow and an aggressively clear
description so supported hosts can invoke it implicitly. Native commands are
manual escape hatches. Managed files contain ownership markers; refresh
replaces only marked files and preserves unmarked conflicts. No user-home
files or lifecycle hooks are written.

## Compatibility

- The protocol schema advances to 2. Schema-1 Quick/Strong repositories remain
  readable and are upgraded safely by `empirical migrate` or their next
  mutation; the schema guard prevents older engines from advancing Fast state.
- Quick and Strong sequences, evidence gates, and adoption defaults remain
  unchanged.
- The loop API is additive; existing Start/Next clients continue working.
- MCP remains optional and uses the same core and filesystem state as the CLI.
- Bump the package minor version because the public profile/API/CLI surface is
  additive.

## Verification strategy

Core tests cover the Fast happy path, missing evidence, UI evidence, failure
escalation, and loop state semantics. Integration tests inspect every generated
file, repeat refresh, and preserve an unowned conflict. MCP tests invoke Fast
and Loop. Existing Quick/Strong/adoption/concurrency tests remain unchanged.
Finally run type checking, all Bun tests, built-package smoke tests, and npm
pack inspection.
