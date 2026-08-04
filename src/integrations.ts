import { lstat, readFile, rm, rmdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  AGENT_CATALOG_SOURCE,
  agentSkillTarget,
  agentSkillTargetPath,
  detectAgentSkillTargets,
  globalAgentSkillTargets,
  resolveAgentSkillTargetId,
  type AgentSkillTargetId,
  type GlobalAgentSkillTarget,
} from "./agent-catalog.js";
import { EmpiricalError } from "./errors.js";
import { SKILLS } from "./operations.js";
import { isFile, readJson, writeJsonAtomic, writeTextAtomic } from "./storage.js";
import type { IntegrationReport } from "./types.js";

const START = "<!-- empirical-sdd:start -->";
const END = "<!-- empirical-sdd:end -->";
const MANAGED_FILE_MARKER = "empirical-sdd:managed-file";
const OBSOLETE_ENTRYPOINTS = [
  "empirical-explore",
  "empirical-fast",
  "empirical-complex",
] as const;
const GLOBAL_SELECTION_SCHEMA = 1 as const;
const GLOBAL_SELECTION_OWNER = "empirical-sdd" as const;
const UNVERIFIED_RUNTIME_GUIDANCE = "Skill files installed; invocation and reload guidance for this runtime has not been verified.";

const AUTOMATIC_SKILL_BODY = `# Empirical

Use the current host agent to initialize, route, and complete Empirical work.
This is the automatic end-to-end path. Do not ask the user to choose Fast or
Complex and do not ask them to run hidden terminal commands.

1. Before interpreting a feature request, inspect .empirical/config.json and
   repository context. If configuration is missing, setupComplete is false, or
   context is missing, inspect manifests, documentation, source, tests, and Git
   base without writing. Before calling any mutating setup operation, render the
   complete empirical-init Verification, Parallel work, and Decisions summary
   and offer Apply recommended settings (or Keep current settings), Customize,
   and Cancel. On Customize, visit one section at a time and end with a complete
   Save, Edit, or Cancel review. Cancel stops setup without calling empirical_init,
   empirical_context, or any private fallback. After confirmation, call
   empirical_init with all four explicit evidence booleans plus isolation, base,
   path, branch, and decision policy. Call empirical_context when context is
   stale. Private fallbacks are empirical __internal init with equivalent flags
   and empirical __internal context. Do not install project-local skills.
2. If selected non-terminal work exists, call empirical_loop with no request or
   profile and resume the returned action. Attached text never replaces active
   work. The private fallback is empirical __internal loop.
3. For a genuinely vague new idea, call empirical_explore for repository and
   capability context, then call empirical_discovery with empty answers to
   create the draft and receive its first nextQuestion. Ask only the returned
   pass or material follow-up, one at a time, and resubmit the ordered answers
   after each response. The five passes are problem/user, observable outcome,
   boundaries/non-goals, risk/failure, and verification. Show the returned exact
   refined contract and wait for approval before calling empirical_discovery
   with approved true.
   Private fallbacks are empirical __internal explore and empirical __internal
   discovery --input <json-file>.
4. For concrete work, call empirical_fast only when it is explicit, tiny,
   localized, reversible, low-risk, and non-UI. Call empirical_complex for
   everything else, including UI, architecture, public APIs, security,
   permissions, payments, migrations, dependencies, infrastructure, or
   cross-cutting work. Private fallbacks are empirical __internal fast and
   empirical __internal complex; these are agent operations, not user commands.
5. Show any worktree proposal exactly and wait for approval before calling the
   approved creation operation. Never stash, force, or replace selected work.
6. Execute every returned action, create immutable evidence receipts with the
   configured commands or collected artifacts, complete its exact revision with
   receipt ids, consume the response as the next action, and integrate reviewed
   capability deltas against an independent target. When Context is returned,
   call empirical_context, inspect repository evidence, replace every reported
   refinement-required topic, remove its managed marker, call empirical_context
   again, and complete only when stale, missing, and refinementRequired are all
   empty. Report the exact highest completion level. Stop only at Done, Blocked,
   or Awaiting Human.
7. After Complex Specify passes, empirical_handoff may offer Continue here,
   Save for later, or one detected agent. Detection and Save launch nothing;
   another runtime requires explicit approval of its exact target, cwd, and argv.

Do not invent state, weaken acceptance criteria, expose credentials, or persist
private chain-of-thought. Files under .empirical/ are the durable source of truth.`;

