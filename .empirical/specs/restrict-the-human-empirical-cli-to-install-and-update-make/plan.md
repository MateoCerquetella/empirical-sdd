# Plan: Two-Command CLI And Agent Selector

1. Add `src/selector.ts` with typed selector items/state, initial preselection,
   pure key reduction, deterministic ANSI rendering, raw-TTY lifecycle, empty
   selection behavior, and cancellation cleanup. Add focused unit tests.
2. Extend global integration options with an exact agent target set and export
   safe discovery of marker-owned installed agents. Reconcile every supported
   agent so selected targets receive the one skill and deselected targets lose
   only marker-owned generic/obsolete files. Expand isolated-home tests.
3. Refactor CLI command classification so direct workflow verbs reject before
   project access, `__internal` routes existing operations, `mcp` remains an
   unlisted bootstrap, and help/no-args expose only Install and Update.
4. Implement selector resolution for interactive no-flag install, repeated
   `--agent`/`-a`, `--all`, and `--yes`/`-y`. Validate conflicts, unknown IDs,
   JSON/non-TTY missing selection, and no-write failure behavior. Add CLI tests.
5. Change Update to invoke `empirical install --yes`. Rewrite the generated
   single skill so MCP is primary and every fallback uses `__internal`. Update
   lifecycle and contract assertions.
6. Migrate tests and distribution smoke that intentionally exercise CLI
   workflow adapters to the private namespace. Prove direct public invocations
   reject while private and MCP behavior remain equivalent.
7. Rewrite README installation and usage from actual dispatch and selector
   behavior; remove the temporary local-release troubleshooting section. Update
   architecture, MCP, protocol, security, and demo references where they imply
   direct public workflow verbs.
8. Run TypeScript, selector/integration/CLI/lifecycle tests, full suite, built
   CLI/MCP smoke, package dry-run, and diff checks. Produce criterion evidence,
   review against D-001 through D-004, archive the capability delta, commit, and
   leave npm publication for explicit release approval.
