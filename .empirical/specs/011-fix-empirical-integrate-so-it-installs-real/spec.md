# Fix Empirical Integrate So It Installs Real

## Request

> Fix empirical integrate so it installs real user-invocable Empirical commands for every supported agent: add the missing Claude slash command, retain and verify Cursor, Gemini, and Windsurf commands, expose Codex through its supported project skill invocation, report exact per-agent command names after integration, update documentation, and add integration tests that prove every generated command artifact and invocation.

## Goal

`empirical integrate` installs discoverable, user-invocable Empirical entrypoints
in each supported agent's native project format and tells the user exactly how
to invoke or reload them. Agents with slash-command support expose slash
commands; Codex exposes the equivalent `$` project skills without pretending
that Codex supports custom project slash commands.

## Acceptance Criteria

- [ ] [AC-1] A fresh `empirical init` and an existing-project `empirical
  integrate` create managed Empirical, Explore, Fast, Complex, and Loop
  entrypoints for Codex, Claude Code, Cursor, Gemini CLI, and Windsurf in each
  agent's supported project-local format.
- [ ] [AC-2] Claude Code, Cursor, Gemini CLI, and Windsurf expose
  `/empirical`, `/empirical-explore`, `/empirical-fast`,
  `/empirical-complex`, and `/empirical-loop`; Codex exposes the matching
  `$empirical*` skills and no output claims that Codex supports project-defined
  slash commands.
- [ ] [AC-3] Each dedicated entrypoint preserves the workflow contract:
  Explore performs the five-pass Socratic interview and approval gate, Fast is
  restricted to tiny low-risk non-UI work, Complex handles substantial work,
  and Loop resumes without starting or replacing work.
- [ ] [AC-4] Human `empirical integrate` output lists the exact invocations and
  reload guidance per agent, while JSON/API integration reports expose the same
  information in a stable machine-readable field.
- [ ] [AC-5] Integration remains repeatable and preserves unmanaged files,
  symbolic links, existing instructions outside managed blocks, workflow state,
  and unrelated workstreams.
- [ ] [AC-6] Documentation distinguishes terminal CLI commands, slash commands,
  and Codex `$` skills and gives an accurate existing-project installation
  sequence.

## Scope

- Generate generic and dedicated project entrypoints for all five supported
  agent integrations.
- Add invocation metadata to integration reports and render it in CLI output.
- Refresh managed repository artifacts, tests, architecture, demos, and README.
- Publish the correction as a patch release after verification.

## Non-goals

- Adding an unsupported custom slash-command mechanism to Codex.
- Writing global commands into a user's home directory.
- Forcing a running agent process to reload project configuration.
- Launching an AI runtime from `init` or `integrate`.
- Changing workflow phase semantics or evidence gates.

## Risks

- Agent command formats evolve independently; generated artifacts must stay
  simple and follow current official project-local conventions.
- A dedicated Fast command could be misused; its instructions must retain the
  eligibility guard and route ineligible work to Complex.
- Existing unmanaged files may use the same path; integration must preserve and
  report them rather than overwrite them.

## Verification

- Integration tests assert every expected artifact, native invocation, managed
  marker, task-specific guard, repeatable refresh, and unmanaged-file behavior.
- CLI tests assert readable per-agent invocation and reload output plus JSON
  metadata.
- Typecheck, complete test suite, built CLI/MCP smoke, and package dry-run pass.
- A clean install of the packed package initializes a temporary project whose
  generated entrypoints match the documented command matrix.

## Capability Deltas

- `deltas/agent-integrations.md`
