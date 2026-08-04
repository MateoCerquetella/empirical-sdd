## Purpose

Make Empirical workflows discoverable and safely invocable either from one
repository or globally across a developer's projects using each supported
agent's native extension mechanism.

## ADDED Requirements

### Requirement: Safe global uninstall is explicit and ownership-bound

Empirical SHALL provide `empirical uninstall` outside initialized repositories.
It MUST show the complete global removal and project-preservation scope before
interactive mutation, default to cancellation, require `--yes` for
non-interactive or JSON execution, remove only marker-owned current or obsolete
global skills and valid Empirical-owned selection metadata, preserve and report
unsafe or unmanaged targets, and invoke exact shell-free global npm package
removal only after integration cleanup succeeds. Repeated cleanup MUST converge.

#### Scenario: A developer confirms global removal

- **WHEN** the user approves uninstall with managed and unmanaged targets present
- **THEN** all Empirical-managed global skills and owned selection metadata are removed
- **AND** unmanaged files, repository history, and project MCP configuration remain unchanged
- **AND** `npm uninstall -g empirical-sdd` runs last

#### Scenario: Automation omits confirmation

- **WHEN** stdin is non-interactive or structured output is requested without `--yes`
- **THEN** uninstall refuses before changing files or invoking npm

## MODIFIED Requirements

### Requirement: Honest command discovery report

Root and subcommand help and README MUST present only `empirical install`,
`empirical update`, `empirical uninstall`, and the six native in-agent skills.
Each public subcommand MUST provide usable `--help`. Direct state-machine verbs
remain private and MUST be rejected as human terminal commands. Uninstall help
MUST distinguish removed global artifacts from preserved project state.

#### Scenario: A developer asks for uninstall help

- **WHEN** the developer runs `empirical uninstall --help`
- **THEN** help documents confirmation, global removal, and project preservation without mutation
- **AND** it does not expose private workflow commands
