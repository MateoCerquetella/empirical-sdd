# Plan: One Empirical Entrypoint

1. Extend public types for removed integration artifacts, repository knowledge,
   detected agents, handoff offers/authorization, and packet knowledge paths.
   Add focused fixtures before changing generated integrations.
2. Create `src/agents.ts` with one supported-agent catalog, injectable PATH/home
   detection, CLI versus workspace capability classification, exact handoff
   proposals, approval tokens, and stale/current-feature validation. Expose
   read-only MCP and hidden CLI handoff operations.
3. Refactor `src/integrations.ts` to render one semantic skill into each native
   global format, install only detected or previously managed agents, remove
   obsolete marker-owned global/project targets safely, preserve runtime/MCP
   configuration, and report created/updated/removed/preserved paths. Add
   `empirical install`, retain the global integrate alias, and simplify help.
4. Extract lifecycle process execution so `empirical update` can be tested. Run
   npm global update first, then invoke the newly installed `empirical install`;
   surface stage-specific failures and convergence output.
5. Create `src/knowledge.ts` with Git-aware and bounded fallback inventory,
   secret/build/dependency exclusions, content digests, atomic byte-stable
   manifest/index refresh, preserved topic pages, and typed status. Invoke it
   during initialization, expose internal CLI/MCP refresh, and add
   `knowledgeContext` to discovery and action packets.
6. Add checkout-local active feature ownership in `src/storage.ts` or a focused
   checkout module. Claim legacy state before proposing worktrees, ignore claims
   owned by other registered checkouts, select the intended feature after start,
   clear on Done, and retain deterministic non-Git and clone recovery.
7. Rewrite the single generated Empirical contract to own initialization,
   context refresh, resume, Socratic discovery, internal Fast/Complex routing,
   exact completion, and the post-Specify Continue/Save/detected-agent choice.
   Remove dedicated project/global generated skills and update installer reports.
8. Update README and maintained architecture/security/demo/migration documents
   to show one installation command, one update command, and one per-agent
   invocation. Keep advanced compatibility operations documented only for
   automation/API reference.
9. Run focused lifecycle, integration, knowledge, discovery, handoff, core, and
   real-worktree suites; repair regressions. Run TypeScript and `git diff
   --check`, then the complete CI including build, CLI/MCP smoke, package dry
   run, and clean packed-consumer verification.
10. Produce criterion-by-criterion verification evidence, review the final diff
    against accepted decisions D-001 through D-005, archive validated capability
    deltas, and leave publication as a separate explicit release action.
