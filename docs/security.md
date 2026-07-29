# Security model

Empirical treats repository content, requests, specs, evidence, decision files,
Git metadata, and CLI/MCP inputs as untrusted.

- Feature and capability IDs use portable allowlists; artifact paths cannot be
  absolute or traverse above the repository.
- Atomic writers preserve existing modes and never replace managed files through
  symbolic-link paths.
- Discovery, capability, global-skill, migration, and worktree targets validate
  containment and symbolic-link boundaries.
- Workflow transitions require exact revisions and use ownership-aware locks;
  stale recovery cannot remove a newer owner's lock.
- Capability Archive validates a frozen delta digest and rolls back partial
  projection writes.
- Worktree proposal performs no writes. Approved creation requires a clean
  checkout, a resolvable base, a new path, a new branch, and no registered
  checkout collision. Git runs without a shell or `--force`.
- Empirical never stashes, commits, moves changes, deletes a worktree/branch, or
  launches another AI runtime from agent tools.
- Decision records reject hidden-reasoning, prompt-transcript, credential, and
  secret sections. Explain exposes deterministic state-machine rationale only.
- MCP schemas validate inputs before core operations; `empirical_worktree_create`
  is marked destructive and requires literal approval.

Do not place secrets in requests, Socratic answers, specifications, decisions,
evidence summaries, or screenshots. `.empirical/` is committed project data.
