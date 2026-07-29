# Decisions: One Empirical Entrypoint

This file records concise, externally reviewable engineering decisions. It does
not contain private model reasoning, prompts, credentials, or scratchpad text.

## D-001: Expose one agent entrypoint and keep workflow verbs internal

Status: Accepted

### Evidence

- Installed Explore, Fast, Complex, and Loop skills duplicate decisions the
  generic Empirical skill already makes.
- Agents call structured MCP tools such as `empirical_complete`; users do not
  need a matching installed skill for every internal operation.
- Existing scripts and generated fallbacks depend on CLI and MCP verbs.

### Options

1. Keep five skills and improve their descriptions.
2. Remove low-level operations and combine the state machine into one API.
3. Install one user-facing skill while preserving operations for agents and automation.

### Chosen approach

Choose option 3. Users see one Empirical entrypoint; the skill routes and calls
existing validated operations. Primary terminal help contains only install and
update, while advanced compatibility verbs remain callable.

### Trade-offs and risks

- Hidden compatibility commands still require maintenance.
- Generated instructions become more important and need direct contract tests.
- Existing project-local skills can shadow the global skill until reconciled.

### Verification

- Assert exactly one managed entrypoint per installed target.
- Assert normal help and README omit workflow selection commands.
- Run existing CLI and MCP workflow tests with additive fields only.

## D-002: Use a compact file-backed knowledge set instead of vector RAG

Status: Accepted

### Evidence

- Empirical already returns project policy and capability paths for progressive retrieval.
- A vector store adds embeddings, network/privacy choices, stale-index behavior, and package weight.
- Coding agents can inspect and maintain concise Markdown pages directly.

### Options

1. Add embeddings and a local or hosted vector database.
2. Do no initialization-time repository mapping.
3. Generate bounded metadata plus agent-maintained Markdown context pages.

### Chosen approach

Choose option 3. Empirical generates a deterministic secret-safe manifest and
index, creates four durable topic pages, and references those pages in packets.

### Trade-offs and risks

- Lexical/path retrieval is less fuzzy than semantic vector search.
- Agent-maintained pages can become stale, so every invocation checks a digest.
- Scanning needs strict ignore, secret-name, count, and byte bounds.

### Verification

- Exercise Git and non-Git fixtures, ignored and secret-like paths, large trees,
  stable refresh, changed digests, preserved pages, and packet references.

## D-003: Make handoff a validated proposal executed by the current host

Status: Accepted

### Evidence

- MCP uses stdio and cannot safely own an interactive child session.
- Agents differ between prompt-capable CLIs and workspace-only IDE launchers.
- The user requires an explicit choice before another runtime starts.

### Options

1. Automatically start hardcoded Codex after discovery.
2. Let MCP spawn arbitrary commands after a boolean approval.
3. Return capability-aware proposals, revalidate approval, then let the host execute authorized argv.

### Chosen approach

Choose option 3. Detection and proposal are read-only. Approval binds feature,
spec digest, target, cwd, prompt, and argv. The installed agent asks the user and
executes only the authorized command through its shell/session facility.

### Trade-offs and risks

- Session presentation depends on the current host.
- Workspace-only agents can open a repository but cannot be promised a prompt.
- A changed spec or executable invalidates approval.

### Verification

- Fake PATH and executable fixtures for all five agents.
- Assert classification, exact argv, token changes, stale rejection, and no
  process creation during detection, proposal, save, or current choices.

## D-004: Store active selection in per-worktree Git metadata

Status: Accepted

### Evidence

- Committed blocked state was inherited by a new linked worktree and prevented its approved handoff.
- Git provides a worktree-specific metadata directory outside committed content.
- The owning checkout must still resume blocked or awaiting-human work.

### Options

1. Treat Blocked as terminal and ignore it everywhere.
2. Delete or rewrite inherited state during worktree creation.
3. Keep portable state and bind active selection to each checkout's Git metadata.

### Chosen approach

Choose option 3. A local pointer selects one feature. Legacy recovery claims one
unambiguous candidate, and registered checkout claims prevent inheritance.

### Trade-offs and risks

- A fresh clone needs deterministic recovery because pointers are not committed.
- Git metadata writing requires containment and atomicity checks.
- Multiple unclaimed non-terminal histories must block rather than guess.

### Verification

- Reproduce the blocked-base handoff failure.
- Prove owner resume, new checkout start, Done cleanup, clone recovery,
  multiple-candidate rejection, and non-Git fallback.

## D-005: Refresh integrations from the newly installed process

Status: Accepted

### Evidence

- A running Node process retains old modules after npm updates installed files.
- Users expect one update command to refresh both binary and agent entrypoints.
- Existing integration writes are marker-owned, atomic, and repeatable.

### Options

1. Update npm only and require a second command.
2. Reuse old in-memory installer code after npm completes.
3. After npm succeeds, spawn the newly installed `empirical install` command.

### Chosen approach

Choose option 3. Package upgrade and integration refresh are separate reported
stages, and update succeeds only when both pass.

### Trade-offs and risks

- The global binary must resolve correctly after npm.
- Package success followed by integration failure leaves stale skills, but the
  error and recovery command are explicit.

### Verification

- Inject package failure, refresh failure, and success child-process results.
- Confirm refresh argv uses the new install command.
