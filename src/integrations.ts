import { lstat, readFile, rm, rmdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  SUPPORTED_AGENTS,
  detectSupportedAgents,
  type SupportedAgentDefinition,
} from "./agents.js";
import { EmpiricalError } from "./errors.js";
import { isFile, readJson, writeJsonAtomic, writeTextAtomic } from "./storage.js";
import type { AgentIntegrationId, IntegrationReport } from "./types.js";

const START = "<!-- empirical-sdd:start -->";
const END = "<!-- empirical-sdd:end -->";
const MANAGED_FILE_MARKER = "empirical-sdd:managed-file";
const OBSOLETE_ENTRYPOINTS = [
  "empirical-explore",
  "empirical-fast",
  "empirical-complex",
] as const;

const AUTOMATIC_SKILL_BODY = `# Empirical

Use the current host agent to initialize, route, and complete Empirical work.
This is the automatic end-to-end path. Do not ask the user to choose Fast or
Complex and do not ask them to run hidden terminal commands.

1. Before interpreting a feature request, inspect .empirical/config.json and
   repository context. If configuration is missing, setupComplete is false, or
   context is missing, inspect manifests, documentation, source, and tests; ask
   one at a time only for choices that materially change Git isolation or
   decision policy; then call empirical_init. Call empirical_context when
   context is stale. Private fallbacks are empirical __internal init and
   empirical __internal context. Do not install project-local skills.
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
6. Execute every returned action, complete its exact revision with required
   artifacts and evidence, consume the response as the next action, and archive
   reviewed capability deltas. Stop only at Done, Blocked, or Awaiting Human.
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
   capabilities. Treat setupComplete false or missing context as partial setup,
   not as an initialized repository.
2. Ask one focused question at a time only when its answer changes isolation
   mode, base, sibling worktree path, branch pattern, or Complex decision
   records. Explain the safe shown default and accept it when the choice is not
   material. Never ask for Fast versus Complex.
3. Call empirical_init with the explicit chosen settings. Its private fallback
   is empirical __internal init with the equivalent flags. This safely removes
   only marker-owned project-local Empirical skills and installs MCP bridges;
   report any unmanaged collision it preserves.
4. Call empirical_context, or empirical __internal context as fallback, and
   refine overview, architecture, commands, and conventions only from inspected
   evidence. Confirm setupComplete is true and context is current.
5. Stop with a concise setup report and the valid next choices: empirical for
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
   artifacts, collect named evidence, call empirical_complete with the exact
   revision, and continue from its response. Use empirical_retry only for a
   returned repair path and empirical_archive only after reviewed deltas pass.
6. Show worktree or external-agent proposals exactly and wait for explicit
   approval before any authorized operation. Stop only at Done, Blocked, or
   Awaiting Human.

Use MCP operations first and empirical __internal only as fallback. Never start
unrelated work, weaken gates, expose credentials, or persist private
chain-of-thought.`;