const INIT_SKILL_BODY = `# Empirical Init

Initialize or repair Empirical repository setup in the current host agent. This
skill owns setup and compact repository knowledge only; it must not create a
feature, specification, workflow revision, worktree, or external agent session.

1. Inspect .empirical/config.json, .empirical/context/, repository manifests,
   documentation, source layout, tests, Git state, and existing living
   capabilities without writing. Treat setupComplete false or missing context
   as partial setup, not as initialized. Resolve the current Git base for display
   while preserving the stored value \`auto\` unless the user edits it.
2. Before any empirical_init, empirical_context, or private fallback call, show
   one compact “Empirical setup” summary with these exact sections and settings:
   Verification (acceptance-test evidence for every criterion, real-browser
   evidence for [UI], screenshot artifacts for [UI], independent code-review
   evidence); Parallel work (ask/off isolation, base, sibling worktree path,
   branch pattern); and Decisions (required/off Complex decision records).
   All first-run settings default on/ask/required with base auto, path
   ../{repo}-{feature}, and branch {type}/{feature}. Label existing values
   current and do not reset omitted values during repair.
3. Offer Apply recommended settings, Customize, and Cancel on first run; offer
   Keep current settings, Customize, and Cancel on repair. Apply/Keep is the
   shown default. Cancel stops immediately and creates or repairs nothing.
   Never ask for Fast/Complex or repair-attempt limits.
4. Customize one section at a time. Verification is a four-value checklist.
   Explain that turning criterion evidence off makes test/browser/screenshot
   gates inactive without erasing the stored UI values, while code review stays
   independent. Validate ask/off, required/off, a worktree path containing
   {feature}, and a branch pattern containing {type} and {feature}. Show the
   worktree templates as editable only while isolation is ask; otherwise keep
   their stored values. Show the complete effective summary and offer Save,
   Edit, or Cancel; do not mutate until Save.
5. Only after Apply/Keep/Save, call empirical_init with explicit
   evidenceRequired, browserForUi, screenshotForUi, codeReview, isolation, base,
   worktreePath, branchPattern, and decisions values. Its private fallback is
   empirical __internal init with equivalent --evidence, --ui-browser,
   --ui-screenshot, --code-review, --isolation, --base, --worktree-path,
   --branch-pattern, and --decisions flags. This safely removes only marker-owned
   project-local Empirical skills and installs MCP bridges; report preserved
   unmanaged collisions.
6. Call empirical_context, or empirical __internal context as fallback, and
   inspect its refinementRequired field. Refine overview, architecture,
   commands, and conventions only from inspected evidence, remove the managed
   marker from refined pages, then call context again. Confirm setupComplete is
   true and stale, missing, and refinementRequired are all empty.
7. Stop with a concise setup report and the valid next choices: empirical for
   automatic work, empirical-spec for a concrete contract, or
   empirical-socratic for an interview.

Never tell the user to run empirical init in a terminal. Never start feature
work while performing initialization, and never expose secrets or private
chain-of-thought.`;

const SPEC_SKILL_BODY = `# Empirical Spec

Turn one concrete request into a reviewable Complex SDD contract in the current
host agent, then stop for approval before implementation.

1. Require a concrete feature request; ask only for missing information that
   materially changes its observable contract. Inspect repository setup first.
   If missing or partial, perform the empirical-init contract with empirical_init
   and empirical_context before starting feature state.
2. Call empirical_complex with the exact refined request. The private fallback
   is empirical __internal complex. Never expose Fast or Complex as a user
   choice. If unrelated work yields a worktree proposal, display its exact base,
   commit, branch, path, and argv and wait for explicit approval before creation.
3. Execute only the returned Specify action: inspect relevant implementation,
   repository context, policy, and living capability specifications; write a
   complete spec.md with observable acceptance criteria, scope, non-goals,
   risks, and verification; write every required ADDED, MODIFIED, or REMOVED
   capability delta with concrete scenarios.
4. Present the resulting contract, artifact paths, important decisions, and any
   remaining ambiguity. Leave the Specify revision waiting. Do not call
   empirical_complete and do not write implementation code.
5. Tell the user that invoking empirical-loop after review is explicit approval
   to complete Specify and continue through the evidence-gated workflow.

Use MCP operations first and empirical __internal only as fallback. Do not
invent repository behavior, weaken gates, expose credentials, or store private
chain-of-thought.`;

