# Security model

- Repository content and project MCP configuration are untrusted until the
  developer trusts the checkout.
- The MCP server uses local stdio and stores no credentials.
- Empirical does not run a daemon or expose a network port.
- State writes use exact revisions, a local exclusive lock, append-only events,
  and atomic file replacement.
- Feature start holds the state lock while choosing the feature identity and
  writing its specification. Completed revisions retain a specification digest
  so later criterion changes invalidate verification evidence.
- Initialization updates only marked instruction blocks, Empirical-managed
  project skills and commands, and the named `empirical` MCP entry. Existing
  unmanaged or conflicting entries are preserved and reported.
- Skills, commands, state, and supported MCP settings remain repository-local.
  Empirical does not install lifecycle hooks or write agent integrations into
  a developer's home directory.
- Workflow completion does not commit, push, open pull requests, deploy, or
  release. Delivery remains under the agent host and developer's normal
  approval policy.
- Evidence artifact paths must remain repository-relative. Screenshot files are
  checked when submitted and whenever evidence is verified; agents and hosts
  remain responsible for sandboxing the commands and browser sessions that
  produce them.
