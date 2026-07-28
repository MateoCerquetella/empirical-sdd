# Repository protocol

The `.empirical/` directory is committed and portable:

```text
.empirical/
├── config.json
├── state.json
├── events/00000000.json
└── specs/<feature>/
    ├── spec.md
    ├── design.md        # Strong
    └── plan.md          # Strong
```

Every transition supplies the revision returned by `empirical next`. The store
acquires a short-lived local lock, rejects stale revisions, writes a complete
event atomically, and then projects the new state. If projection is interrupted,
the latest event repairs it on the next read.

Quick uses Shape → Implement → Verify → Review → Done. Strong uses Specify →
Design → Plan → Implement → Verify → Review → Done.

Acceptance criteria use this Markdown form:

```markdown
- [ ] [AC-1] A report can be exported.
- [ ] [AC-UI-1] [UI] The export confirmation is visible.
```

Verify requires passing behavioral evidence for each criterion. UI criteria
also require browser and screenshot records. Review requires a passing review
record. Verify or Review failure returns to Implement; exceeding the configured
repair budget blocks the workflow.
