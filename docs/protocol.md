# Repository protocol

The `.empirical/` directory is committed and portable:

```text
.empirical/
├── config.json
├── state.json
├── events/00000000.json
└── specs/<feature>/
    ├── spec.md
    ├── design.md        # Complex only
    └── plan.md          # Complex only
```

The current protocol schema is 2. Schema-1 repositories remain readable and
can be stamped forward with `empirical migrate`; the next successful mutation
also upgrades them. Once schema 2 is written, older engines reject completion
instead of advancing Fast workflow state with the wrong phase sequence.

Every transition supplies the revision from the current action packet. The
store acquires a short-lived local lock, rejects stale revisions, writes a
complete event atomically, and then projects the new state. If projection is
interrupted, the latest event repairs it on the next read.

Feature creation holds that same lock across feature numbering, specification
creation, and state commit. Completed revisions record a specification digest;
verification fails if criteria change after the evidence-bearing revision.

The two public workflow sequences are:

```text
Fast:   Implement + Verify + Review → Done
Complex: Specify → Design → Plan → Implement → Verify → Review → Done
```

Fast creates a concise `spec.md` from the request when it starts. Its single
completion must include at least one acceptance criterion, passing test
evidence for every criterion, required browser and screenshot evidence for UI
criteria, and passing review evidence. Complex retains its separate phase gates.

Quick's historical Shape → Implement → Verify → Review sequence remains in the
schema only for compatibility with existing repositories. New work cannot
select Quick through the public Fast or Complex entry points.

Acceptance criteria use this Markdown form:

```markdown
- [ ] [AC-1] A report can be exported.
- [ ] [AC-UI-1] [UI] The export confirmation is visible.
```

Verify requires passing test evidence for each criterion. UI criteria
also require browser and screenshot records. Review requires a passing review
record. Verify or Review failure returns to Implement; exceeding the configured
repair budget blocks the workflow.

## Start and resume semantics

`empirical fast "<request>"` / `empirical_fast` and
`empirical complex "<request>"` / `empirical_complex` create new work and return
its first action packet. They never run an AI model; the current agent executes
the packet.

`empirical loop` and `empirical_loop` are pure resume operations:

- they take no request or profile;
- active work resumes without changing its revision;
- idle and terminal state remain idle or terminal; and
- they never create or replace a feature.

Every Fast, Complex, and `complete` response is also the next packet. Agents
should consume it directly and repeat until Done, Blocked, or awaiting human
input; calling `loop` after each successful completion only adds an unnecessary
round trip. A later agent session uses loop once to recover the current action.
