# Add Empirical Integrate Global So One Command

## Request

> Add empirical integrate --global so one command installs the five Empirical workflow skills globally for Codex, Claude Code, Cursor, Gemini CLI, and Windsurf using each agent's native user-level skills directory. It must work outside an initialized project, preserve unmanaged files, update Empirical-managed files safely, report exact installed paths and agent-specific invocation syntax, keep project-local integrate behavior, document install/update usage, and ship as npm patch 2.3.1.

## Goal

Let a developer install and refresh Empirical's standard workflows once at the
user level so Codex, Claude Code, Cursor, Gemini CLI, and Windsurf can discover
them in every project, using the same global-skill model as the Agent Skills
ecosystem without requiring an initialized Empirical repository.

## Acceptance Criteria

- [ ] [AC-1] `empirical integrate --global` succeeds outside an initialized
  project and installs the `empirical`, `empirical-explore`, `empirical-fast`,
  `empirical-complex`, and `empirical-loop` skills in the native user-level
  skills directories for Codex, Claude Code, Cursor, Gemini CLI, and Windsurf.
- [ ] [AC-2] A repeated global integration creates missing managed files,
  updates stale Empirical-managed files, leaves current managed files alone,
  and preserves every unmanaged file, directory, or symbolic link at a target
  path.
- [ ] [AC-3] Human output identifies the operation as global, lists the exact
  installed root for every agent, and gives accurate agent-specific discovery,
  invocation, or reload guidance without representing every skill as a slash
  command. JSON output exposes the same data in the integration report.
- [ ] [AC-4] Ordinary `empirical integrate`, `init`, and `adopt` remain
  project-scoped and do not write to user directories; their existing managed
  instructions, MCP configuration, commands, skills, and preservation behavior
  continue to work.
- [ ] [AC-5] Global installation validates every destination under the selected
  user home, writes files atomically, and can be exercised against an isolated
  temporary home in automated tests without modifying a developer's real agent
  configuration.
- [ ] [AC-6] README, command help, architecture, security, migration, and MCP
  documentation clearly distinguish project integration from optional global
  skills, show the install/update commands, and document all supported paths.
- [ ] [AC-7] Package metadata and generated version output are `2.3.1`, and the
  complete typecheck, test, build, package-content, and CLI smoke suites pass.

## Scope

- Add an explicit `--global` mode to `empirical integrate`; all five supported
  agents are installed in one operation.
- Install portable managed skill copies at `~/.codex/skills`,
  `~/.claude/skills`, `~/.cursor/skills`, `~/.gemini/skills`, and
  `~/.codeium/windsurf/skills`.
- Reuse the same five workflow contracts already generated for project-local
  entrypoints.
- Expose a TypeScript global-integration function that accepts an explicit home
  root for safe tests and embedding; the CLI uses the operating-system home.
- Retain the pending project-local dedicated command and report improvements
  begun in the superseded workstream, because they remain compatible with and
  complementary to global skills.
- Publish the completed result as the npm patch release `2.3.1` after review.

## Non-goals

- Silently writing to user directories during `init`, `adopt`, or ordinary
  `integrate`.
- Installing or launching an AI runtime, changing an agent's global MCP
  configuration, or installing repository dependencies.
- Inventing a universal slash-command syntax: each agent keeps its documented
  skill discovery and invocation behavior.
- Removing legacy project-local integrations or user-owned integrations.
- Adding per-agent selection, uninstall, remote skill registries, symlink
  management, or network access in this patch.

## Risks

- Global paths are durable user configuration; accidental overwrite would be
  high impact. Managed markers, root containment, symlink preservation, and
  isolated-home tests are mandatory.
- Agents differ in how global skills are surfaced. Output and documentation
  must name the real syntax or discovery action instead of promising slash
  commands universally.
- User-level directories and path separators differ across platforms. Resolve
  paths with Node APIs and test platform-independent path handling.
- Direct managed copies can become stale after an npm update. The documented
  refresh operation must be idempotent and update only Empirical-owned files.

## Verification

- Unit and integration tests install into a temporary home and assert all 25
  skill files, frontmatter, workflow distinctions, repeated refresh behavior,
  unmanaged-file and symlink preservation, and containment.
- CLI tests run `integrate --global` outside a project with an isolated home and
  assert both human and JSON reports, then confirm ordinary integration still
  requires and changes only an initialized project.
- Existing integration, discovery, workstream, migration, concurrency, and MCP
  tests remain green.
- Run `bun run check`, `bun test`, `bun run build`, `npm pack --dry-run`, and
  smoke-test the built CLI version/help/global integration in a temporary home.

## Capability Deltas

See `deltas/agent-integrations.md`.