const SOCRATIC_SKILL_BODY = `# Empirical Socratic

Clarify an idea through the original five-pass Socratic interview, preserve the
answers, draft its Complex SDD contract, and stop for specification approval.

1. Require an idea and ensure repository setup is complete; if missing or
   partial, perform the empirical-init contract before discovery.
2. Call empirical_explore for read-only repository, policy, and capability
   context. Call empirical_discovery with empty answers to create the record and
   receive its first nextQuestion. Ask exactly that one question, reflect the
   answer briefly, and ask only a returned material follow-up. The five passes
   are problem/user, outcome, boundaries/non-goals, risk/failure, and verification.
3. After every answer or follow-up, call empirical_discovery with the returned
   discovery id, original problem, and ordered answers. This persists the draft
   and returns the next single question.
   Private fallbacks are empirical __internal explore and empirical __internal
   discovery --input <json-file>.
4. After all five passes, show the complete refined request and wait for
   explicit approval. Saving or rejecting starts nothing. On approval, call
   empirical_discovery with approved true; it binds that exact request to
   internal Complex Specify. Never offer Fast versus Complex.
5. If an isolation proposal is returned, display it exactly and wait for human
   approval before creating its worktree. Otherwise execute only the returned
   Specify action: inspect relevant code and living specifications, write the
   complete spec.md and required capability deltas, then present them.
6. Leave Specify waiting. Do not call empirical_complete and do not implement
   code. Tell the user that empirical-loop after review is explicit approval to
   continue.

Use the current host agent only. Never expose credentials, persist private
chain-of-thought, invent answers, or create workflow state before approval.`;

const LOOP_SKILL_BODY = `# Empirical Loop

Resume the selected Empirical specification in the current host agent and drive
its exact state machine to a terminal result. This skill does not accept or
route a new feature request.

1. Call empirical_loop with only the repository root. The private fallback is
   empirical __internal loop. Ignore attached feature text as routing input.
2. If no feature is active, create no state. Direct the user to empirical for
   automatic work, empirical-spec for a concrete contract, or
   empirical-socratic for discovery, then stop.
3. Treat invocation after reviewing an empirical-spec or empirical-socratic
   draft as approval to continue. Validate the existing Specify artifacts,
   complete that exact revision, and consume the returned response as the next
   action. If artifacts are absent or incomplete, execute the returned Specify
   instructions before completion.
4. When Complex Specify completion returns Design, call empirical_handoff and
   offer Continue here, Save for later, or one detected agent. Detection and
   Save launch nothing. An external runtime requires explicit approval of its
   exact target, capability, cwd, and argv; workspace-only agents must not be
   described as accepting a prompt.
5. For every subsequent action, retrieve only relevant repository context,
   preserve approved decisions and acceptance criteria, create required
   artifacts, execute configured commands or collect immutable evidence
   receipts, call empirical_complete with the exact revision and receipt ids,
   and continue from its response. For Context, refresh, inspect evidence,
   replace reported placeholder topics, remove their managed markers, refresh
   again, and complete only when the report is current and refinement-complete.
   Use empirical_retry only for a returned repair path and empirical_integrate
   only after reviewed deltas pass.
6. Show worktree or external-agent proposals exactly and wait for explicit
   approval before any authorized operation. Stop only at Done, Blocked, or
   Awaiting Human.

Use MCP operations first and empirical __internal only as fallback. Never start
unrelated work, weaken gates, expose credentials, or persist private
chain-of-thought.`;

const YOLO_SKILL_BODY = `# Empirical YOLO

Advance one request autonomously in the current host agent up to the exact
standing-authorization ceiling. YOLO changes workflow approval semantics; it
does not weaken host, Git, credential, release, evidence, or deletion safety.

1. Require the exact request and an explicit completion ceiling. Default to
   integrated. Delivered requires Policy v2 GitHub delivery configuration and
   an exact target branch. Never accept published here: publication requires a
   separate explicit publish operation with an exact version and dist-tag.
2. Call empirical_yolo with that exact request, ceiling, target branch when
   applicable, and external-agent permission. Its private fallback is empirical
   __internal yolo with equivalent fields. The returned immutable authorization
   cannot be widened or replaced; a broader request requires new feature state.
3. Follow the returned deterministic route and risk floor. Fast remains
   contract-neutral only. Autonomously draft and approve complete specification,
   design, planning, implementation, verification, review, and integration
   artifacts while the authorization covers them. Complete any returned Context
   phase by refreshing inventory, refining reported placeholder topics from
   inspected evidence, removing managed markers, and refreshing again. Create
   executed or collected immutable evidence receipts and pass only receipt ids
   to completion.
4. Ask a product question only when two or more materially different correct
   outcomes remain and repository facts, Policy v2, accepted decisions, and a
   safe default cannot resolve them. Persist the blocker and stop. Do not ask
   for routine workflow approval already covered by standing authorization.
5. For behavioral work, maintain the impact manifest and capability deltas,
   honor shared capability claims, and call empirical_integrate against an
   independently resolved target. Never report integrated without its receipt.
6. If the ceiling is delivered, use only empirical_deliver and its authorized
   GitHub source/evidence pull-request sequence. Wait for required checks and a
   normal protected merge. Report delivered only from independently queried
   remote merge commits. Stop at the authorization ceiling.

Never suppress host or operating-system prompts, force Git, bypass branch
protection, replace immutable tags/releases/versions, inspect or extract
credentials, infer publication, delete real worktrees or branches, accept
caller-asserted evidence booleans, or claim a higher completion level than a
durable receipt proves. Use the current host agent unless the authorization
explicitly permits a detected external agent.`;

