# Empirical Setup Wizard And Broad Agent Installer

## Request

> Enhance Empirical initialization and global agent installation UX. When the
> `empirical-init` skill initializes or repairs a repository, present a polished
> settings wizard before persisting configuration. Expose evidence policy,
> worktree isolation, and Complex decision-record choices with safe defaults and
> an editable review step. Replace the five-row `empirical install` picker with
> a searchable, scrollable experience modeled on the current `npx skills` CLI,
> and support its broad agent-skill ecosystem without claiming unsupported MCP
> or launch capabilities. Show the proposed experience and contract before any
> implementation begins.

## Goal

Make first-run setup understandable and deliberate, and let developers install
Empirical's five skills into the broad set of agent-native global skill roots
used by the open agent-skills ecosystem. The result should feel as polished and
efficient as the current `npx skills` selector while preserving Empirical's
offline behavior, exact reconciliation, path safety, and honest capability
boundaries.

`empirical-init` remains an in-agent skill. This change does not re-expose Init
as a public shell command. `empirical install` remains the public terminal flow
for selecting global agent integrations.

## Proposed Experience

### In-agent setup summary

On first run, the host agent presents one compact review before it calls the
mutating initialization operation. A host with native choice controls may use
them; every host must preserve the same labels, values, and confirmation gate.

```text
◆ Empirical setup
│
│  Verification
│  ● Acceptance-test evidence for every criterion       recommended
│  ● Real-browser evidence for [UI] criteria             recommended
│  ● Screenshot artifact for [UI] criteria               recommended
│  ● Independent code-review evidence                    recommended
│
│  Parallel work
│  ● Ask before creating an isolated worktree
│    Base: auto (currently main)
│    Path: ../{repo}-{feature}
│    Branch: {type}/{feature}
│
│  Decisions
│  ● Require reviewable decision records for Complex work
│
◇ Use these settings?
│  ● Apply recommended settings
│  ○ Customize
│  ○ Cancel
```

Choosing Customize opens one section at a time. Verification uses a checklist;
isolation and decision policy use single-choice prompts; path templates become
editable only when relevant. Before saving, the agent shows the complete
effective configuration and offers Save, Edit, or Cancel.

```text
◆ Verification policy  (space to toggle)
│  ● Acceptance-test evidence
│  ● Browser evidence for [UI]
│  ● Screenshot artifacts for [UI]
│  ● Code-review evidence
│
◇ Saved selection
│  Acceptance tests, UI browser, UI screenshots, code review
```

When configuration already exists, the same first screen labels the values
`current`, defaults to Keep current settings, and offers Edit or Cancel. Repair
must not reset choices the user does not edit.

### Searchable global agent selector

The selector borrows the compact rail, searchable list, status hints, scrolling,
and selected-item summary from the current `npx skills` experience. The exact
color palette may follow terminal capabilities, but the information hierarchy
and keyboard behavior are contractual.

```text
◆ Empirical install
│  70+ compatible agent skill targets · local catalog
│
◆ Which agents should receive Empirical?  (type to search)
│  Search: code█
│  ↑↓ move, space select, enter confirm, esc cancel
│
│  Detected or installed
│ ❯ ● Codex          detected · installed   ~/.codex/skills
│   ● Claude Code    detected               ~/.claude/skills
│
│  Additional agents
│   ○ CodeBuddy                             ~/.codebuddy/skills
│   ○ Command Code                          ~/.commandcode/skills
│   ○ OpenCode                              ~/.config/opencode/skills
│   ↓ 65 more
│
│  Selected: Codex, Claude Code
└
```

The initial list prioritizes detected and currently managed agents. Typing
filters by display name, stable id, and destination path. A submitted screen
collapses to the chosen names and an installation report identifies the unique
destinations written, preserved, or skipped.

## Acceptance Criteria

- [ ] [AC-1] On first-run `empirical-init`, the current host shows the complete
  recommended configuration and Apply, Customize, and Cancel choices before the
  first configuration write; initialization creates no feature, specification,
  worktree, or external process.
- [ ] [AC-2] The setup flow exposes and persists all four current evidence
  settings: criterion evidence, browser evidence for UI criteria, screenshot
  artifacts for UI criteria, and code-review evidence. First-run defaults remain
  enabled for all four.
- [ ] [AC-3] The setup flow exposes and persists isolation mode, resolved or
  explicit base branch, sibling worktree path, branch pattern, and Complex
  decision-record policy while keeping internal Fast/Complex routing and repair
  attempt limits out of the user-facing wizard.
- [ ] [AC-4] The wizard explains that disabling criterion evidence makes its
  test/browser/screenshot sub-policies inactive without erasing their stored
  values, while the code-review gate remains independently configurable.
- [ ] [AC-5] Customize presents one section at a time, validates enumerated
  choices and path/branch templates before save, and ends with an effective
  configuration review offering Save, Edit, or Cancel. Cancel leaves repository
  configuration and workflow state unchanged.
- [ ] [AC-6] Running `empirical-init` against an existing or partial setup shows
  current values, defaults to keeping them, preserves every unedited value, and
  still repairs integrations/context only after the settings confirmation.
- [ ] [AC-7] The TypeScript configuration API, `empirical_init` and
  `empirical_configure` MCP operations, JSON results, and private non-interactive
  CLI flags accept equivalent partial evidence, isolation, and decision inputs.
  Omitted inputs preserve existing values during repair and use safe defaults on
  first initialization.
- [ ] [AC-8] `empirical install` renders a terminal-width-safe searchable
  multiselect with at most a bounded visible window, scroll counts, detected and
  installed status, destination-path hints, a selected summary, and working
  arrow-key, space, Enter, Escape, and Ctrl-C behavior.
