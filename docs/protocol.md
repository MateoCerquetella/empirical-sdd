# Empirical protocol 0.20

## Action packet

Every current action is a structured `ActionPacket`:

```json
{
  "kind": "action",
  "protocol": "empirical-sdd",
  "schemaVersion": 4,
  "root": "/repo",
  "feature": "add-team-invitations",
  "request": "Add team invitations",
  "profile": "complex",
  "phase": "design",
  "status": "waiting",
  "revision": 2,
  "instructions": "...",
  "rationale": {
    "currentState": "design/waiting at revision 2",
    "nextAction": "Complete design at revision 2",
    "reason": "...",
    "requiredContext": [".../design.md", ".../decisions.md"],
    "missingContext": ["..."],
    "gate": "proceed"
  },
  "acceptanceCriteria": [],
  "requiredEvidence": [],
  "artifacts": [],
  "projectContext": [],
  "knowledgeContext": [
    ".empirical/context/index.md",
    ".empirical/context/architecture.md"
  ],
  "capabilityContext": [],
  "completion": {
    "available": true,
    "mcpTool": "empirical_complete",
    "cli": "empirical __internal complete --revision 2 ...",
    "requiredFields": ["revision", "outcome", "summary"]
  }
}
```

The packet is bound to the one active feature selected in checkout-local Git
metadata. `knowledgeContext` supports progressive retrieval from the compact
file-backed repository context. Mutations require the exact revision. A stale
caller receives `STALE_REVISION` and cannot overwrite newer state.

## Agent handoff

After Complex Specify passes, the handoff proposal contains Continue, Save, and
detected-agent choices. Each agent option classifies the executable as
prompt-capable or workspace-only and includes the exact cwd, prompt, argv, and
an approval token bound to the feature and approved specification digest.

Authorization re-derives the option and rejects stale tokens. Neither proposal
nor authorization starts a process; the current host may execute only an exact
option that the human explicitly approved.

## Start result

Fast and Complex return either an ActionPacket or a read-only proposal:

```json
{
  "kind": "worktree_proposal",
  "request": "Fix password reset expiry",
  "workflow": "complex",
  "changeType": "fix",
  "feature": "fix-password-reset-expiry",
  "branch": "fix/fix-password-reset-expiry",
  "path": "/projects/app-fix-password-reset-expiry",
  "base": "main",
  "baseCommit": "0123456789abcdef0123456789abcdef01234567",
  "activeFeature": "add-team-invitations",
  "approvalToken": "<sha256-of-approved-fields>",
  "command": ["git", "worktree", "add", "-b", "...", "<baseCommit>"],
  "requiresApproval": true
}
```

Structured creation repeats every editable proposal field plus `baseCommit`,
`activeFeature`, and `approvalToken`, and requires `approved: true`. Any change
requires a fresh proposal. Success returns `kind: worktree_handoff`, checkout
metadata, the first ActionPacket, and an exact resume command.

## Socratic discovery submission

Agent-native discovery saves an ordered prefix of the five canonical passes:

```json
{
  "problem": "Improve team onboarding",
  "id": "optional-id-returned-by-the-first-save",
  "answers": [
    {
      "pass": "problem",
      "title": "Problem and user",
      "question": "Who needs this and why?",
      "answer": "Team administrators lose time coordinating setup manually.",
      "followUp": null
    }
  ]
}
```

Draft calls persist JSON and Markdown without feature state. `approved: true`
requires exactly `problem → outcome → boundaries → risks → verification`,
derives one refined request, and starts Complex with that exact text. The result
contains the record, portable paths, refined request, and either an ActionPacket
or a worktree proposal. Draft responses also include one `nextQuestion` with
`kind: pass` or `kind: follow_up`; no unnecessary follow-up is accepted. A
record becomes `started` only after an action exists.

## Workflows

Fast phases: `implement → done`.

Complex phases:

```text
specify → design → plan → implement → verify → review → archive → done
```

Quick is read-only compatibility for migrated legacy state and is never chosen
for new work.

Outcomes are `passed`, `failed`, `awaiting_human`, and `blocked`. Fast failure
escalates the same feature to Complex Specify. Verify/Review failure returns to
Implement until the configured repair ceiling is exceeded.

## Evidence

Every criterion needs passing test evidence. `[UI]` criteria additionally need
browser evidence and a repository-relative screenshot artifact. Review needs a
passing review record. Artifact traversal and absolute paths are rejected.

## Capability deltas

Complex Specify validates one or more `deltas/<capability>.md` documents with
ADDED, MODIFIED, or REMOVED requirement blocks and concrete scenarios. Their
digest is frozen at Specify. Review and Archive reject later changes. Archive
projects the reviewed deltas transactionally and is idempotent at its exact
revision.

## Persisted state

```text
.empirical/specs/<feature>/state.json
.empirical/specs/<feature>/events/00000001.json
.empirical/specs/<feature>/state.lock
```

`state.json` is a recoverable projection of the append-only transition journal.
Configuration, project policy, discovery, and living capabilities are shared at
the project level.
