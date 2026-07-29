# Agent integrations

## Purpose

Make Empirical workflows discoverable and safely invocable from each supported
coding agent using that agent's native project-local extension mechanism.

## ADDED Requirements

### Requirement: Native user-invocable workflow entrypoints

The system SHALL install managed, project-local Empirical, Explore, Fast,
Complex, and Loop entrypoints in every supported agent's native extension
format. Slash-capable agents SHALL expose slash commands, while Codex SHALL use
its supported `$` skill invocation.

#### Scenario: Fresh project imports workflow commands

- **GIVEN** a project initialized by the current Empirical package
- **WHEN** a user opens a supported agent in that project
- **THEN** the user can discover and invoke the generic, Explore, Fast, Complex,
  and Loop entrypoints using that agent's native syntax
- **AND** each entrypoint retains the appropriate workflow and safety contract

#### Scenario: Existing project refreshes commands safely

- **GIVEN** an existing initialized project with workflow state and user-owned
  files
- **WHEN** the user runs `empirical integrate`
- **THEN** missing managed entrypoints are added and stale managed entrypoints
  are refreshed
- **AND** unmanaged files, symbolic links, workflow state, and unrelated
  workstreams are preserved

### Requirement: Honest command discovery report

The system SHALL report the exact native invocation and reload guidance for
each supported agent after integration and SHALL expose equivalent structured
metadata to API and JSON consumers.

#### Scenario: Codex invocation is not misrepresented

- **GIVEN** integration completes successfully
- **WHEN** the human-readable command summary is displayed
- **THEN** Codex is shown with `$empirical*` project skills
- **AND** Claude Code, Cursor, Gemini CLI, and Windsurf are shown with their
  `/empirical*` commands
- **AND** the output does not claim that Codex imported a custom project slash
  command
