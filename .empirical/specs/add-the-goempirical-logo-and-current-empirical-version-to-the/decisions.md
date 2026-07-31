# Decisions: GoEmpirical CLI Branding

## D-001: Use a terminal-native interpretation of the official mark

Status: Accepted

### Evidence

- GoEmpirical's official site embeds a lowercase wordmark beside a three-part
  red (`#F43737`), yellow (`#FFCD15`), and blue (`#4A5CFF`) symbol.
- Hermes' official CLI banner implementation uses terminal artwork and exposes
  the runtime version in the startup identity.
- Empirical currently has no runtime UI dependency and supports Node.js 20 on
  macOS, Linux, and Windows.

### Options

1. Emit the official SVG through terminal-specific image escape protocols.
2. Add a FIGlet/Rich-style rendering dependency and create a large text logo.
3. Render a small Unicode/ANSI interpretation of the three-part mark with a
   plain-text fallback.

### Chosen approach

Use option 3. Preserve the mark's three-part topology, position, and official
colors, pair it with the lowercase wordmark, and keep the wordmark in the
terminal's native foreground color.

### Trade-offs and risks

The terminal mark is an interpretation rather than the vector artwork, but it
is portable, legible without color, package-size neutral, and does not require
terminal-specific graphics support.

### Verification

Review wide, compact, colored, and plain captures against the official mark;
unit-test the exact brand colors and stripped plain output.

## D-002: Brand only the public startup/help boundary

Status: Accepted

### Evidence

- No command and the three help aliases already converge on `printHelp()`.
- Exact version output, JSON, stdio MCP, and private operations are consumed by
  scripts or agents and require uncontaminated stdout.
- The generic `emit()` helper serves both human and automation operations.

### Options

1. Prefix every CLI response from the generic emitter.
2. Prefix public install/update responses as well as help.
3. Render once inside `printHelp()` only.

### Chosen approach

Use option 3. It most closely matches a startup banner, produces exactly one
identity at the public entrypoint, and leaves protocol boundaries structurally
untouched.

### Trade-offs and risks

Users who invoke only `empirical install` or `empirical update` will not see the
banner. This avoids repetitive branding and preserves compact lifecycle output;
the normal discovery entrypoint remains branded.

### Verification

Spawn every help and version alias, parse representative JSON output, and run
the bundled MCP smoke suite.

## D-003: Prepare 0.20.4 without publishing it

Status: Accepted

### Evidence

- The current immutable release is `0.20.3`, making `0.20.4` the next patch.
- Package publication, tags, and remote pushes are externally mutating release
  steps not required to implement and verify the requested CLI behavior.

### Options

1. Keep version `0.20.3` while adding the display.
2. Prepare all version surfaces as `0.20.4` and stop after local verification.
3. Publish and tag `0.20.4` during implementation.

### Chosen approach

Use option 2. Keep all repository-owned version surfaces consistent and leave
publication for an explicit release request.

### Trade-offs and risks

The working tree identifies an unreleased next version. Tests and package dry
run prove internal integrity, while registry state intentionally remains
unchanged.

### Verification

Assert package/runtime/source/built version parity and inspect the package dry
run before handoff.
