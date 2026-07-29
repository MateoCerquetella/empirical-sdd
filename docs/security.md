# Security model

- Repository content and project MCP configuration are untrusted until the
  developer trusts the checkout.
- The MCP server uses local stdio and stores no credentials.
- Empirical does not run a daemon or expose a network port.
- State writes use exact revisions, a local exclusive lock, append-only events,
  and atomic file replacement.
- Named workstreams isolate state locks, event journals, and revisions. Shared
  feature numbering, workstream metadata, policy, and capability archive use
  separate project-wide resource locks. Action packets bind mutations to an
  explicit workstream.
- Feature start holds the state lock while choosing the feature identity and
  writing its specification. Completed revisions retain a specification digest
  so later criterion changes invalidate verification evidence.
- Capability and workstream identifiers use portable allowlists and reject path
  traversal. Complex Archive preflights all delta operations before mutation,
  rejects ambiguous changes, and rolls back earlier capability writes if any
  projection or state commit fails. A digest recorded at Specify prevents a delta
  from being changed silently between approval, review, and Archive.
- `.empirical/policy.json` is untrusted repository guidance. It is appended to
  built-in phase instructions and cannot disable criteria, artifacts, exact
  revisions, evidence, review, delta validation, or Archive.
- Initialization updates only marked instruction blocks, Empirical-managed
  project skills and commands, and the named `empirical` MCP entry. Existing
  unmanaged or conflicting entries are preserved and reported.
- Initialization, adoption, ordinary integration, skills, commands, state, and
  supported MCP settings remain repository-local. Empirical does not install
  lifecycle hooks or silently write a developer's home directory.
- The explicit `empirical integrate --global` operation writes only marked
  `SKILL.md` copies below the documented native user skill roots. It validates
  root containment, refuses a filesystem-root home, writes atomically, follows
  no symbolic link in a target path, and preserves unmanaged or non-file
  collisions. It does not write global MCP settings or workflow state.
- Workflow completion does not commit, push, open pull requests, deploy, or
  release. Delivery remains under the agent host and developer's normal
  approval policy.
- Evidence artifact paths must remain repository-relative. Screenshot files are
  checked when submitted and whenever evidence is verified; agents and hosts
  remain responsible for sandboxing the commands and browser sessions that
  produce them.
