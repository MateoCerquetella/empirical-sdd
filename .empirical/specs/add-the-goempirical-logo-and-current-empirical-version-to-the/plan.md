# Plan: GoEmpirical CLI Branding

## 1. Build the pure branding renderer

- Add `src/branding.ts` with official brand colors, wide/compact mark layouts,
  ANSI helpers, and stdout capability detection.
- Add `tests/branding.test.ts` before implementation to cover plain output,
  layout selection, color parity, `NO_COLOR`, `TERM=dumb`, and redirection.
- Keep the renderer dependency-free and deterministic under explicit options.

Verification: `bun test tests/branding.test.ts` and `bun run check`.

## 2. Integrate the public help boundary

- Import the renderer into `src/cli.ts` and prepend exactly one banner from
  `printHelp()`.
- Preserve the existing lifecycle/installer/agent-skill help body.
- Extend `tests/integrations.test.ts` for no-command and every help/version
  alias, including absence of ANSI in captured output.
- Confirm JSON, MCP, private operations, installer selector, and stderr paths do
  not use the banner.

Verification: focused CLI integration tests plus direct source CLI invocations.

## 3. Prepare version 0.20.4

- Update `package.json`, `src/types.ts`, `tests/core.test.ts`, and
  `scripts/smoke-mcp.ts` from `0.20.3` to `0.20.4`.
- Extend bundled smoke assertions to prove help is branded and all version
  aliases remain exact.
- Search the repository for unintended stale product-version assertions.

Verification: core version test, distribution smoke, and npm package dry run.

## 4. Verify the complete result

- Capture plain compact help from redirected output.
- Capture colored wide and compact banners in a real/pseudo terminal for visual
  comparison with GoEmpirical's official three-part mark.
- Run `bun run ci` and `git diff --check`.
- Record criterion-level test, browser, screenshot, and review evidence required
  by repository policy; repair any failure before Review.

## 5. Review and archive

- Review behavior, automation safety, cross-platform terminal assumptions,
  version consistency, accepted decisions, and the complete diff.
- Apply the validated `cli-branding` delta to the living capability archive.
- Stop with local `0.20.4` prepared; do not publish, tag, push, or create a
  remote release.
