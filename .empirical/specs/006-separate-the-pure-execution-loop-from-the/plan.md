# Plan

1. Add `fast` and `complex` wrappers to the core engine and reduce `loop` to a
   zero-input read/resume operation.
2. Add `empirical fast`, `empirical complex`, complete default packet
   rendering, and direct Fast test/review shortcuts; keep low-level
   programmatic compatibility outside the normal help path.
3. Add `empirical_fast` and `empirical_complex` MCP tools and simplify
   `empirical_loop` to root-only input.
4. Regenerate automatic skills, repository guidance, and native command text
   around two SDD workflows plus the pure runner.
5. Update core, MCP, integration safety, built CLI, concurrency, legacy-state,
   installer, and compatibility tests; revise README and protocol documentation.
6. Run full CI, reinstall the package, refresh `hello-world-harness`, and prove
   the generated files and clean-session instructions match the corrected UX.
