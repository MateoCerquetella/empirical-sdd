# Decisions: Empirical Setup Wizard And Broad Agent Installer

Record concise, externally reviewable evidence and choices here. Do not store
private chain-of-thought, prompts, credentials, secrets, or scratchpad text.

## D-001: Pin a local agent-skill catalog instead of invoking another CLI

Status: Accepted

### Evidence

The upstream `vercel-labs/skills` registry at commit
`7cb7db64dc1201052dea305e508a2fc490f7e5e2` and package version 1.5.21 contains
75 targets, 73 of which define global skill roots. Empirical currently installs
offline from its own npm package, owns reconciliation through file markers, and
must preserve unmanaged files and deterministic JSON behavior. The `skills`
package is a CLI rather than a stable catalog library and includes network and
telemetry behavior that Empirical does not need at runtime.

### Options

- Spawn `npx skills` and delegate installation and selection to it.
- Add the full `skills` package as a runtime dependency and import internals.
- Check in a reviewed metadata snapshot with exact upstream provenance and use
  Empirical's existing safe writer.

### Chosen approach

Check in a typed metadata snapshot with the upstream repository, version, and
commit. Reproduce the relevant searchable interaction locally and retain
Empirical's marker ownership, safety checks, reports, and offline runtime.

### Trade-offs and risks

Catalog refreshes require an intentional reviewed source change instead of
arriving automatically. This prevents unreviewed path changes and runtime
network failures, and CI validation makes drift visible. The product borrows
observable interaction patterns, not upstream telemetry or storage semantics.

### Verification

Assert provenance, total/global counts, stable ids, exclusions, alias uniqueness,
safe paths, deterministic order, and absence of runtime network or `npx` calls.

## D-002: Separate skill installation from MCP and executable handoff

Status: Accepted

### Evidence

The current five-entry registry combines a global skill directory with
executable names, launch capability, invocation syntax, and reload guidance.
Most upstream targets provide only a skill directory. Treating those entries as
the current type would cause handoff offers and reports to imply unverified
runtime control.

### Options

- Expand the existing registry and fill unknown executable/runtime values with
  guesses.
- Limit the product to the original five agents.
- Create a broad skill-target registry and retain explicit smaller MCP/handoff
  registries with compatibility aliases.

### Chosen approach

Create a distinct broad skill-target catalog. Keep handoff executable metadata
in `src/agents.ts` and project MCP integration logic in `src/integrations.ts`.
Reports expose only capabilities backed by explicit metadata.

### Trade-offs and risks

Some selected agents receive Empirical skills but rely on the private CLI
fallback rather than MCP. The report must make that boundary obvious. The
separate registries add types and mapping code but prevent permission and launch
claims from expanding accidentally.

### Verification

Install a representative skill-only entry and prove its files and report exist
while MCP bridge files and handoff offers remain unchanged. Retain all original
handoff tests.

## D-003: Reconcile shared roots from a durable canonical-id manifest

Status: Accepted

### Evidence

Several upstream ids map to the same global directory. Marker scans can prove
that Empirical owns files at a path but cannot recover which of the sharing ids
the user selected. Removing per id would also remove files still needed by a
different selected id.

### Options

- Infer every selection from existing skill files.
- Write duplicate files and remove them independently per agent id.
- Persist canonical selected ids and reconcile one reference-counted operation
  per normalized root.

### Chosen approach

Persist the last successful canonical selection in the marker-owned
`~/.empirical-sdd/integrations.json` file. Group selected and catalog entries by
normalized destination, install once when any selected id references a root,
and remove only when none do.

### Trade-offs and risks

The installer gains one small user-home metadata file and must safely handle an
unmanaged collision. It will preserve invalid/unowned metadata and use
conservative legacy inference rather than overwriting. Reports distinguish
selected agents from unique filesystem outcomes.

### Verification

Select two ids sharing a root, deselect one, and verify files remain and the
manifest records only the survivor. Deselect the last id and verify only
marker-owned files are removed. Test invalid JSON, symlink ancestors, and
repeatable updates.

## D-004: Extend the dependency-free prompt as pure state and rendering

Status: Accepted

### Evidence

The existing selector already owns raw-mode lifecycle and has pure state/reducer
tests, but clears the entire screen and renders only five rows. The required
interaction needs search, viewport, width safety, and reliable cleanup. Adding a
prompt dependency would still require custom status/path rows and shared
selection behavior.

### Options

- Add `@clack/prompts` plus a separate custom searchable multiselect.
- Copy the upstream prompt implementation wholesale.
- Extend Empirical's selector with independently implemented pure search,
  viewport, renderer, and a thin TTY adapter.

### Chosen approach

Extend the local dependency-free prompt. Keep every state transition and frame
render testable without a TTY, then use one small adapter for keypresses, raw
mode, cursor visibility, and atomic redraw.

### Trade-offs and risks

Empirical owns more terminal code, including width truncation and cleanup.
Bounded, ANSI-independent frames simplify this work and targeted pseudo-terminal
tests cover the remaining lifecycle risk without adding production dependencies.

### Verification

Snapshot narrow/normal/wide frames, test filtering and scrolling, and exercise
submit/cancel/Ctrl-C in a real pseudo-terminal while confirming raw mode and the
cursor are restored.
