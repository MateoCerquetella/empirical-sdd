# Design: GoEmpirical CLI Branding

## Context

The public terminal surface currently opens directly with `Empirical
v<version>` followed by help. Hermes establishes its identity with a startup
logo and a version-bearing banner title, while leaving its exact `--version`
command independent. GoEmpirical's official web wordmark uses a three-part
symbol with blue at the top, yellow at lower left, and red at lower right.

Empirical has no runtime styling dependency and its stdout also carries JSON,
MCP frames, and private agent transport. Branding therefore belongs at the
public help boundary rather than in the generic output emitter.

## Rendering model

Add `src/branding.ts` as a pure, dependency-free renderer. It owns:

- the official GoEmpirical RGB values `#4A5CFF`, `#FFCD15`, and `#F43737`;
- a terminal-native multi-line approximation of the three-part symbol;
- wide and compact composition with the lowercase `empirical` wordmark and
  `v${PRODUCT_VERSION}`;
- ANSI true-color wrapping and terminal-capability detection.

The renderer accepts explicit width/color options so tests do not depend on the
host terminal. A small stdout adapter derives those options from
`process.stdout.isTTY`, `process.stdout.columns`, `TERM`, and the presence of
`NO_COLOR`. Redirected output and `TERM=dumb` always use plain text.

Representative layouts:

```text
       (blue top)
  (yellow) (red)    empirical
                    v0.20.4
```

Wide output places the wordmark/version beside the mark. Compact output stacks
the identity below the mark so no logical line exceeds the supported narrow
layout width. ANSI styles change color only; stripping escape sequences yields
the exact plain layout.

## CLI integration

`printHelp()` renders the banner followed by the existing lifecycle, installer,
and agent-skill guidance. The no-command path and all three public help aliases
already converge on this function, guaranteeing one banner without changing
command routing.

The version aliases return before help rendering and remain a bare semantic
version. `install --json`, internal JSON operations, and `mcp` never call
`printHelp()`, so their protocol payloads remain unchanged. Errors stay on
stderr and do not receive branding. Interactive installer rendering remains
unchanged.

## Version preparation

Advance the next patch version to `0.20.4` in:

- `package.json`;
- `src/types.ts` (`PRODUCT_VERSION`);
- source assertions in `tests/core.test.ts`;
- built distribution assertions in `scripts/smoke-mcp.ts`.

The package lock does not duplicate the root package version. Registry publish,
Git tag creation, and remote mutation are separate release operations.

## Verification strategy

- Add focused renderer tests for exact plain layouts, wide/compact selection,
  three official ANSI colors, `NO_COLOR`, `TERM=dumb`, and redirected output.
- Extend public CLI tests to assert the banner/wordmark/version on all help
  aliases and exact unbranded output on all version aliases.
- Extend built smoke coverage with the same public boundary checks.
- Capture wide and compact rendered output for visual review.
- Run the complete `bun run ci` pipeline and `git diff --check`.

## Risks and mitigations

- Unicode terminal width varies: use only single-column box/ring characters in
  the mark and test logical widths; retain a compact layout.
- ANSI bytes could corrupt automation: centralize color gating and integrate
  only through public help.
- Dark terminal themes could hide the web wordmark's navy color: leave the
  wordmark in the terminal's foreground color and apply brand color only to the
  symbol.
- A future version could drift: interpolate `PRODUCT_VERSION` at render time
  and retain distribution consistency assertions.
