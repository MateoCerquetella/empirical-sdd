# Design

## Product model

Empirical exposes two SDD workflows and one runner:

```text
ordinary coding request
        |
        v
repository skill chooses once
   Fast          Complex
     |              |
     +------ action packet ------+
                                  v
                         host-agent completion loop
                                  |
                  done | blocked | awaiting_human
```

- Fast is the single combined implementation, test evidence,
  and review workflow.
- Complex is the Specify, Design, Plan, Implement, Verify, Review
  workflow.
- Loop has no request, ID, or profile inputs. It reads and returns the current
  action. Completion responses continue carrying the next action, so Loop is
  only needed to enter or resume an already-started workflow.

## Interfaces

The public starters are identical adapters over the transactional `start`
engine:

| Surface | Fast | Complex | Resume |
|---|---|---|---|
| CLI | `empirical fast "request"` | `empirical complex "request"` | `empirical loop` |
| MCP | `empirical_fast` | `empirical_complex` | `empirical_loop` |
| TypeScript | `project.fast(request)` | `project.complex(request)` | `project.loop()` |

The low-level `start(request, { profile })` and JSON format remain compatible
for programs. Quick and legacy Strong values remain readable only as persisted
state; Strong normalizes to Complex and neither legacy value starts new work.

## Automatic agent behavior

Repository guidance and the `empirical` skill activate on ordinary coding
requests. The host agent performs the semantic decision that a deterministic
CLI cannot safely infer:

- choose Fast only for explicit, tiny, localized, reversible, low-risk,
  non-UI work with an obvious focused check;
- choose Complex for everything else or whenever uncertain.

The skill calls the matching starter through MCP when connected or its simple
CLI equivalent otherwise. It then executes each returned packet and consumes
completion responses directly until a terminal state. Users never supply JSON
or profile flags.

## Compatibility and safety

- Persisted profiles keep `quick`, and old `strong` values normalize to
  `complex`, so schema-1/schema-2 repositories and in-flight work resume safely.
- Start remains transactional and concurrency-safe; Fast/Complex wrappers do
  not duplicate mutation logic.
- Loop becomes read-only and cannot race to create or replace a feature.
- Existing generated files are refreshed idempotently by `empirical integrate`.
- No hook, daemon, home write, model invocation, or network classifier is added.

## Verification

- Core tests cover Fast/Complex wrappers, pure Loop behavior, and legacy state.
- MCP tests cover the three separated tools and schemas.
- Distribution smoke tests execute the built Node CLI with simple commands and
  ensure human-readable packets contain enough information for a host agent.
- Integration tests reject stale profile/JSON instructions.
- Full CI and npm package inspection remain the release gate.
