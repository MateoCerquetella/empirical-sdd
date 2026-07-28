# Security model

- Repository content and project MCP configuration are untrusted until the
  developer trusts the checkout.
- The MCP server uses local stdio and stores no credentials.
- Empirical does not run a daemon or expose a network port.
- State writes use exact revisions, a local exclusive lock, append-only events,
  and atomic file replacement.
- Initialization updates only marked instruction blocks and the named
  `empirical` MCP entry. Existing conflicting entries are preserved and
  reported.
- Workflow completion does not commit, push, open pull requests, deploy, or
  release. Delivery remains under the agent host and developer's normal
  approval policy.
- Evidence artifact paths must remain repository-relative. Screenshot files are
  checked when submitted and whenever evidence is verified; agents and hosts
  remain responsible for sandboxing the commands and browser sessions that
  produce them.
