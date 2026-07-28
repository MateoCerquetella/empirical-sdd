# Security model

Repository content is untrusted input. The reference implementation applies the
following boundaries:

- command adapters never run without explicit invocation authority;
- configured commands use a program plus argument vector, never generated shell
  source;
- adapter output must be a typed result envelope, not exit status alone;
- result artifacts and evidence paths must be relative, traversal-free,
  canonicalized inside the repository, and regular files;
- screenshot and other evidence artifacts are hash-checked;
- evidence is bound to a deterministic, Git-ignore-aware workspace hash, so a
  source edit after testing invalidates the gate;
- state changes use expected revisions and host-local locking;
- event-history forks fail closed;
- delivery is disabled by default and revalidates QA/review evidence;
- each delivery action needs matching caller authority;
- commit scopes are explicit, and unrelated pre-staged files are rejected; and
- pull requests cannot be created from the configured/default base branch.

The local lock does not coordinate separate machines. Teams merging concurrent
event histories must resolve any event fork explicitly. External commands,
browser sessions, Git remotes, and GitHub credentials remain within the host's
own sandbox and permission model.
