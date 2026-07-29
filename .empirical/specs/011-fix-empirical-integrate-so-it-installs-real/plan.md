# Plan: native agent commands

1. Extend the public integration report types with per-agent entrypoint metadata
   and ensure disabled integrations return an empty metadata list.
2. Refactor `src/integrations.ts` around a five-entrypoint catalog and native
   renderers, then generate managed Codex and Claude skills plus Cursor, Gemini,
   and Windsurf commands for every entrypoint.
3. Render the report metadata in human `init` and `integrate` output while
   preserving the full structured report in JSON mode.
4. Refresh this repository's managed agent artifacts and update README,
   architecture, and demo guidance to distinguish CLI, slash, and `$` skill
   invocations.
5. Add integration and CLI coverage for the 25 artifacts, workflow-specific
   safety instructions, report metadata, repeatability, and unmanaged-file
   preservation.
6. Bump the package to 2.3.1, run focused checks and the complete release suite,
   inspect the diff, verify a clean packed-package initialization, then submit
   evidence for Verify and Review before archiving the capability delta.
