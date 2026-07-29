# Design

## Interaction modes

`empirical explore` chooses behavior from explicit, testable signals:

| Invocation | Behavior |
|---|---|
| Interactive stdin/stdout TTY | Socratic interview |
| `--interactive` | Force the interview, including tests with piped input |
| `--json` | Pure discovery packet |
| `--no-interview` | Human-readable pure packet |
| Non-TTY without an override | Pure packet for backward-compatible automation |

`--interactive` conflicts with `--json` and `--no-interview`. MCP and TypeScript continue calling the existing pure `EmpiricalProject.explore()` API.

## Five-pass interview

A new `src/discovery.ts` owns the deterministic domain classifier, the original five passes, a maximum of one follow-up per pass, workflow recommendation, refined-request renderer, persisted record schema, and Markdown renderer. The passes are:

1. Problem and primary user.
2. Smallest observable outcome.
3. Included boundaries, explicit non-goals, and constraints.
4. Failure cases and solution-changing risks.
5. Concrete verification and evidence.

Questions include domain hints for games, general UI, APIs, data/migrations, and security. Follow-ups are triggered only by a short/uncertain answer or a missing material decision, such as a game answer with no win/failure condition or UI verification with no browser check.

The CLI uses `node:readline/promises`, rejects blank answers, accepts `:quit`, and saves after every accepted answer. After all passes it prints the complete refined brief and asks separately for approval and workflow selection. Rejection or save-only never creates a feature revision. Restart clears answers in the same discovery record and repeats pass one.

## Durable discovery

Each interview receives a safe timestamp-and-slug identifier and writes:

```text
.empirical/discoveries/<id>/interview.json
.empirical/discoveries/<id>/brief.md
```

The record contains schema version, original problem, pass/follow-up answers, refined request, draft/approved/started status, selected workflow, feature/revision handoff, and timestamps. Writes are atomic. Symbolic links at the discovery root or record directory are rejected before writing.

The refined request is structured multiline text, not a lossy generated sentence, so the normal Complex specification receives the approved user/problem, outcome, scope/non-goals, risks, and verification decisions.

## Workflow and agent handoff

The recommendation remains conservative: game/UI, security, data, API, dependency, architecture, or otherwise broad work recommends Complex; only clearly tiny localized requests recommend Fast. A user can override Complex to Fast only after an explicit confirmation.

Once approved, the CLI invokes the existing `project.fast()` or `project.complex()` API and renders the returned exact action. It then optionally launches Codex only when the user selects it or passes `--agent codex`. Launch uses an allowlisted executable and argument array—never a shell—and supplies a prompt that resumes the already-created exact workstream until a terminal state. A missing or failed Codex executable does not roll back or disguise the successfully started workflow.

## Agent-native Socratic behavior

Managed repository guidance and every generated agent skill/command receive the same explicit five-pass contract: ask one question at a time in the current conversation, use relevant repository and capability context, add only material follow-ups, show the refined contract, wait for approval, then call Fast or Complex. The agent path uses the already-running host runtime and never launches a second one.

## Compatibility and security

- Pure packet shape and API behavior remain unchanged.
- Discovery records are additive and do not change workflow schema or revisions.
- User answers are Markdown-escaped where structure could be injected, while JSON retains exact trimmed text.
- Runtime launch is opt-in, Codex-only initially, shell-free, and occurs only after approved workflow creation.
- Release version becomes 2.3.0 because this is a backward-compatible user-facing feature.
