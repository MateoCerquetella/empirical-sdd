# Design: Context Refinement Completion Gate

## Knowledge state

Keep Manifest v2 backward-compatible and derive semantic refinement from page
contents instead of changing the manifest schema. `inspectRepositoryKnowledge`
will return `refinementRequired` paths in addition to fresh, stale, missing, and
issues. Managed topic templates and exact legacy placeholder templates require
refinement only when the repository inventory is nonempty. The managed index is
never semantic-refinement work.

`freshRepositoryKnowledgePaths` and refresh reports will exclude
refinement-required pages from usable `context`, while reporting them in a new
field. Custom topic pages remain byte-preserved. Exact placeholder detection is
structural: managed marker or the known template heading plus unresolved TODO
bullets, not arbitrary prose containing “TODO”.

## Workflow state

Add `context` to the persisted Phase enum and to Fast, Quick compatibility, and
Complex phase sequences after Implement. Implement completion will inspect
knowledge: if it is already valid, it skips Context; otherwise it transitions
to Context. Context completion requires a valid inspection, then advances to
Done for Fast or Verify for Complex/Quick.

The Context action instructs the host agent to:

1. refresh inventory;
2. inspect repository evidence;
3. replace placeholder topics and remove the managed marker;
4. refresh again to record custom digests;
5. complete the exact Context revision.

Doctor emits a read-only warning for refinement-required pages. Action packets
continue using only usable current knowledge.

## Migration

During Schema-4 transformation, exact legacy TODO templates are marked managed
in Manifest v2; custom pages are not rewritten and remain unmanaged. Subsequent
refresh gives managed placeholders the current marker/template while preserving
custom content.

## Compatibility and release

The new phase is additive within Schema 5. Old states remain valid. New states
paused at Context require the new runtime, which is appropriate for the patch
that created them. Manifest v2 remains readable because the new report field is
transport output, not persisted schema.

All runtime/package surfaces move from 0.22.0 to 0.22.1. Existing delivery and
publication authorization machinery remains unchanged.

## Verification strategy

- Knowledge unit tests cover empty/nonempty templates, usable paths, custom
  preservation, and two-refresh refinement convergence.
- Core tests cover conditional Context routing and completion refusal.
- Doctor, MCP, migration, protocol, integration, distribution, and consumer
  tests cover the expanded observable surface.
- Full CI proves coverage and package consistency.