function skillContent(name: string, description: string, body: string): string {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n<!-- ${MANAGED_FILE_MARKER} -->\n${body}\n\nUse Empirical MCP operations first. Use empirical __internal only when MCP is unavailable; it is a private agent fallback, never a command for the user to run.\n`;
}

type RegistrySkillId = typeof SKILLS[number]["id"];

const SKILL_BODIES: Record<RegistrySkillId, string> = {
  empirical: AUTOMATIC_SKILL_BODY,
  "empirical-init": INIT_SKILL_BODY,
  "empirical-loop": LOOP_SKILL_BODY,
  "empirical-socratic": SOCRATIC_SKILL_BODY,
  "empirical-spec": SPEC_SKILL_BODY,
  "empirical-yolo": YOLO_SKILL_BODY,
};

export const EMPIRICAL_AGENT_SKILLS = Object.freeze(
  SKILLS.map((definition) => ({
    name: definition.id,
    description: definition.description,
    content: skillContent(
      definition.id,
      definition.description,
      SKILL_BODIES[definition.id as RegistrySkillId]!,
    ),
  })),
);

export type EmpiricalAgentSkill = typeof EMPIRICAL_AGENT_SKILLS[number];
export type EmpiricalAgentSkillName = RegistrySkillId;
export const EMPIRICAL_AGENT_SKILL_NAMES: readonly EmpiricalAgentSkillName[] =
  EMPIRICAL_AGENT_SKILLS.map((skill) => skill.name);

const MCP_SERVER = {
  command: "empirical",
  args: ["mcp"],
};

export interface InstallGlobalAgentSkillsOptions {
  all?: boolean;
  agents?: readonly string[];
  pathValue?: string;
}

interface GlobalSelectionManifest {
  schemaVersion: typeof GLOBAL_SELECTION_SCHEMA;
  managedBy: typeof GLOBAL_SELECTION_OWNER;
  catalogCommit: typeof AGENT_CATALOG_SOURCE.commit;
  selected: AgentSkillTargetId[];
}

interface GlobalSelectionRead {
  selected: AgentSkillTargetId[] | null;
  warning: string | null;
  writable: boolean;
}

export async function managedGlobalAgentIds(homeRoot = homedir()): Promise<AgentSkillTargetId[]> {
  const home = validateHomeRoot(homeRoot);
  const manifest = await readGlobalSelection(home);
  if (manifest.selected) return manifest.selected;
  const managed: AgentSkillTargetId[] = [];
  for (const id of ["codex", "claude-code", "cursor", "gemini-cli", "windsurf"] as const) {
    const definition = agentSkillTarget(id) as GlobalAgentSkillTarget;
    if (await hasManagedGlobalTarget(home, definition)) managed.push(definition.id);
  }
  return managed;
}

export async function installedGlobalAgentIds(homeRoot = homedir()): Promise<AgentSkillTargetId[]> {
  const home = validateHomeRoot(homeRoot);
  const installed: AgentSkillTargetId[] = [];
  const roots = new Map<string, boolean>();
  for (const definition of globalAgentSkillTargets()) {
    const root = agentSkillTargetPath(home, definition);
    let managed = roots.get(root);
    if (managed === undefined) {
      managed = await hasManagedGlobalTarget(home, definition);
      roots.set(root, managed);
    }
    if (managed) installed.push(definition.id);
  }
  return installed;
}

export async function installProjectIntegrations(root: string): Promise<IntegrationReport> {
  const report = emptyReport("project");

  for (const filename of ["AGENTS.md", "CLAUDE.md", "GEMINI.md"]) {
    await removeManagedMarkdownBlock(root, join(root, filename), report);
  }
  for (const path of projectSkillTargets(root)) {
    await removeManagedFile(root, path, report);
  }

  await mergeMcpJson(root, join(root, ".mcp.json"), report);
  await mergeMcpJson(root, join(root, ".cursor", "mcp.json"), report);
  await mergeMcpJson(root, join(root, ".gemini", "settings.json"), report, { cwd: "." });
  await mergeCodexToml(root, join(root, ".codex", "config.toml"), report);
  return report;
}

export async function installGlobalAgentSkills(
  homeRoot = homedir(),
  options: InstallGlobalAgentSkillsOptions = {},
): Promise<IntegrationReport> {
  const home = validateHomeRoot(homeRoot);
  if (options.all && options.agents) {
    throw new EmpiricalError("INVALID_ARGUMENT", "Choose either all agents or explicit agents, not both");
  }
  const detected = await detectAgentSkillTargets({
    homeRoot: home,
    ...(options.pathValue !== undefined ? { pathValue: options.pathValue } : {}),
  });
  const detectedIds = new Set(detected);
  for (const id of await managedGlobalAgentIds(home)) detectedIds.add(id);

  const explicitIds = options.agents
    ? resolveRequestedAgentIds(options.agents)
    : null;
  const requestedIds = explicitIds
    ? new Set(explicitIds)
    : options.all
      ? new Set(globalAgentSkillTargets().map((definition) => definition.id))
      : detectedIds;
  const selected = globalAgentSkillTargets().filter((definition) => requestedIds.has(definition.id));
  const report = emptyReport("global");
  report.selected = selected.map((definition) => definition.id);
  report.destinations = [...new Set(selected.map((definition) => agentSkillTargetPath(home, definition)))];
  report.entrypoints = selected.map((definition) => ({
    id: definition.id,
    agent: definition.label,
    kind: "skill",
    artifactRoot: agentSkillTargetPath(home, definition),
    skills: [...EMPIRICAL_AGENT_SKILL_NAMES],
    invocations: definition.invocation
      ? EMPIRICAL_AGENT_SKILLS.map((skill) => invocationFor(definition.invocation!, skill.name))
      : [],
    reload: definition.reload ?? UNVERIFIED_RUNTIME_GUIDANCE,
    guidanceVerified: Boolean(definition.invocation && definition.reload),
    projectMcp: definition.projectMcp === true,
    handoff: definition.handoff === true,
  }));

  for (const [skillRoot, definitions] of groupedGlobalTargets(home)) {
    if (definitions.some((definition) => requestedIds.has(definition.id))) {
      for (const skill of EMPIRICAL_AGENT_SKILLS) {
        await writeManagedFile(home, join(skillRoot, skill.name, "SKILL.md"), skill.content, report);
      }
    } else if (options.agents !== undefined || options.all) {
      for (const skill of EMPIRICAL_AGENT_SKILLS) {
        await removeManagedFile(home, join(skillRoot, skill.name, "SKILL.md"), report);
      }
    }
    for (const obsolete of OBSOLETE_ENTRYPOINTS) {
      await removeManagedFile(home, join(skillRoot, obsolete, "SKILL.md"), report);
    }
  }
  await writeGlobalSelection(home, report.selected, report);
  return report;
}

export async function uninstallGlobalAgentSkills(
  homeRoot = homedir(),
): Promise<IntegrationReport> {
  const home = validateHomeRoot(homeRoot);
  const selection = await readGlobalSelection(home);
  const selectedIds = new Set(
    selection.selected ?? (await installedGlobalAgentIds(home)),
  );
  const selected = globalAgentSkillTargets()
    .filter((definition) => selectedIds.has(definition.id));
  const report = emptyReport("global");
  report.selected = selected.map((definition) => definition.id);
  report.destinations = [
    ...new Set(selected.map((definition) => agentSkillTargetPath(home, definition))),
  ];

  for (const [skillRoot] of groupedGlobalTargets(home)) {
    for (const name of [...EMPIRICAL_AGENT_SKILL_NAMES, ...OBSOLETE_ENTRYPOINTS]) {
      await removeManagedFile(home, join(skillRoot, name, "SKILL.md"), report);
    }
  }
  await removeGlobalSelection(home, report);
  return report;
}

function emptyReport(scope: IntegrationReport["scope"]): IntegrationReport {
  return { scope, selected: [], destinations: [], created: [], updated: [], removed: [], preserved: [], entrypoints: [] };
}

function projectSkillTargets(root: string): string[] {
  const names = [...EMPIRICAL_AGENT_SKILL_NAMES, ...OBSOLETE_ENTRYPOINTS];
  return names.flatMap((name) => [
    join(root, ".agents", "skills", name, "SKILL.md"),
    join(root, ".claude", "skills", name, "SKILL.md"),
    join(root, ".cursor", "commands", `${name}.md`),
    join(root, ".gemini", "commands", `${name}.toml`),
    join(root, ".windsurf", "workflows", `${name}.md`),
  ]);
}

async function hasManagedGlobalTarget(home: string, definition: GlobalAgentSkillTarget): Promise<boolean> {
  const root = agentSkillTargetPath(home, definition);
  for (const name of [...EMPIRICAL_AGENT_SKILL_NAMES, ...OBSOLETE_ENTRYPOINTS]) {
    const path = join(root, name, "SKILL.md");
    if (await isSafeRegularFile(home, path) && (await readFile(path, "utf8")).includes(MANAGED_FILE_MARKER)) {
      return true;
    }
  }
  return false;
}

function invocationFor(
  invocation: string,
  skillName: EmpiricalAgentSkillName,
): string {
  return invocation.replace(/empirical$/, skillName);
}

function resolveRequestedAgentIds(values: readonly string[]): AgentSkillTargetId[] {
  const requested = new Set<AgentSkillTargetId>();
  for (const value of values) {
    const id = resolveAgentSkillTargetId(value);
    if (!id) throw new EmpiricalError("INVALID_ARGUMENT", `Unsupported agent '${value}'`);
    const definition = agentSkillTarget(id);
    if (definition.globalSkillPath === null) {
      throw new EmpiricalError(
        "INVALID_ARGUMENT",
        `Agent '${value}' cannot be installed globally: ${definition.exclusionReason}`,
      );
    }
    requested.add(id);
  }
  return globalAgentSkillTargets()
    .filter((definition) => requested.has(definition.id))
    .map((definition) => definition.id);
}

function groupedGlobalTargets(home: string): Map<string, GlobalAgentSkillTarget[]> {
  const groups = new Map<string, GlobalAgentSkillTarget[]>();
  for (const definition of globalAgentSkillTargets()) {
    const root = agentSkillTargetPath(home, definition);
    const existing = groups.get(root) ?? [];
    existing.push(definition);
    groups.set(root, existing);
  }
  return groups;
}

function globalSelectionPath(home: string): string {
  return join(home, ".empirical-sdd", "integrations.json");
}

async function readGlobalSelection(home: string): Promise<GlobalSelectionRead> {
  const path = globalSelectionPath(home);
  const details = await lstat(path).catch((error) => {
    if (isMissingPathError(error)) return null;
    throw error;
  });
  if (!details) return { selected: null, warning: null, writable: true };
  if (!(await isSafeRegularFile(home, path))) {
    return { selected: null, warning: `${relativeLabel(home, path)} (unsafe or non-file selection metadata)`, writable: false };
  }
  let value: unknown;
  try {
    value = await readJson<unknown>(path);
  } catch {
    return { selected: null, warning: `${relativeLabel(home, path)} (invalid selection metadata)`, writable: false };
  }
  if (!isRecord(value)
    || value.schemaVersion !== GLOBAL_SELECTION_SCHEMA
    || value.managedBy !== GLOBAL_SELECTION_OWNER
    || typeof value.catalogCommit !== "string"
    || !/^[0-9a-f]{40}$/.test(value.catalogCommit)
    || !Array.isArray(value.selected)) {
    return { selected: null, warning: `${relativeLabel(home, path)} (unmanaged or incompatible selection metadata)`, writable: false };
  }
  const selected = resolveManifestSelection(value.selected);
  if (!selected) {
    return { selected: null, warning: `${relativeLabel(home, path)} (invalid selected agent ids)`, writable: false };
  }
  return { selected, warning: null, writable: true };
}

function resolveManifestSelection(values: unknown[]): AgentSkillTargetId[] | null {
  const ids = new Set<AgentSkillTargetId>();
  for (const value of values) {
    if (typeof value !== "string") return null;
    const id = resolveAgentSkillTargetId(value);
    if (!id || id !== value || agentSkillTarget(id).globalSkillPath === null || ids.has(id)) return null;
    ids.add(id);
  }
  return globalAgentSkillTargets().filter((target) => ids.has(target.id)).map((target) => target.id);
}

async function writeGlobalSelection(
  home: string,
  selected: AgentSkillTargetId[],
  report: IntegrationReport,
): Promise<void> {
  const state = await readGlobalSelection(home);
  if (!state.writable) {
    if (state.warning && !report.preserved.includes(state.warning)) report.preserved.push(state.warning);
    return;
  }
  const path = globalSelectionPath(home);
  if (await preserveUnsafeTarget(home, path, report)) return;
  const manifest: GlobalSelectionManifest = {
    schemaVersion: GLOBAL_SELECTION_SCHEMA,
    managedBy: GLOBAL_SELECTION_OWNER,
    catalogCommit: AGENT_CATALOG_SOURCE.commit,
    selected,
  };
  const existed = await isFile(path);
  if (existed) {
    const current = await readFile(path, "utf8");
    const desired = `${JSON.stringify(manifest, null, 2)}\n`;
    if (current === desired) return;
  }
  await writeJsonAtomic(path, manifest);
  (existed ? report.updated : report.created).push(relativeLabel(home, path));
}

async function removeGlobalSelection(
  home: string,
  report: IntegrationReport,
): Promise<void> {
  const state = await readGlobalSelection(home);
  if (!state.writable) {
    if (state.warning && !report.preserved.includes(state.warning)) {
      report.preserved.push(state.warning);
    }
    return;
  }
  if (state.selected === null) return;
  const path = globalSelectionPath(home);
  if (await preserveUnsafeTarget(home, path, report)) return;
  if (!(await isFile(path))) return;
  await rm(path);
  report.removed.push(relativeLabel(home, path));
  await rmdir(dirname(path)).catch((error: NodeJS.ErrnoException) => {
    if (!["ENOENT", "ENOTEMPTY", "EEXIST"].includes(error.code ?? "")) throw error;
  });
}

async function isSafeRegularFile(root: string, path: string): Promise<boolean> {
  const rootPath = resolve(root);
  const targetPath = resolve(path);
  const label = relativeLabel(rootPath, targetPath);
  if (!label || label === ".." || label.startsWith("../") || isAbsolute(label)) return false;
  const segments = label.split("/");
  let current = rootPath;
  for (let index = 0; index < segments.length; index += 1) {
    current = join(current, segments[index]!);
    const details = await lstat(current).catch(() => null);
    if (!details || details.isSymbolicLink()) return false;
    if (index < segments.length - 1 && !details.isDirectory()) return false;
    if (index === segments.length - 1) return details.isFile();
  }
  return false;
}

function validateHomeRoot(homeRoot: string): string {
  if (!homeRoot.trim()) {
    throw new EmpiricalError("INVALID_ARGUMENT", "Global integration requires a user home directory");
  }
  const home = resolve(homeRoot);
  if (dirname(home) === home) {
    throw new EmpiricalError("INVALID_ARGUMENT", "Global integration refuses a filesystem root as the user home");
  }
  return home;
}

async function writeManagedFile(
  root: string,
  path: string,
  managed: string,
  report: IntegrationReport,
): Promise<void> {
  if (await preserveUnsafeTarget(root, path, report)) return;
  const desired = managed.endsWith("\n") ? managed : `${managed}\n`;
  if (!(await isFile(path))) {
    await writeTextAtomic(path, desired);
    report.created.push(relativeLabel(root, path));
    return;
  }
  const current = await readFile(path, "utf8");
  if (!current.includes(MANAGED_FILE_MARKER)) {
    report.preserved.push(`${relativeLabel(root, path)} (existing unmanaged file)`);
    return;
  }
  if (current !== desired) {
    await writeTextAtomic(path, desired);
    report.updated.push(relativeLabel(root, path));
  }
}

async function removeManagedFile(root: string, path: string, report: IntegrationReport): Promise<void> {
  if (await preserveUnsafeTarget(root, path, report)) return;
  if (!(await isFile(path))) return;
  const current = await readFile(path, "utf8");
  if (!current.includes(MANAGED_FILE_MARKER)) {
    report.preserved.push(`${relativeLabel(root, path)} (existing unmanaged file)`);
    return;
  }
  await rm(path);
  report.removed.push(relativeLabel(root, path));
  await rmdir(dirname(path)).catch((error: NodeJS.ErrnoException) => {
    if (!["ENOENT", "ENOTEMPTY", "EEXIST"].includes(error.code ?? "")) throw error;
  });
}

async function removeManagedMarkdownBlock(
  root: string,
  path: string,
  report: IntegrationReport,
): Promise<void> {
  if (await preserveUnsafeTarget(root, path, report)) return;
  if (!(await isFile(path))) return;
  const current = await readFile(path, "utf8");
  const starts = markerIndexes(current, START);
  const ends = markerIndexes(current, END);
  if (starts.length === 0 && ends.length === 0) return;
  if (starts.length !== 1 || ends.length !== 1 || ends[0]! < starts[0]!) {
    report.preserved.push(`${relativeLabel(root, path)} (unmatched Empirical marker)`);
    return;
  }
  const [blockStart, blockEnd] = managedBlockBounds(current, starts[0]!, ends[0]! + END.length);
  const next = `${current.slice(0, blockStart)}${current.slice(blockEnd)}`;
  if (!next.trim()) {
    await rm(path);
    report.removed.push(relativeLabel(root, path));
  } else {
    await writeTextAtomic(path, next);
    report.updated.push(relativeLabel(root, path));
  }
}

function managedBlockBounds(contents: string, markerStart: number, markerEnd: number): [number, number] {
  const lineStart = contents.lastIndexOf("\n", markerStart - 1) + 1;
  const start = contents.slice(lineStart, markerStart).trim() ? markerStart : lineStart;
  let end = markerEnd;
  if (contents.startsWith("\r\n", end)) end += 2;
  else if (contents.startsWith("\n", end)) end += 1;
  return [start, end];
}

async function mergeMcpJson(
  root: string,
  path: string,
  report: IntegrationReport,
  extra: Record<string, unknown> = {},
): Promise<void> {
  if (await preserveUnsafeTarget(root, path, report)) return;
  let document: Record<string, unknown> = {};
  const existed = await isFile(path);
  if (existed) {
    try {
      document = await readJson<Record<string, unknown>>(path);
    } catch {
      report.preserved.push(`${relativeLabel(root, path)} (invalid JSON)`);
      return;
    }
  }
  if (document.mcpServers !== undefined && !isRecord(document.mcpServers)) {
    report.preserved.push(`${relativeLabel(root, path)} (invalid mcpServers value)`);
    return;
  }
  const servers = isRecord(document.mcpServers) ? document.mcpServers : {};
  const existing = servers.empirical;
  const desired = { ...MCP_SERVER, ...extra };
  if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(desired)) {
    report.preserved.push(`${relativeLabel(root, path)} (existing empirical MCP entry)`);
    return;
  }
  if (existing !== undefined) return;
  document.mcpServers = { ...servers, empirical: desired };
  await writeJsonAtomic(path, document);
  (existed ? report.updated : report.created).push(relativeLabel(root, path));
}

async function mergeCodexToml(root: string, path: string, report: IntegrationReport): Promise<void> {
  if (await preserveUnsafeTarget(root, path, report)) return;
  const start = "# empirical-sdd:mcp:start";
  const end = "# empirical-sdd:mcp:end";
  const block = `${start}
[mcp_servers.empirical]
command = "empirical"
args = ["mcp"]
${end}`;
  if (!(await isFile(path))) {
    await writeTextAtomic(path, `${block}\n`);
    report.created.push(relativeLabel(root, path));
    return;
  }
  const current = await readFile(path, "utf8");
  const starts = markerIndexes(current, start);
  const ends = markerIndexes(current, end);
  if (starts.length === 1 && ends.length === 1 && ends[0]! >= starts[0]!) {
    const next = `${current.slice(0, starts[0]!)}${block}${current.slice(ends[0]! + end.length)}`;
    if (next !== current) {
      await writeTextAtomic(path, next);
      report.updated.push(relativeLabel(root, path));
    }
    return;
  }
  if (starts.length > 0 || ends.length > 0) {
    report.preserved.push(`${relativeLabel(root, path)} (unmatched Empirical marker)`);
    return;
  }
  if (/^\s*\[mcp_servers\.empirical\]\s*$/m.test(current)) {
    report.preserved.push(`${relativeLabel(root, path)} (existing empirical MCP table)`);
    return;
  }
  const separator = current.endsWith("\n") ? "\n" : "\n\n";
  await writeTextAtomic(path, `${current}${separator}${block}\n`);
  report.updated.push(relativeLabel(root, path));
}

async function preserveUnsafeTarget(
  root: string,
  path: string,
  report: IntegrationReport,
): Promise<boolean> {
  const rootPath = resolve(root);
  const targetPath = resolve(path);
  const label = relativeLabel(rootPath, targetPath);
  if (!label || label === ".." || label.startsWith("../") || isAbsolute(label)) {
    throw new EmpiricalError("INVALID_ARGUMENT", `Integration target escapes its root: ${path}`);
  }

  const segments = label.split("/");
  let current = rootPath;
  for (let index = 0; index < segments.length; index += 1) {
    current = join(current, segments[index]!);
    let details;
    try {
      details = await lstat(current);
    } catch (error) {
      if (isMissingPathError(error)) return false;
      throw error;
    }
    if (details.isSymbolicLink()) {
      const suffix = index === segments.length - 1
        ? "symbolic link"
        : `symbolic link ancestor ${relativeLabel(rootPath, current)}`;
      report.preserved.push(`${label} (${suffix})`);
      return true;
    }
    if (index < segments.length - 1 && !details.isDirectory()) {
      report.preserved.push(`${label} (non-directory ancestor ${relativeLabel(rootPath, current)})`);
      return true;
    }
    if (index === segments.length - 1 && !details.isFile()) {
      report.preserved.push(`${label} (existing non-file)`);
      return true;
    }
  }
  return false;
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function markerIndexes(contents: string, marker: string): number[] {
  const indexes: number[] = [];
  let offset = 0;
  while (offset < contents.length) {
    const index = contents.indexOf(marker, offset);
    if (index < 0) break;
    indexes.push(index);
    offset = index + marker.length;
  }
  return indexes;
}

function relativeLabel(root: string, path: string): string {
  return relative(root, path).replaceAll("\\", "/");
}
