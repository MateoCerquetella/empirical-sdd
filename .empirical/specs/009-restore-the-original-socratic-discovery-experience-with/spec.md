# Restore The Original Socratic Discovery Experience With

## Request

> Restore the original Socratic discovery experience with an interactive CLI interview, adaptive questions, persisted answers, an approved refined request, and direct handoff into Fast or Complex without breaking read-only agent discovery or automation.

## Goal

Restore Socratic discovery as a first-class experience so vague ideas become approved, durable, testable briefs before workflow state or implementation begins.

## Acceptance Criteria

- [ ] [AC-1] Running `empirical explore "<idea>"` in an interactive terminal conducts the original five passes—problem/user, observable outcome, boundaries, failure/risk, and verification—one question at a time.
- [ ] [AC-2] The interview adds at most one relevant follow-up when an answer is vague or omits a material domain decision, including game/UI-specific outcome, boundary, and browser-verification concerns.
- [ ] [AC-3] Draft and approved interviews persist as both structured JSON and readable Markdown under `.empirical/discoveries/`, including every question, answer, follow-up, refined request, approval state, and workflow handoff.
- [ ] [AC-4] Empirical shows the complete refined brief and requires explicit approval before it starts Fast or Complex; the user can save without starting, quit safely, or restart the interview.
- [ ] [AC-5] After approval, the interactive flow recommends a workflow, starts the selected Fast or Complex request directly, and can optionally launch Codex with a prompt to resume that exact active workflow.
- [ ] [AC-6] `--json`, `--no-interview`, MCP, and TypeScript Explore remain deterministic, non-interactive, and mutation-free for agents and automation.
- [ ] [AC-7] Generated Codex, Claude, Gemini, Cursor, and Windsurf guidance restores the five-pass, one-question-at-a-time Socratic interview and approval gate instead of merely relaying generic questions.
- [ ] [AC-8] Existing Fast, Complex, evidence, archive, workstream, packaging, and cross-platform behavior remains compatible, and the CLI explains interactive versus packet discovery clearly.

## Scope

- Interactive terminal discovery and safe input handling.
- Persisted discovery records and refined briefs.
- Fast/Complex handoff and optional Codex launch.
- Generated agent instructions, help, documentation, and regression tests.

## Non-goals

- Embedding an LLM, API key, daemon, or vendor SDK inside Empirical.
- Automatically launching an external agent unless the user explicitly selects it.
- Replacing the pure Explore packet used through JSON, MCP, and TypeScript.

## Verification

- Drive a forced interactive interview through piped test input and assert every pass, adaptive follow-up, approval, persistence, and Complex revision 1 handoff.
- Prove save-only and rejected approval create no workflow revision.
- Prove JSON, MCP, and TypeScript Explore remain byte-for-byte pure.
- Run the complete release gate and Ubuntu/macOS/Windows CI matrix.

## Capability Deltas

Create one or more files under deltas/<capability>.md using ADDED, MODIFIED, or
REMOVED Requirements sections, named Requirement blocks, and concrete Scenario
examples. These merge into living specifications
after verification and review.
