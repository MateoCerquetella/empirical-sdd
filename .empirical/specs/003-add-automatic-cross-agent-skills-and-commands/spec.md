# Add Automatic Cross Agent Skills And Commands

## Request

Add automatic cross-agent skills and commands, an agent-native resumable loop, and a one-revision fast profile for trivial low-risk changes

## Goal

Make Empirical automatic and forget-proof across supported coding agents while
giving trivial, low-risk changes a genuinely fast workflow that preserves
useful evidence without paying for four separate agent round trips.

## Acceptance Criteria

- [ ] [AC-1] A `fast` profile starts directly in one combined implementation phase and reaches Done after one passing completion instead of separate Shape, Verify, and Review revisions.
- [ ] [AC-2] Fast completion requires at least one acceptance criterion, passing behavioral evidence for every criterion, any required UI/browser/screenshot evidence, and passing review evidence in the same completion.
- [ ] [AC-3] Starting a Fast request creates a concise usable specification automatically, while Quick and Strong retain their existing phase sequences and gates.
- [ ] [AC-4] `empirical loop` and the `empirical_loop` MCP tool start a request when idle or return the current resumable action without launching or embedding an AI runtime.
- [ ] [AC-5] `empirical init` and `empirical integrate` safely install managed project skills and native command fallbacks for Codex, Claude Code, Cursor, Gemini CLI, and Windsurf, and repeated integration is idempotent.
- [ ] [AC-6] Generated guidance activates Empirical for ordinary build, change, fix, refactor, test, and continue requests without requiring the user to say “Use Empirical,” selects Fast only for small low-risk work, and loops until Done, Blocked, or awaiting human input.
- [ ] [AC-7] Existing user-owned integration files and incompatible MCP entries are preserved, all generated integrations remain repository-local, and no lifecycle hook, daemon, or home-directory command installation is introduced.
- [ ] [AC-8] CLI help, MCP schemas, JavaScript types, README, protocol, architecture, MCP, and real demo documentation accurately describe Fast, Quick, Strong, automatic activation, manual fallbacks, and loop semantics.
- [ ] [AC-9] Type checks, unit tests, MCP smoke tests, distribution tests, and npm package inspection pass.

## Scope

- Add the Fast workflow profile and combined evidence gate.
- Add a start-or-resume loop operation to the core, CLI, and MCP surfaces.
- Generate shared/project-specific skills and command fallbacks.
- Update documentation and automated coverage.

## Non-goals

- Running a coding model from the Empirical process.
- Silently classifying requests inside the deterministic core with brittle text heuristics.
- Replacing host permission, trust, or session-restart behavior.
- Writing commands, skills, MCP settings, or hooks into a developer's home directory.

## Risks

- A Fast request could be selected for work that becomes risky; generated guidance must define narrow eligibility and require escalation rather than weakening evidence.
- Agent command formats differ, so the shared skill plus `AGENTS.md` remains the portable automatic layer and native commands are explicit fallbacks.
- Managed integration refresh must not overwrite user-authored files that Empirical does not own.

## Verification

- Exercise Fast from Start through Done and assert combined evidence failures and success.
- Exercise loop behavior for idle, active, and completed state.
- Initialize twice and inspect every generated integration for content and idempotency; verify a conflicting user-owned command is preserved.
- Re-run existing Quick, Strong, adoption, stale-revision, MCP, distribution, and packaging tests.
