# Design comparison

## What v1 gets right

The original starter is easy to understand and easy to place in an existing
repository. Its `ai/context`, roles, skills, specs, and visible `STATE.md` make
the workflow inspectable without installing a service. Existing teams already
use those paths, so compatibility has more value than a cleaner new namespace.

Its limitation is that guidance is not a state machine. A new process can read
the current role, but there is no portable rule for claiming work, validating a
result, routing a failure, bounding retries, or proving that completion means
the acceptance criteria passed.

## What the runtime-coupled v2 exploration gets right

The later design introduced several important controls: typed task plans,
revision checks, bounded loops, capability-aware QA, structured evidence, and
explicit delivery. Those are the right primitives for autonomous work.

Coupling those primitives to one host, worktree manager, local state store, or
SQLite database would make a protocol into a product feature. A colleague using
another IDE or agent could not reliably resume the same feature, and deleting a
client cache could remove authoritative state.

## The combined design

The `empirical` CLI retains the v1 filesystem vocabulary and moves the stronger
v2 controls into a neutral protocol. Its optional Rust API exposes the same
engine to tool authors; it is not a separate app or runtime:

- v1 Markdown remains readable before adoption and preserved afterward;
- `revision` is an optimistic compare-and-swap token for every transition;
- immutable JSON events reconstruct `STATE.md` after a crash;
- Quick removes design and planning ceremony for small, understood changes;
- Strong keeps explicit specification, architecture, and typed planning;
- both profiles share the same evidence and review bar;
- browser, MCP, IDE, and agent products implement capabilities rather than
  becoming dependencies of the core; and
- configuration expresses delivery intent while caller authority grants
  permission for the current invocation.

This makes the workflow faster where ceremony was the problem and stronger
where weak evidence was the problem.
