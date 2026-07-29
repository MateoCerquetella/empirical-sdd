## Why

Empirical is stronger than artifact-only SDD tools at deterministic execution,
but it lacks the living product knowledge, exploratory discovery, parallel-change
ergonomics, and close-the-loop archive experience that make OpenSpec compelling.
Combining those strengths creates a workflow that helps agents build the right
thing and then proves that they finished it safely.

## What Changes

- Add committed capability specifications that describe current system behavior.
- Add per-change requirement deltas and an enforced archive operation that merges
  reviewed Complex changes into living capability specifications.
- Add a no-write Explore operation for vague requests before workflow selection.
- Add independently revisioned workstreams so several changes can be active and
  resumed safely without a shared selected-workstream race.
- Add lightweight project policy and context customization to action packets.
- Update automatic agent guidance to use Explore, Fast, Complex, workstreams, and
  archive without requiring users to learn the commands.
- Preserve Fast as the artifact-light path and preserve legacy Quick/schema state.
- Keep OpenSpec as a development-time planning tool only; `empirical-sdd` gains no
  OpenSpec runtime dependency.

## Capabilities

### New Capabilities

- `living-specifications`: Capability specs, requirement deltas, validation, and
  archive merging that keep documented behavior aligned with completed changes.
- `exploratory-discovery`: A read-only Explore packet that helps the current agent
  investigate and refine vague work before starting Fast or Complex.
- `parallel-workstreams`: Independently revisioned active changes with explicit
  workstream identity across CLI, MCP, API, completion, status, and resumption.
- `project-policy`: Committed project context and phase guidance that enrich action
  packets without installing global hooks or adding another runtime.

### Modified Capabilities

<!-- No existing OpenSpec capability specifications exist in this repository yet. -->

## Impact

- Core state, storage layout, schema migration, action packet, and evidence APIs.
- CLI and MCP commands for exploration, workstreams, capabilities, and archive.
- Generated project-local instructions and supported-agent integrations.
- Complex phase sequence and completion behavior; Fast remains one-pass.
- Documentation, demos, installers, package smoke tests, and conformance tests.
- New committed `openspec/` planning artifacts used to dogfood the upstream tool.

## Non-goals

- No OpenSpec runtime dependency, cloud service, GUI, daemon, telemetry, or API key.
- No automatic Git commit, push, pull request, or multi-repository orchestration.
- No arbitrary workflow-programming language in this revision.
- No weakening of mandatory verification, review, UI evidence, or revision checks.
