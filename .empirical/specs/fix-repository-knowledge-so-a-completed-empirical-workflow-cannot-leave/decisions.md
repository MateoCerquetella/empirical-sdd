# Decisions: Context Refinement Completion Gate

## D-001: Separate deterministic refresh from semantic refinement

Status: Accepted

### Evidence

The refresh engine has bounded file metadata but no language-model capability;
installed Empirical skills explicitly assign semantic refinement to the host
agent. TODO templates were nevertheless reported as current and usable.

### Options

Generate prose in the CLI, leave refinement advisory, or make refinement an
explicit reported and workflow-gated state.

### Chosen approach

Keep refresh deterministic and add `refinementRequired` reporting plus a
mandatory conditional Context phase owned by the host agent.

### Trade-offs and risks

This adds one phase after source-changing work, but source-neutral work skips it.
Structural placeholder detection avoids rewriting deliberate custom prose.

### Verification

Unit and workflow tests prove placeholders are unusable until refined and that
custom pages remain byte-identical.

## D-002: Keep Manifest v2 and add an additive Phase

Status: Accepted

### Evidence

Refinement can be derived from page contents, while persisted workflow state
needs an exact resumable action. A manifest schema bump would add migration cost
without improving detection.

### Options

Bump Manifest and project schemas, use a transient completion error, or add a
persisted `context` phase while retaining Manifest v2.

### Chosen approach

Retain Manifest v2 and Schema 5; add `context` to the Phase enum and report
refinement as an additive API field.

### Trade-offs and risks

Older runtimes cannot read newly paused Context states, so every version surface
must move together to 0.22.1. Existing Schema-5 states remain compatible.

### Verification

Protocol, migration, package, and clean-consumer tests cover the additive state
and exact version convergence.

## D-003: Preserve release authorization boundaries

Status: Accepted

### Evidence

The user requested a new version, but protected delivery and npm publication
already require exact commit- and version-bound authorizations.

### Options

Publish directly, prepare only, or continue through the existing delivery and
publication state machine as its exact approval gates permit.

### Chosen approach

Prepare 0.22.1 and use the existing integration, delivery, and publication
operations without bypasses.

### Trade-offs and risks

External release may pause for an exact approval token or protected check; this
is an intentional safety boundary.

### Verification

Full CI, packed-consumer verification, and existing immutable release checks
must pass before any external mutation.
