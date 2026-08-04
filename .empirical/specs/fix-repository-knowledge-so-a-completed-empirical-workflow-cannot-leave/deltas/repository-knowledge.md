## MODIFIED Requirements

### Requirement: Initialization creates compact repository knowledge

First agent-owned initialization and explicit `empirical-init` MUST create the
bounded inventory and navigable topic pages. When a nonempty repository still
has managed or legacy placeholder topic pages, reports MUST identify those
paths as refinement-required and MUST NOT expose them as usable knowledge.

#### Scenario: An empty repository gains its first implementation

- **GIVEN** initialization created placeholder topic pages for an empty repository
- **WHEN** implementation adds source files and context is refreshed
- **THEN** the inventory updates and semantic topic pages are reported refinement-required
- **AND** the workflow cannot treat those placeholders as usable repository knowledge

### Requirement: Knowledge refresh is deterministic and safe

Refresh MUST preserve deliberate agent-maintained context, recognize exact
managed and legacy placeholder structures without broad prose heuristics, and
converge only after placeholder pages have been replaced with evidence-backed
content and the resulting page digests are recorded.

#### Scenario: An agent refines a managed topic page

- **WHEN** the agent inspects repository evidence, removes the managed marker, replaces placeholders, and refreshes again
- **THEN** the custom page is preserved byte-for-byte
- **AND** it becomes usable current knowledge

### Requirement: Workflow packets retrieve repository knowledge progressively

Explore and action packets MUST expose only current, semantically refined topic
pages as knowledge context while retaining the managed index when current.

#### Scenario: Placeholder topics exist

- **WHEN** an action packet retrieves repository knowledge
- **THEN** refinement-required topic paths are omitted from usable knowledge context
- **AND** the Context action names the exact remediation workflow
