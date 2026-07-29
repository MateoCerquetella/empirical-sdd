# Design: global Agent Skills installation

## Decision

Add an explicit global branch to `empirical integrate`:

```text
empirical integrate             -> existing project integration
empirical integrate --global    -> user-level skills for all agents
```

The global branch runs before opening `EmpiricalProject`, so it works from any
directory and cannot create or mutate `.empirical/` state. It calls a new
exported `installGlobalAgentSkills(homeRoot?)` function. The optional explicit
home root exists for embedders and isolated tests; normal CLI use resolves the
operating-system home with `node:os`.

## Global layout

Empirical will write managed copies rather than symbolic links. This matches the
portable copy mode supported by the Agent Skills ecosystem and avoids Windows
symlink privileges while retaining deterministic safe updates.

| Agent | User-level skill root | User interaction |
|---|---|---|
| Codex | `~/.codex/skills` | invoke `$empirical*` |
| Claude Code | `~/.claude/skills` | invoke `/empirical*` |
| Cursor | `~/.cursor/skills` | discover Empirical Agent Skills in Cursor |
| Gemini CLI | `~/.gemini/skills` | run `/skills reload`; skills activate from requests |
| Windsurf | `~/.codeium/windsurf/skills` | invoke `@empirical*` |

Each root receives five `<name>/SKILL.md` files: `empirical`,
`empirical-explore`, `empirical-fast`, `empirical-complex`, and
`empirical-loop`. The generic `SKILL` body and dedicated skill renderer become
shared generators used by both project and global integration.

## Safety boundary

`installGlobalAgentSkills` resolves the supplied home once and rejects an empty
or filesystem-root home. Every target is resolved and verified to be a strict
descendant of that root before any write. The existing managed-file writer is
reused with the home as its containment/reporting root.

Persistence keeps the existing rules:

- missing `SKILL.md` files are written atomically;
- files containing `empirical-sdd:managed-file` may be refreshed;
- equal managed files are untouched;
- unmanaged files and symbolic links are preserved and reported;
- a directory at the `SKILL.md` target is preserved rather than replaced;
- a symbolic link in any target path is not followed.

The last rule requires checking the full path from the home to the target, not
only the final file. This strengthens both project and global integration
against parent-directory symlink escapes.

## Report model

`IntegrationReport` gains a `scope: "project" | "global"` discriminator.
`AgentEntrypointReport` remains the shared structured record and uses a more
general `kind` value for native skills. Project reports retain current
project-local command syntax. Global reports contain expanded native skill
roots and agent-accurate interaction guidance.

The human renderer uses the scope to label either `Imported project
entrypoints` or `Installed global skills`. It prints each agent, exact root,
five relevant invocations or discoverable skill names, and reload guidance.
JSON returns the same report without a second source of truth.

## CLI and API

`case "integrate"` consumes `--global`. With the flag it rejects remaining
arguments, installs global skills, emits the global report, and returns without
opening a project. Without the flag it retains the current project path and
argument validation.

`src/index.ts` exports `installGlobalAgentSkills`. MCP remains project-scoped:
global home mutation is an explicit human terminal operation, not an ambient
agent tool side effect.

## Compatibility

- Existing `init`, `adopt`, `integrate`, and `empirical_integrate` behavior
  remains project-local.
- Project-local dedicated command work from the superseded contract is retained
  and tested.
- Report additions are additive to the public API.
- No global MCP configuration, hooks, dependencies, network calls, or runtimes
  are introduced.
- The package version advances to 2.3.1.

## Verification design

Tests use `mkdtemp` and pass that directory directly to the exported installer.
They enumerate 25 global files, check each skill's frontmatter and distinct
workflow instructions, rerun for convergence, mutate one managed file to prove
refresh, and place unmanaged files and symlinks to prove preservation.

CLI tests run the built command with an isolated OS home/environment from a
non-project directory, check human and JSON output, and verify that no
`.empirical` directory appears. Existing project integration tests prove the
scope boundary and the 25 project-local entrypoints. Full typecheck, test,
build, npm pack dry-run, and packed-package smoke checks are release gates.