- [ ] [AC-9] The packaged installer contains a checked-in, release-audited agent
  catalog with recorded upstream provenance. It includes every global-capable
  target in the pinned `vercel-labs/skills` catalog used for the release, needs
  no network or `npx` process at runtime, and rejects project-only or pathless
  targets from global installation with an explicit reason.
- [ ] [AC-10] The selector remembers the last explicit selection, prioritizes
  detected/currently managed targets, searches display names, ids, and paths,
  and does not silently select all catalog entries when no local agent is found.
- [ ] [AC-11] Installation writes the same five marker-owned Empirical skills to
  every selected native global root, deduplicates agents that share a physical
  destination, and removes a shared managed destination only when no selected
  target still depends on it. Unmanaged files, directories, symlinks, and
  out-of-home paths remain protected.
- [ ] [AC-12] Existing `--agent`, `-a`, `--all`, `--yes`, and `--json` behavior
  remains deterministic. Legacy ids for the original five agents remain valid
  aliases, `--yes` preserves the remembered/detected managed set without a
  prompt, and repeated runs converge.
- [ ] [AC-13] Broad skill-file compatibility is represented by a distinct type
  and registry from executable handoff and project MCP-bridge support. A
  skill-only target never appears in a handoff offer and is never reported as
  launchable or MCP-configured.
- [ ] [AC-14] Human and JSON installation reports name selected agents, unique
  destination roots, created/updated/removed/preserved outcomes, and verified
  invocation/reload guidance when known. Unknown runtime capabilities are
  labeled honestly instead of receiving guessed instructions.
- [ ] [AC-15] README, demo, architecture, help, generated skill instructions,
  and capability specifications describe the settings wizard, searchable broad
  installer, compatibility layers, defaults, and non-interactive equivalents
  without presenting private workflow commands as public shell commands.

## Scope

- The `empirical-init` and automatic initialization skill contracts.
- Core configuration input/merge behavior for the existing evidence fields.
- MCP schemas and private CLI flags for configuration parity.
- A reusable prompt/rendering layer for setup and long-list selection.
- A checked-in global skill-target catalog with stable ids, labels, paths,
  aliases, detection hints, and upstream provenance.
- Durable global selection metadata needed to disambiguate shared roots.
- Global install/update reconciliation, reports, tests, and documentation.
- Explicit separation of skill installation, project MCP bridging, and external
  handoff launch metadata.

## Non-goals

- Exposing `empirical init` or any state-machine operation as a new public shell
  command.
- Running `npx skills`, requiring network access, adopting its telemetry, or
  using its lockfile/runtime storage during Empirical installation.
- Installing arbitrary third-party skills or becoming a general skill package
  manager.
- Claiming MCP configuration, command syntax, prompt launch, or workspace launch
  support for every agent that can read a `SKILL.md` directory.
- Changing the five installed Empirical skills, automatic workflow routing,
  state-machine phases, evidence semantics, or worktree approval rules.
- Exposing internal profile selection or `maxRepairAttempts` in setup.
- Selecting every catalog agent by default when nothing is detected.

## Risks And Mitigations

- **Upstream catalog drift:** pin provenance in the checked-in catalog, validate
  duplicate ids and unsafe paths in CI, and make catalog refresh an explicit
  maintainer operation rather than a runtime fetch.
- **Shared destination ambiguity:** persist selected ids separately and reconcile
  unique normalized roots by reference count so deselecting one alias cannot
  remove skills still required by another.
- **Overstated compatibility:** keep install targets, MCP bridge targets, and
  executable handoff targets separate in types, reports, and tests.
- **Long-list terminal corruption:** bound rendered rows, account for terminal
  width and ANSI-free display width, redraw atomically, and cover narrow and
  resized terminals with pure rendering tests.
- **Repair regression:** merge partial settings over current configuration and
  test schema-4 repositories so new setup surfaces do not reset existing values.
- **Dependency or license cost:** choose or adapt the prompt implementation only
  after Design records package size, license, maintenance, and accessibility
  trade-offs; the observable `npx skills`-style behavior is required, not a
  particular dependency.

## Verification

- Unit-test configuration defaults, partial merges, disabled-policy behavior,
  validation, cancellation, and config serialization.
- Test MCP and private CLI parity for every evidence/isolation/decision field,
  including existing schema-4 repair with omitted values.
- Snapshot-test prompt frames without ANSI color at 40-, 80-, and 120-column
  widths; test search, scrolling, selection, cancellation, and empty-selection
  errors through reducer-level and pseudo-terminal coverage.
- Validate the checked-in catalog for unique ids, safe relative home paths,
  valid aliases, global eligibility, provenance, and deterministic ordering.
- Exercise representative native, universal/shared-root, IDE-only, CLI-only,
  legacy-alias, project-only, and unknown-capability entries in temporary homes.
- Repeat install/update/deselect cycles and verify marker ownership, shared-root
  reference behavior, unmanaged collisions, symbolic-link protection, and
  human/JSON report equivalence.
- Verify handoff/MCP lists remain limited to explicitly capable definitions even
  when many additional skill-install targets are selected.
- Run `bun run ci` and manually inspect the real TTY wizard/selector before
  review evidence is accepted.

## Capability Deltas

- `agent-integrations`: broad searchable installation, safe remembered
  reconciliation, accurate reports, and explicit compatibility layers.
- `agent-handoff`: installation compatibility cannot imply executable handoff.
- `worktree-isolation`: first-run and repair configuration use an approved setup
  summary/customization flow.
- `decision-traceability`: the existing decision-record toggle is presented and
  enforced honestly.
- `verification-policy`: new living contract for configurable criterion, UI,
  screenshot, and review evidence gates.
