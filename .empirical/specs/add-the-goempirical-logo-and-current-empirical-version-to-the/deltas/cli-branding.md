# CLI Branding

## Purpose

Give the public Empirical CLI a recognizable GoEmpirical identity without
weakening terminal portability or structured automation contracts.

## ADDED Requirements

### Requirement: Public help has a GoEmpirical startup identity

The public no-command and help entrypoints MUST render a terminal-native
GoEmpirical banner before command guidance. The banner MUST include a faithful
three-part representation of the official red, yellow, and blue mark, the
Empirical wordmark, and the exact running product version from the package's
canonical version constant.

#### Scenario: A developer opens the Empirical CLI

- **WHEN** the developer runs `empirical` or a public help alias
- **THEN** one GoEmpirical banner appears before the existing public guidance
- **AND** the displayed version matches the running package version

### Requirement: Branding adapts safely to terminal capabilities

The banner MUST provide readable wide and compact layouts, MUST use brand color
only for an interactive color-capable output, MUST honor the `NO_COLOR`
convention, and MUST NOT emit ANSI control sequences to redirected output.

#### Scenario: Help is redirected or color is disabled

- **WHEN** standard output is not a terminal or `NO_COLOR` is present
- **THEN** the banner remains recognizable in plain text
- **AND** the complete output contains no ANSI escape sequences

#### Scenario: The terminal is narrow

- **WHEN** the available width cannot contain the wide wordmark
- **THEN** Empirical renders the compact identity without clipping content

### Requirement: Automation output remains unbranded

Branding MUST NOT prefix exact version output, structured JSON, the stdio MCP
transport, private agent automation, or error streams.

#### Scenario: A script reads the installed version

- **WHEN** it invokes `empirical --version`, `empirical -v`, or `empirical version`
- **THEN** stdout contains only the semantic version and one newline

#### Scenario: A client requests structured output

- **WHEN** it invokes a supported operation with `--json` or starts `empirical mcp`
- **THEN** stdout begins with the requested protocol payload rather than a banner
