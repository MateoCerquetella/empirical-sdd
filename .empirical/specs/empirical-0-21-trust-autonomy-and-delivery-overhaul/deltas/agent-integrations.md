# Agent Integrations

## Purpose

Expose one registry-driven six-skill workflow with an explicit autonomous mode.

## MODIFIED Requirements

### Requirement: Explicit global skill installation

Empirical SHALL provide an interactive `empirical install` selector outside an
initialized project over the pinned audited agent catalog. It MUST prioritize
detected and managed targets, remember explicit selection, show destinations and
status, accept non-interactive flags, and install exactly every entry in the
shared skill registry: `empirical`, `empirical-init`, `empirical-spec`,
`empirical-socratic`, `empirical-loop`, and `empirical-yolo`. Counts and labels
MUST derive from that registry. Installation MUST NOT initialize project state,
require network access, invoke `npx`, or launch an agent.

#### Scenario: A developer installs one selected target

- **WHEN** selection is submitted
- **THEN** exactly the six registered skills are reconciled at its safe destination
- **AND** reports derive the installed count from the same registry

### Requirement: Native user-invocable workflow entrypoints

The system SHALL expose six global Empirical skills per selected agent. The
automatic skill routes end to end; Init only configures context; Spec drafts a
concrete Complex contract; Socratic conducts five-pass discovery; Loop resumes
selected work; and YOLO records bounded standing authorization and runs through
the authorized completion ceiling while asking only blocker product questions.
Every skill MUST use MCP first and MAY use only private internal transport as
fallback.

#### Scenario: A developer invokes YOLO for implementation only

- **WHEN** the current repository has an approved specification
- **THEN** YOLO resumes it through the highest locally authorized safe completion
- **AND** does not infer remote delivery or publication authorization

### Requirement: Honest command discovery report

Root and subcommand help and README MUST present only `empirical install`,
`empirical update`, and the six native in-agent skills. Each public subcommand
MUST provide usable `--help`. Direct state-machine verbs remain private and MUST
be rejected as human terminal commands.

#### Scenario: A developer asks for install help

- **WHEN** the developer runs `empirical install --help`
- **THEN** help documents install options without starting selection or mutation
- **AND** it identifies all six registry-backed in-agent workflows
