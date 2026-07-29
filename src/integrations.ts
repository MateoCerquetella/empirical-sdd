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
  "empirical-loop",
] as const;

export const SINGLE_AGENT_SKILL = `---
name: empirical
description: Initialize, understand, start, or resume Empirical repository work through one safe agent-native workflow.
---

<!-- ${MANAGED_FILE_MARKER} -->
# Empirical

Use the current host agent. This is the only user-facing Empirical workflow
entrypoint; never ask the user to invoke separate Explore, Fast, Complex, or
Loop skills.

1. If the repository is not initialized, inspect its manifests, documentation,
   source and test layout; ask only first-run answers that materially change Git
   isolation or decision policy; then pass the chosen isolation, base, worktree
   path, branch pattern, and decision policy to empirical_init (private CLI
   fallback: empirical __internal init). Do not install project-local workflow skills.
2. Call empirical_context (CLI fallback: empirical __internal context) on first use and
   whenever it reports stale repository knowledge. Complete or refresh the
   compact overview, architecture, commands, and conventions pages from actual
   repository evidence. Retrieve only context relevant to the current action.
3. If Empirical reports selected non-terminal work, call empirical_loop or
   empirical __internal loop with no request or profile and resume it. Never replace active
   work with attached invocation text.
4. For a genuinely vague new idea, call empirical_explore or empirical __internal explore
   "<idea>" --no-interview for context, then conduct five Socratic passes in the
   current conversation: problem/user, observable outcome, boundaries/non-goals,
   failure/risk, and verification. Ask one question at a time, add only a
   material follow-up, show the complete refined contract, and wait for explicit
   approval before creating workflow state.
5. For concrete work, call empirical_fast only when the change is explicit,
   tiny, localized, reversible, low-risk, and non-UI. Call empirical_complex for
   everything else, including UI, architecture, public APIs, security,
   permissions, payments, migrations, dependencies, infrastructure, or
   cross-cutting work. CLI fallbacks are empirical __internal fast and empirical __internal complex;
   these are internal operations, not additional user commands.
6. If unrelated work returns a worktree proposal, show its exact base, commit,
   branch, path, and command. Wait for explicit approval, then execute only the
   approved worktree creation operation.
7. Execute every returned action, complete its exact revision with every
   required artifact and evidence item, and consume the completion response as
   the next action. After Review, archive validated capability deltas. Stop only
   at Done, Blocked, or genuinely awaiting human input.
8. When a Complex Specify action has passed and the returned phase is Design,
   call empirical_handoff (CLI fallback: empirical __internal handoff) and offer exactly:
   Continue here, Save for later, or Continue in one detected agent. Detection
   and Save launch nothing. Before another runtime starts, display the selected
   agent, capability, cwd, and exact argv; wait for explicit human approval;
   revalidate the approval; then execute only the authorized argv through the
   host's terminal/session facility. Workspace-only launchers open the approved
   repository and must not be described as accepting a prompt.

Do not invent state, weaken acceptance criteria, store private chain-of-thought,
or expose credentials. Repository knowledge, specifications, decisions, and
evidence under .empirical/ are the durable source of truth; checkout-local Git
metadata selects which portable feature this checkout owns.
`;

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
    invocations: [definition.invocation],
    reload: definition.reload,
  }));

  for (const definition of SUPPORTED_AGENTS) {
    const skillRoot = join(home, ...definition.skillSegments);
    if (requestedIds.has(definition.id)) {
      await writeManagedFile(home, join(skillRoot, "empirical", "SKILL.md"), SINGLE_AGENT_SKILL, report);
    } else if (options.agents || options.all) {
      await removeManagedFile(home, join(skillRoot, "empirical", "SKILL.md"), report);
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
  const names = ["empirical", ...OBSOLETE_ENTRYPOINTS];
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
  for (const name of ["empirical", ...OBSOLETE_ENTRYPOINTS]) {
    const path = join(root, name, "SKILL.md");
    if (await isSafeRegularFile(home, path) && (await readFile(path, "utf8")).includes(MANAGED_FILE_MARKER)) {
      return true;
    }
  }
  return false;
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