function skillContent(name: string, description: string, body: string): string {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n<!-- ${MANAGED_FILE_MARKER} -->\n${body}\n\nUse Empirical MCP operations first. Use empirical __internal only when MCP is unavailable; it is a private agent fallback, never a command for the user to run.\n`;
}

export const EMPIRICAL_AGENT_SKILLS = [
  {
    name: "empirical",
    description: "Automatically initialize, route, resume, and complete Empirical repository work.",
    content: skillContent("empirical", "Automatically initialize, route, resume, and complete Empirical repository work.", AUTOMATIC_SKILL_BODY),
  },
  {
    name: "empirical-init",
    description: "Initialize or repair Empirical repository setup and compact context without starting feature work.",
    content: skillContent("empirical-init", "Initialize or repair Empirical repository setup and compact context without starting feature work.", INIT_SKILL_BODY),
  },
  {
    name: "empirical-spec",
    description: "Draft a concrete Complex SDD contract and stop for approval before implementation.",
    content: skillContent("empirical-spec", "Draft a concrete Complex SDD contract and stop for approval before implementation.", SPEC_SKILL_BODY),
  },
  {
    name: "empirical-socratic",
    description: "Conduct a durable five-pass Socratic interview and draft its Complex SDD contract for approval.",
    content: skillContent("empirical-socratic", "Conduct a durable five-pass Socratic interview and draft its Complex SDD contract for approval.", SOCRATIC_SKILL_BODY),
  },
  {
    name: "empirical-loop",
    description: "Resume the active Empirical specification through evidence, review, archive, and completion.",
    content: skillContent("empirical-loop", "Resume the active Empirical specification through evidence, review, archive, and completion.", LOOP_SKILL_BODY),
  },
] as const;

export type EmpiricalAgentSkill = typeof EMPIRICAL_AGENT_SKILLS[number];
export type EmpiricalAgentSkillName = EmpiricalAgentSkill["name"];
export const EMPIRICAL_AGENT_SKILL_NAMES: readonly EmpiricalAgentSkillName[] =
  EMPIRICAL_AGENT_SKILLS.map((skill) => skill.name);

const MCP_SERVER = {
  command: "empirical",
  args: ["mcp"],
};

export interface InstallGlobalAgentSkillsOptions {
  all?: boolean;
  agents?: AgentIntegrationId[];
  pathValue?: string;
}

export async function managedGlobalAgentIds(homeRoot = homedir()): Promise<AgentIntegrationId[]> {
  const home = validateHomeRoot(homeRoot);
  const managed: AgentIntegrationId[] = [];
  for (const definition of SUPPORTED_AGENTS) {
    if (await hasManagedGlobalTarget(home, definition)) managed.push(definition.id);
  }
  return managed;
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
  const detected = await detectSupportedAgents({
    homeRoot: home,
    ...(options.pathValue !== undefined ? { pathValue: options.pathValue } : {}),
    ...(options.all !== undefined ? { includeAll: options.all } : {}),
  });
  const detectedIds = new Set(detected.map((agent) => agent.id));
  for (const id of await managedGlobalAgentIds(home)) detectedIds.add(id);

  const requestedIds = options.agents
    ? new Set(options.agents)
    : options.all
      ? new Set(SUPPORTED_AGENTS.map((definition) => definition.id))
      : detectedIds;
  for (const id of requestedIds) {
    if (!SUPPORTED_AGENTS.some((definition) => definition.id === id)) {
      throw new EmpiricalError("INVALID_ARGUMENT", `Unsupported agent '${id}'`);
    }
  }
  const selected = SUPPORTED_AGENTS.filter((definition) => requestedIds.has(definition.id));
  const report = emptyReport("global");
  report.entrypoints = selected.map((definition) => ({
    id: definition.id,
    agent: definition.agent,
    kind: "skill",
    artifactRoot: join(home, ...definition.skillSegments),
    invocations: EMPIRICAL_AGENT_SKILLS.map((skill) => invocationFor(definition, skill.name)),
    reload: definition.reload,
  }));

  for (const definition of SUPPORTED_AGENTS) {
    const skillRoot = join(home, ...definition.skillSegments);
    if (requestedIds.has(definition.id)) {
      for (const skill of EMPIRICAL_AGENT_SKILLS) {
        await writeManagedFile(home, join(skillRoot, skill.name, "SKILL.md"), skill.content, report);
      }
    } else if (options.agents || options.all) {
      for (const skill of EMPIRICAL_AGENT_SKILLS) {
        await removeManagedFile(home, join(skillRoot, skill.name, "SKILL.md"), report);
      }
    }
    for (const obsolete of OBSOLETE_ENTRYPOINTS) {
      await removeManagedFile(home, join(skillRoot, obsolete, "SKILL.md"), report);
    }
  }
  return report;
}

function emptyReport(scope: IntegrationReport["scope"]): IntegrationReport {
  return { scope, created: [], updated: [], removed: [], preserved: [], entrypoints: [] };
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

async function hasManagedGlobalTarget(home: string, definition: SupportedAgentDefinition): Promise<boolean> {
  const root = join(home, ...definition.skillSegments);
  for (const name of [...EMPIRICAL_AGENT_SKILL_NAMES, ...OBSOLETE_ENTRYPOINTS]) {
    const path = join(root, name, "SKILL.md");
    if (await isSafeRegularFile(home, path) && (await readFile(path, "utf8")).includes(MANAGED_FILE_MARKER)) {
      return true;
    }
  }
  return false;
}

function invocationFor(
  definition: SupportedAgentDefinition,
  skillName: EmpiricalAgentSkillName,
): string {
  return definition.invocation.replace(/empirical$/, skillName);
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
    throw new EmpiricalError("INVALID_ARGUMENT", "Global installation requires a user home directory");
  }
  const home = resolve(homeRoot);
  if (dirname(home) === home) {
    throw new EmpiricalError("INVALID_ARGUMENT", "Global installation refuses a filesystem root as the user home");
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
