# Repository protocol

The `.empirical/` directory is committed and portable:

```text
.empirical/
├── config.json
├── policy.json
├── workstreams.json
├── state.json + events/             # default workstream; paths retained
├── workstreams/<name>/
│   └── state.json + events/         # independent revisions
├── capabilities/<name>/spec.md      # current behavior
└── specs/<feature>/
    ├── spec.md
    ├── design.md        # Complex only
    ├── plan.md          # Complex only
    └── deltas/<name>.md # new Complex work
```

The current protocol schema is 3. Schema-1 and schema-2 repositories remain
readable and can be stamped forward with `empirical migrate`; the next successful
mutation also upgrades them. Existing state, events, specs, evidence, Quick
compatibility, and adopted `ai/` content remain at their current paths as the
`default` workstream.

Every transition supplies the revision from the current action packet. The
store acquires a short-lived local lock, rejects stale revisions, writes a
complete event atomically, and then projects the new state. If projection is
interrupted, the latest event repairs it on the next read.

Feature creation holds that same lock across feature numbering, specification
creation, and state commit. Completed revisions record a specification digest;
verification fails if criteria change after the evidence-bearing revision.

The two public workflow sequences are:

```text
Fast:    Implement + Verify + Review → Done
Complex: Specify → Design → Plan → Implement → Verify → Review → Archive → Done
```

Fast creates a concise `spec.md` from the request when it starts. Its single
completion must include at least one acceptance criterion, passing test
evidence for every criterion, required browser and screenshot evidence for UI
criteria, and passing review evidence. Complex retains its separate phase gates,
validates requirement deltas during Specify, and cannot reach Done until Archive
projects them onto living capability specifications.

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

`empirical explore "<problem>"` / `empirical_explore` is a pure discovery
operation. It returns questions, project context, living-spec context, and
suggested Fast/Complex next calls without creating a feature, event, or revision.

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

## Capability deltas and archive

Each new Complex change writes one or more
`.empirical/specs/<feature>/deltas/<capability>.md` files. The supported grammar
is a strict, intentionally small OpenSpec-compatible subset:

```markdown
## Purpose

Why this capability exists.

## ADDED Requirements

### Requirement: Observable behavior

The system MUST provide the behavior.

#### Scenario: Successful use

- **WHEN** the behavior is requested
- **THEN** the observable result occurs
```

`MODIFIED` requires the named requirement to exist. `REMOVED` requires it to
exist and deletes it. `ADDED` requires it not to exist. Duplicate operations,
unsafe capability identifiers, missing scenarios, and ambiguous projections are
rejected. Archive preflights every delta, applies every capability through a
rollback-capable transaction effect, advances the exact workstream revision, and
converges safely when retried after success. Specify records a digest of the
validated behavioral delta; later phases and Archive reject any unreviewed change
to that approved delta.

## Workstream identity

Named workstreams scope state, events, locks, and revisions. Feature specs,
capabilities, policy, and configuration are shared project resources protected by
their own locks. `workstreams.json` records the selected workstream only as a
command-line convenience. Every new action packet and completion command includes
an explicit workstream, so later selection changes cannot redirect issued work.

## Project policy

`.empirical/policy.json` contains committed project context and optional arrays of
per-phase guidance. Context is exposed separately in action packets. Phase guidance
is appended after the built-in instruction and is explicitly subordinate to
mandatory criteria, artifact, revision, evidence, review, delta, and archive gates.
