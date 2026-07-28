# Global agent commands

Empirical ships one canonical set of workflows and installs them for every
supported agent host in one operation. Users never enable agents individually.

The official installer runs:

```bash
empirical agents sync
```

This writes only Empirical-namespaced commands:

| Host | Global destination | Commands |
|---|---|---|
| Shared Agent Skills | `~/.agents/skills/empirical-*/SKILL.md` | `empirical-*` |
| Codex | `~/.codex/skills/empirical-*/SKILL.md` | `$empirical-*` |
| Claude Code | `~/.claude/skills/empirical-*/SKILL.md` | `/empirical-*` |
| Gemini CLI | `~/.gemini/commands/empirical/*.toml` | `/empirical:*` |

Codex and Claude Code both consume `SKILL.md` bundles, so they receive the
same workflow content rather than divergent rewrites. Claude documents personal
skills at [`~/.claude/skills`](https://code.claude.com/docs/en/slash-commands),
Codex documents its skill installation under
[`$CODEX_HOME/skills`](https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/skill-installer/SKILL.md),
and Gemini documents global TOML commands under
[`~/.gemini/commands`](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md).

The pack updater uses a disposable hash manifest at
`~/.empirical/agent-packs.lock`. Clean Empirical-owned commands update; locally
modified or deliberately removed commands are preserved and reported. This
manifest is updater bookkeeping, never workflow state.

Available workflows:

- `empirical-init` — initialize a new project or adopt v1;
- `empirical-spec` — create/refine a Quick or Strong feature contract;
- `empirical-next` — perform exactly one phase;
- `empirical-loop` — continue until a real stop condition;
- `empirical-status` — report state without mutation;
- `empirical-verify` — collect tests, browser proof, and screenshot review; and
- `empirical-ship` — deliver only after evidence and review pass.

Agents that do not support these global formats still work from the committed
neutral `ai/` kit and the `empirical` executable. Host command discovery is a
convenience layer, not a dependency or state store.
