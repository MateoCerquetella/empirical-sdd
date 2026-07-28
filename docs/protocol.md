# Protocol

## Canonical data

The canonical store is the checked-out repository. A conforming client reads:

- `ai/empirical.toml` for policy;
- `ai/STATE.md` frontmatter for the current projection;
- `ai/events/*.json` for recovery;
- the selected `ai/specs/<id>/spec.md` for acceptance criteria; and
- the selected spec's evidence index and artifacts for completion proof.

Clients may cache or index these values. A cache, SQLite file, IDE workspace,
agent transcript, or MCP session cannot override repository state.

## Revisions and transitions

Every mutating call supplies the state revision it observed. Under a host-local
lock, the reference implementation reads the state again and rejects a stale
revision. It writes a complete post-transition event before atomically
projecting the same state into `STATE.md`.

An event identifies `expectedRevision`, its new `revision`, and
`previousEvent`. Recovery follows the single linear chain beginning at revision
zero. Two events for the same expected revision are a detectable fork; a client
must not pick one silently.

The lock is intentionally outside the repository and provides local process
coordination only. Revisions and events provide the portable concurrency
contract across hosts.

## Profiles

Quick is for a small, understood, reversible feature:

`Shape → Implement → Verify → Review → [Deliver] → Done`

Strong is for ambiguity, architectural impact, migrations, security risk,
large changes, or durable public contracts:

`Specify → Design → Plan → Implement → Verify → Review → [Deliver] → Done`

Quick does not require `architecture.md` or `plan.json`. It does not weaken QA,
criterion evidence, UI verification, or code review.

## Loop behavior

When automatic continuation is enabled, a client repeatedly:

1. synchronizes the hash of the current specification;
2. stops for terminal, blocked, human, or delivery states;
3. resolves the adapter and required capabilities;
4. records Phase Started;
5. invokes the adapter and validates its result envelope;
6. validates required artifacts and adds evidence bound to the current
   workspace hash;
7. evaluates Verify or Review gates; and
8. advances or schedules a bounded repair.

A spec content change increments `specRevision`, returns to the first profile
phase, and makes older evidence stale. Verify or Review failure returns to
Implement. A non-ignored source change after Verify also makes its evidence
stale. The third consecutive failure blocks with the default two-repair policy;
a successful repair resets the budget for the next phase.

Missing adapters or capabilities stop without changing the state to Blocked,
so installing the missing tool and invoking the loop again resumes immediately.
After the bounded failure budget is exhausted, an operator resolves the cause
and runs `empirical retry --expected-revision N`; the retry is a revisioned
event and resets the repair budget.

## Compatibility

Before adoption, a client recognizes v1 fields such as `current_spec`,
`current_role`, `current_phase`, and `mode`. Discovery is read-only. Adoption
adds the current frontmatter, config, and first event while retaining the prior
Markdown under a preserved-history section. It does not rename spec folders.

JSON forms use camelCase according to the schemas. `STATE.md` frontmatter uses
snake_case for compatibility and human readability.
