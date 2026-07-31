# Plan: Empirical Setup Wizard And Broad Agent Installer

## Execution Rules

- Preserve unrelated user changes and the existing public CLI boundary.
- Use `apply_patch` for source/docs/test edits.
- Keep global skill installation, project MCP bridges, and executable handoff in
  separate types and code paths.
- Do not introduce runtime network, telemetry, or `npx` execution.
- Run focused tests after each slice and full `bun run ci` before Review.

## 1. Establish The Typed Agent Catalog

Files:

- Add `src/agent-catalog.ts`.
- Update `src/types.ts` and `src/index.ts`.
- Add `tests/agent-catalog.test.ts`.

Tasks:

1. Record upstream repository, version 1.5.21, and commit
   `7cb7db64dc1201052dea305e508a2fc490f7e5e2`.
2. Check in all 75 upstream ids in stable order, with 73 safe global paths and
   explicit Eve/PromptScript project-only reasons.
3. Add display names, legacy aliases, conservative detection hints, and verified
   guidance/capability metadata for the original five.
4. Export alias resolution, path resolution, catalog validation, global-only
   filtering, and detection helpers.
5. Keep the five handoff ids distinct; retain compatibility exports.
6. Test counts, provenance, unique ids/aliases, safe paths, shared roots,
   exclusions, deterministic order, and install-vs-handoff separation.

Criteria: AC-9, AC-12, AC-13, AC-14.

Focused verification:

```text
bun test tests/agent-catalog.test.ts tests/agents.test.ts
bun run check
```

## 2. Add Complete Evidence Configuration Parity

Files:

- Update `src/types.ts`, `src/core.ts`, `src/storage.ts`, `src/mcp.ts`, and
  `src/cli.ts`.
- Update `tests/core.test.ts`, `tests/cli-config.test.ts`, and `tests/mcp.test.ts`.

Tasks:

1. Add partial evidence fields to `ProjectConfigurationInput`.
2. Default and normalize all four evidence booleans to true, including older
   schema-4 documents with missing fields.
3. Merge evidence, isolation, and decision inputs independently during Init and
   Configure so omitted repair values survive.
4. Add MCP booleans `evidenceRequired`, `browserForUi`, `screenshotForUi`, and
   `codeReview` to Init/Configure and return the full effective config.
5. Add private CLI `on|off` flags and include evidence values in human output.
6. Prove criterion evidence can be off while code review remains on, and UI
   sub-policy values survive disable/re-enable.

Criteria: AC-2, AC-3, AC-4, AC-6, AC-7.

Focused verification:

```text
bun test tests/core.test.ts tests/cli-config.test.ts tests/mcp.test.ts
bun run check
```

## 3. Reconcile Broad Global Installations Safely

Files:

- Update `src/integrations.ts`, `src/types.ts`, and `src/index.ts`.
- Update `tests/integrations.test.ts`.

Tasks:

1. Replace global use of the handoff registry with the global-capable catalog.
2. Resolve aliases before mutation and reject unknown/project-only ids clearly.
3. Implement safe read/write of
   `~/.empirical-sdd/integrations.json`, preserving invalid or unmanaged
   collisions and writing only after successful reconciliation.
4. Determine selection from explicit/all/yes/interactive inputs according to the
   design; retain conservative original-five marker inference for legacy homes.
5. Group catalog entries by normalized root, write/remove the five skills once
   per physical root, and keep a root while any selected id references it.
6. Broaden entrypoint reports with canonical ids, unique roots, verified-guidance
   state, and separate MCP/handoff capability flags.
7. Test 73-target all mode, shared-root deselection, remembered selection,
   aliases, update/yes behavior, unmanaged collisions, symlinks, and convergence.

Criteria: AC-9, AC-10, AC-11, AC-12, AC-13, AC-14.

Focused verification:

```text
bun test tests/integrations.test.ts tests/agents.test.ts
bun run check
```

## 4. Build The Searchable Terminal Selector

Files:

- Rewrite `src/selector.ts`.
- Update `src/cli.ts`.
- Rewrite `tests/selector.test.ts` and add a pseudo-terminal fixture/test if the
  platform supports it.

