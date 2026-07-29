# Design: native agent commands

## Decision

Model Empirical's five user-facing agent entrypoints once and render them into
each supported agent's native project-local extension format.

| Entrypoint | Purpose | Slash-capable agents | Codex |
|---|---|---|---|
| empirical | Route a request or resume | `/empirical` | `$empirical` |
| empirical-explore | Five-pass Socratic discovery | `/empirical-explore` | `$empirical-explore` |
| empirical-fast | Guarded tiny-change workflow | `/empirical-fast` | `$empirical-fast` |
| empirical-complex | Substantial-change workflow | `/empirical-complex` | `$empirical-complex` |
| empirical-loop | Resume active workflow | `/empirical-loop` | `$empirical-loop` |

Claude Code uses `.claude/skills/<name>/SKILL.md`, its current recommended
format for slash-invocable project skills. Cursor uses
`.cursor/commands/<name>.md`; Gemini CLI uses
`.gemini/commands/<name>.toml`; Windsurf uses
`.windsurf/workflows/<name>.md`; Codex uses
`.agents/skills/<name>/SKILL.md`. The existing generic `empirical` artifacts
remain compatible and four dedicated artifacts are added per agent.

## Generator structure

`src/integrations.ts` will define a typed entrypoint catalog containing name,
description, and workflow instructions. Small renderers will produce Agent
Skill Markdown, Cursor Markdown, Gemini TOML, and Windsurf Markdown from that
catalog. The current atomic managed-file writer remains the only persistence
path, preserving unmanaged files and symbolic links.

Dedicated instructions preserve the engine contract:

- Explore retrieves context, asks the five passes one at a time, refines the
  request, and waits for approval before selecting Fast or Complex.
- Fast checks eligibility and redirects ineligible work to Complex rather than
  weakening gates.
- Complex starts or continues the full seven-step workflow.
- Loop resumes the current workstream without accepting a new request.

## Integration report

Add `entrypoints` to `IntegrationReport`. Each record contains:

- stable agent identifier and display name;
- native kind (`skill` or `slash-command`);
- the five exact invocations;
- project artifact root;
- reload guidance.

Reports with integrations disabled use an empty `entrypoints` array. JSON and
the TypeScript API receive this field unchanged. Human `init` and `integrate`
output render the same records, preventing documentation and CLI behavior from
drifting apart.

## Compatibility and safety

- The report change is additive.
- Existing managed generic artifacts are refreshed in place.
- New paths pass through the existing managed marker, symlink checks, and
  atomic writer.
- Unmanaged collisions are preserved and listed in `preserved`.
- No global home-directory files are written.
- No workflow state or revision changes occur during integration.
- Codex is never described as supporting a project-defined slash command.

## Documentation

README and demo documentation will separate shell CLI commands from in-agent
commands and show exact reload behavior. Version advances to 2.3.1 because
2.3.0 is already published and this is a backward-compatible integration fix.

## Verification design

Integration tests enumerate all 25 managed entrypoint artifacts, assert native
syntax and task guards, prove repeatability, and verify unmanaged collisions.
CLI tests run `init` and `integrate` in temporary projects and assert the human
matrix and JSON metadata. The full CI, built distribution smoke, package dry
run, and clean packed-package initialization remain release gates.
