# Agent Integrations Specification

## Purpose

Make Empirical workflows discoverable and safely invocable either from one
repository or globally across a developer's projects using each supported
agent's native extension mechanism.

## Requirements

### Requirement: Explicit global skill installation

Empirical SHALL provide an interactive `empirical install` selector outside an
initialized project over the pinned audited agent catalog. It MUST prioritize
detected and managed targets, remember explicit selection, show destinations and
status, accept non-interactive flags, and install exactly every entry in the
shared skill registry: `empirical`, `empirical-init`, `empirical-spec`,
`empirical-socratic`, `empirical-loop`, and `empirical-yolo`. Counts and labels
MUST derive from that registry. Installation MUST NOT initialize project state,
require network access, invoke `npx`, or launch an agent.

#### Scenario: A developer installs one selected target

- **WHEN** selection is submitted
- **THEN** exactly the six registered skills are reconciled at its safe destination
- **AND** reports derive the installed count from the same registry

### Requirement: Global integration preserves user configuration

Installation and update MUST reconcile selected ids and their unique normalized
destinations, persist enough marker-owned selection metadata to distinguish
agents that share a root, and remove a shared root only when no selected target
still depends on it. They MUST write or remove only Empirical-managed targets,
preserve unmanaged files, directories, symbolic links, and unrelated
configuration, and constrain every destination to the selected user home.
Marker-owned legacy skills and marker-owned project-local shadows MUST still be
removed safely and repeatably.

#### Scenario: Two selected agents share one global skill root

- **GIVEN** two catalog entries resolve to the same normalized destination
- **WHEN** one entry is deselected and the other remains selected
- **THEN** Empirical retains one converged copy of all five managed skills there
- **AND** the remembered selection records only the still-selected entry

#### Scenario: A target path is unsafe

- **WHEN** a catalog or filesystem resolution escapes the selected home or
  crosses a symbolic-link ancestor
- **THEN** installation preserves the target and reports the safety reason
- **AND** no other selected destination is broadened to compensate

### Requirement: Global discovery guidance is agent-accurate

Human and structured installation reports MUST identify selected agent ids,
unique native global skill roots, and created, updated, removed, or preserved
results. Verified invocation and reload guidance MAY be shown from explicit
catalog metadata, but missing runtime metadata MUST be labeled unknown. Reports
MUST NOT infer slash-command, MCP, prompt-launch, or workspace-launch support
from the ability to read skill files.

#### Scenario: A skill-only agent is installed

- **WHEN** the selected target has a global skill root but no verified runtime metadata
- **THEN** the report confirms the five installed skills and destination
- **AND** it makes no launch or MCP claim and does not invent invocation syntax

### Requirement: Native user-invocable workflow entrypoints

The system SHALL expose six global Empirical skills per selected agent. The
automatic skill routes end to end; Init only configures context; Spec drafts a
concrete Complex contract; Socratic conducts five-pass discovery; Loop resumes
selected work; and YOLO records bounded standing authorization and runs through
the authorized completion ceiling while asking only blocker product questions.
Every skill MUST use MCP first and MAY use only private internal transport as
fallback.

#### Scenario: A developer invokes YOLO for implementation only

- **WHEN** the current repository has an approved specification
- **THEN** YOLO resumes it through the highest locally authorized safe completion
- **AND** does not infer remote delivery or publication authorization

### Requirement: Honest command discovery report

Root and subcommand help and README MUST present only `empirical install`,
`empirical update`, `empirical uninstall`, and the six native in-agent skills.
Each public subcommand MUST provide usable `--help`. Direct state-machine verbs
remain private and MUST be rejected as human terminal commands. Uninstall help
MUST distinguish removed global artifacts from preserved project state.

#### Scenario: A developer asks for uninstall help

- **WHEN** the developer runs `empirical uninstall --help`
- **THEN** help documents confirmation, global removal, and project preservation without mutation
- **AND** it does not expose private workflow commands

### Requirement: Update converges package and integrations

`empirical update` MUST install `empirical-sdd@latest` and invoke the newly
installed CLI as `empirical install --yes`. Update MUST preserve the remembered,
detected, or legacy-managed target set without prompting, MUST NOT expand an
empty set to the entire catalog, MUST report each stage distinctly, and MUST NOT
claim refresh success unless both stages pass.

#### Scenario: A broad prior selection is updated

- **WHEN** npm successfully installs the latest package
- **THEN** the new process reconciles the remembered selected ids and unique roots
- **AND** newly added catalog entries remain unselected until explicitly chosen

### Requirement: Explicit skills have disjoint approval boundaries

The generated explicit skills MUST state their inputs, mutations, stop
condition, and next valid entrypoint. Init MUST present the current or
recommended configuration with Apply, Customize, and Cancel choices before its
first configuration write and MUST NOT create feature state. Spec and Socratic
MUST NOT complete their pending Specify revision before the user approves the
drafted artifacts. Loop MUST NOT interpret free-form text as a new feature when
no active workflow exists.

#### Scenario: A repository needs first-run setup

- **WHEN** the user invokes `empirical-init` in a supported host
- **THEN** the host presents the effective settings and waits for confirmation
- **AND** cancelling leaves configuration and workflow state unchanged

### Requirement: Installation, MCP, and handoff capabilities are distinct

Empirical MUST model global skill-install targets independently from project
MCP-bridge targets and executable handoff targets. Broadening one catalog MUST
NOT implicitly broaden either of the others. Each structured and human report
MUST describe only the capabilities backed by explicit metadata.

#### Scenario: A newly cataloged IDE accepts global skills only

- **WHEN** the IDE is selected during `empirical install`
- **THEN** its native skill directory receives the five managed skills
- **AND** it is absent from MCP bridge and external-handoff choices unless those
  capabilities are separately implemented and verified

### Requirement: Agent catalog is deterministic and auditable

The packaged global agent catalog MUST record its upstream repository and pinned
revision or version, use stable ids and aliases, contain only safe home-relative
global roots, and load without telemetry or network access. CI MUST reject
duplicate ids, alias collisions, unsafe roots, non-deterministic order, and
entries with neither a supported global destination nor an explicit exclusion
reason.

#### Scenario: A maintainer refreshes upstream compatibility

- **WHEN** catalog data changes for a release
- **THEN** the reviewed diff records new provenance and target changes
- **AND** runtime installation remains fully local after the package is installed

### Requirement: Safe global uninstall is explicit and ownership-bound

Empirical SHALL provide `empirical uninstall` outside initialized repositories.
It MUST show the complete global removal and project-preservation scope before
interactive mutation, default to cancellation, require `--yes` for
non-interactive or JSON execution, remove only marker-owned current or obsolete
global skills and valid Empirical-owned selection metadata, preserve and report
unsafe or unmanaged targets, and invoke exact shell-free global npm package
removal only after integration cleanup succeeds. Repeated cleanup MUST converge.

#### Scenario: A developer confirms global removal

- **WHEN** the user approves uninstall with managed and unmanaged targets present
- **THEN** all Empirical-managed global skills and owned selection metadata are removed
- **AND** unmanaged files, repository history, and project MCP configuration remain unchanged
- **AND** `npm uninstall -g empirical-sdd` runs last

#### Scenario: Automation omits confirmation

- **WHEN** stdin is non-interactive or structured output is requested without `--yes`
- **THEN** uninstall refuses before changing files or invoking npm