Tasks:

1. Add query-aware pure state and filtering over label/id/alias/path.
2. Prioritize detected or installed entries while keeping stable catalog order.
3. Add an eight-row centered viewport, hidden-row counts, selected summary,
   status hints, and terminal-width truncation.
4. Map printable input, Backspace, arrows, space, Enter, Escape, and Ctrl-C.
5. Redraw one bounded frame atomically and restore raw mode, cursor visibility,
   listeners, and input state on every exit.
6. Drive interactive install from the broad catalog and remembered selection.
7. Snapshot 40/80/120-column frames and test search, scroll, toggle, submit,
   empty selection, cancellation, and cleanup.

Criteria: AC-8, AC-10, AC-12.

Focused verification:

```text
bun test tests/selector.test.ts tests/integrations.test.ts
bun run check
```

## 5. Implement The Setup Summary And Approval Flow

Files:

- Update generated skill bodies in `src/integrations.ts`.
- Update private setup flow and renderers in `src/cli.ts`.
- Update `tests/integrations.test.ts` and `tests/cli-config.test.ts`.

Tasks:

1. Make automatic and explicit Init instructions render current/recommended
   Verification, Parallel work, and Decisions sections before mutating Init.
2. Require Apply/Keep, Customize, or Cancel; customize one section at a time;
   show inactive evidence dependencies; render a final Save/Edit/Cancel review.
3. Require explicit evidence/isolation/decision MCP parameters after Save and no
   MCP Init call on Cancel.
4. Refactor the private TTY fallback to build a read-only default/current preview
   and prompt before `EmpiricalProject.initialize` or Configure writes.
5. Validate customization values and loop Edit without partial writes.
6. Test first-run Apply, custom save, existing keep/edit, dependency text,
   cancel-before-layout, and absence of internal profile/repair settings.

Criteria: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7.

Focused verification:

```text
bun test tests/cli-config.test.ts tests/integrations.test.ts
bun run check
```

## 6. Documentation, Packaging, And End-To-End Verification

Files:

- Update `README.md`, `docs/demo.md`, `docs/architecture.md`, `docs/mcp.md`, and
  any CLI help text.
- Update package/smoke expectations where the catalog changes counts/output.

Tasks:

1. Document the in-agent wizard, four evidence settings, searchable 73-global
   selector, aliases, remembered selection, and install/MCP/handoff boundary.
2. Keep public help limited to Install and Update and list noninteractive flags
   accurately.
3. Run focused tests as a single regression set.
4. Run a real TTY selector session against an isolated temporary home and capture
   concise test evidence; cancel before any real home mutation.
5. Run full CI and package dry-run.
6. Check diff, generated declarations/bundle behavior, secrets, path safety, and
   every AC mapping before Review.

Criteria: AC-1 through AC-15, especially AC-15.

Final verification:

```text
bun test
bun run ci
git diff --check
```

## Acceptance-Criteria Matrix

| Criterion | Primary implementation | Primary evidence |
| --- | --- | --- |
| AC-1 | Init skill + pre-write private setup flow | cancel/first-run tests |
| AC-2 | evidence input/default/renderer | core, CLI, MCP tests |
| AC-3 | setup sections | CLI/skill snapshots |
| AC-4 | evidence dependency semantics | core + copy tests |
| AC-5 | customization/review loop | CLI interaction tests |
| AC-6 | partial merge + existing preview | repair tests |
| AC-7 | TypeScript/MCP/private flags | type, MCP, CLI tests |
| AC-8 | selector state/renderer/TTY adapter | width snapshots + PTY |
| AC-9 | pinned catalog | catalog validation tests |
| AC-10 | manifest/detection/search | selector + integration tests |
| AC-11 | root-group reconciliation | shared-root/symlink tests |
| AC-12 | alias and mode compatibility | CLI integration tests |
| AC-13 | separate registries | catalog + handoff tests |
| AC-14 | report metadata/rendering | human/JSON tests |
| AC-15 | docs/help/generated skills | content + package tests |
