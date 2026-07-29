# Parallel Workstreams

## MODIFIED Requirements

### Requirement: Workstreams have independent revision journals

Empirical MUST support a default workstream at the existing `.empirical/state.json` and `.empirical/events/` paths and named workstreams under `.empirical/workstreams/<name>/`, each with independent state, events, and revisions. Filesystem lock recovery MUST preserve one exclusive owner and tolerate transient Windows sharing violations within a bounded wait.

#### Scenario: Two unrelated changes start concurrently

- **WHEN** agents start work in two different named workstreams
- **THEN** both changes receive independent revision 1 actions and distinct shared feature identifiers

#### Scenario: Concurrent clients encounter an abandoned Windows lock

- **WHEN** stale-lock recovery temporarily receives Windows `EPERM` or `EACCES` while the old path is being released
- **THEN** clients retry within the bounded lock wait, converge on one state, and do not delete a newer owner's lock
