import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { isFile, isSymbolicLink, readJson, writeJsonAtomic, writeTextAtomic } from "./storage.js";
import type { IntegrationReport } from "./types.js";

const START = "<!-- empirical-sdd:start -->";
const END = "<!-- empirical-sdd:end -->";
const MANAGED_FILE_MARKER = "empirical-sdd:managed-file";

const GUIDANCE = `${START}
## Empirical SDD

Automatically use Empirical when the user asks to build, add, implement, change,
fix, refactor, remove, migrate, upgrade, update tests, or continue repository
work. The user does not need to mention Empirical.

1. Use the current agent; never launch another AI runtime.
2. Explore genuinely vague work through \`empirical_explore\` or
   \`empirical explore "<problem>"\` before creating workflow state.
3. For concrete new work, choose Fast only when it is explicit, tiny, localized,
   reversible, low-risk, and non-UI. Choose Complex for everything else.
4. Start through \`empirical_fast\` or \`empirical_complex\`. Without MCP, run
   \`empirical fast "<the user's request>"\` or
   \`empirical complex "<the user's request>"\`.
5. Resume active work through \`empirical_loop\` or \`empirical loop\`; loop
   takes no request or profile.
6. Preserve the packet workstream; use a different named workstream for unrelated
   active work. Execute the action and complete its exact revision with all required
   evidence. Each completion response is already the next action; do not call
   status, next, or loop redundantly.
7. When Review returns Archive, apply its validated capability deltas with the
   returned archive operation. Continue until Done, Blocked, or genuinely awaiting
   human input. For Fast, trust the criterion in the returned packet, inspect only relevant project
   files, combine the focused test and diff review, and use the returned
   completion command. Do not reread Empirical internals or add redundant checks.

Quick exists only for legacy compatibility. Do not select it for new work or
add profile/JSON controls to the normal workflow.

Do not invent workflow state or weaken verification evidence. The committed
\`.empirical/\` directory is the source of truth.
${END}`;

const SKILL = `---
name: empirical
description: Automatically run this repository's Empirical workflow for requests to build, add, implement, change, fix, refactor, remove, migrate, upgrade, test, or continue code. Resume unfinished work; skip read-only explanation or inspection.
---

<!-- ${MANAGED_FILE_MARKER} -->
# Empirical workflow

Use the current host agent to execute the work. Never launch another AI agent,
daemon, or runtime.

1. Treat the user's ordinary coding request as the workflow request. The user
   does not choose a command or profile.
2. Explore genuinely vague problems with \`empirical_explore\` or
   \`empirical explore "<problem>"\` before starting workflow state.
3. For concrete work, choose Fast only when the behavior is explicit and the change
   is tiny, localized, reversible, low-risk, and non-UI. Choose Complex otherwise,
   including UI, security, authentication, permissions, payments, destructive
   operations, migrations, dependencies, public APIs, infrastructure,
   architecture, or cross-cutting work.
4. Start new work with \`empirical_fast\` or \`empirical_complex\`. If MCP is
   unavailable, run \`empirical fast "<request>"\` or
   \`empirical complex "<request>"\`.
5. If work is already active, resume it with \`empirical_loop\` or
   \`empirical loop\`. Loop takes no request or profile.
6. Preserve the explicit packet workstream; create or address another workstream
   for unrelated active work. Execute the action and complete the exact revision with every
   required evidence item. For Fast, trust the generated criterion in the
   packet, inspect only relevant project files, implement directly, combine the
   focused test and diff review when practical, and use the returned completion
   command. Do not reread Empirical state/spec files or add redundant checks.
7. Treat each Fast, Complex, Complete, or Archive response as the next action.
   After Review, archive validated deltas into living capability specifications.
8. Stop only at \`done\`, \`blocked\`, or \`awaiting_human\`. Explain a blocker or
   required decision clearly. Keep Fast updates and checks proportional.

Quick exists only to resume legacy workflow state. Do not choose it for new
work or add profile/JSON controls to the normal path.

Never replace unrelated active work, invent state, or weaken acceptance criteria
or evidence. The committed \`.empirical/\` directory is the source of truth.
`;

const CURSOR_COMMAND = `<!-- ${MANAGED_FILE_MARKER} -->
# Empirical

Run the request attached to this command through the repository's Empirical
workflow. If there is no new request, resume the active feature.

Use the current Cursor agent. Explore vague problems first with
\`empirical_explore\` or \`empirical explore "<problem>"\`. For concrete work,
choose Fast only for explicit, tiny,
localized, reversible, low-risk non-UI changes and Complex otherwise. Start with
\`empirical_fast\` or \`empirical_complex\`; fall back to
\`empirical fast "<request>"\` or \`empirical complex "<request>"\`. Resume active
work with \`empirical_loop\` or \`empirical loop\`. Preserve its workstream, execute
each returned action, complete exact revisions with evidence, archive after Review, and consume the
response directly as the next action. Never select legacy Quick for new work,
add profile/JSON controls, or launch another AI runtime.
`;

const GEMINI_COMMAND = `# ${MANAGED_FILE_MARKER}
description = "Start or resume Empirical and continue in the current agent until a terminal state."
prompt = """
Run the request attached to this command through the repository's Empirical workflow. If there is no new request, resume the active feature.

Use the current Gemini agent. Explore vague problems first with empirical_explore or empirical explore "<problem>". For concrete work, choose Fast only for explicit, tiny, localized, reversible, low-risk non-UI changes and Complex otherwise. Start with empirical_fast or empirical_complex; fall back to empirical fast "<request>" or empirical complex "<request>". Resume active work with empirical_loop or empirical loop. Preserve workstream identity, complete exact revisions with evidence, archive after Review, and consume every response directly. Never select legacy Quick for new work, add profile/JSON controls, or launch another AI runtime.
"""
`;

const WINDSURF_WORKFLOW = `<!-- ${MANAGED_FILE_MARKER} -->
# Empirical

Start or resume the repository's Empirical workflow for the current request.

1. Use the current Cascade agent; never launch another AI runtime.
2. Explore vague problems with \`empirical_explore\` or
   \`empirical explore "<problem>"\` before starting workflow state.
3. For concrete work, choose Fast only for explicit, tiny, localized, reversible,
   low-risk non-UI changes and Complex otherwise.
4. Start with \`empirical_fast\` or \`empirical_complex\`; fall back to
   \`empirical fast "<request>"\` or \`empirical complex "<request>"\`.
5. Resume active work with \`empirical_loop\` or \`empirical loop\`.
6. Preserve its workstream, execute the action, and complete its exact revision with all required
   evidence.
7. Archive validated capability deltas after Review and consume every response.
8. Stop only at Done, Blocked, or awaiting human input.

Never select legacy Quick for new work or add profile/JSON controls to the
normal workflow.
`;

const MCP_SERVER = {
  command: "empirical",
  args: ["mcp"],
};

export async function installProjectIntegrations(root: string): Promise<IntegrationReport> {
  const report: IntegrationReport = { created: [], updated: [], preserved: [] };

  await mergeMarkdown(root, join(root, "AGENTS.md"), GUIDANCE, report);
  await mergeMarkdown(root, join(root, "CLAUDE.md"), GUIDANCE, report);
  await mergeMarkdown(root, join(root, "GEMINI.md"), GUIDANCE, report);

  await writeManagedFile(root, join(root, ".agents", "skills", "empirical", "SKILL.md"), SKILL, report);
  await writeManagedFile(root, join(root, ".claude", "skills", "empirical", "SKILL.md"), SKILL, report);
  await writeManagedFile(root, join(root, ".cursor", "commands", "empirical.md"), CURSOR_COMMAND, report);
  await writeManagedFile(root, join(root, ".gemini", "commands", "empirical.toml"), GEMINI_COMMAND, report);
  await writeManagedFile(root, join(root, ".windsurf", "workflows", "empirical.md"), WINDSURF_WORKFLOW, report);

  await mergeMcpJson(root, join(root, ".mcp.json"), report);
  await mergeMcpJson(root, join(root, ".cursor", "mcp.json"), report);
  await mergeMcpJson(root, join(root, ".gemini", "settings.json"), report, { cwd: "." });
  await mergeCodexToml(root, join(root, ".codex", "config.toml"), report);

  return report;
}

async function writeManagedFile(
  root: string,
  path: string,
  managed: string,
  report: IntegrationReport,
): Promise<void> {
  if (await preserveSymbolicLink(root, path, report)) return;
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

async function mergeMarkdown(
  root: string,
  path: string,
  managed: string,
  report: IntegrationReport,
): Promise<void> {
  if (await preserveSymbolicLink(root, path, report)) return;
  if (!(await isFile(path))) {
    await writeTextAtomic(path, `${managed}\n`);
    report.created.push(relativeLabel(root, path));
    return;
  }
  const current = await readFile(path, "utf8");
  const starts = markerIndexes(current, START);
  const ends = markerIndexes(current, END);
  if (starts.length === 1 && ends.length === 1 && ends[0]! >= starts[0]!) {
    const start = starts[0]!;
    const end = ends[0]!;
    const next = `${current.slice(0, start)}${managed}${current.slice(end + END.length)}`;
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
  const separator = current.endsWith("\n") ? "\n" : "\n\n";
  await writeTextAtomic(path, `${current}${separator}${managed}\n`);
  report.updated.push(relativeLabel(root, path));
}

async function mergeMcpJson(
  root: string,
  path: string,
  report: IntegrationReport,
  extra: Record<string, unknown> = {},
): Promise<void> {
  if (await preserveSymbolicLink(root, path, report)) return;
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
  if (await preserveSymbolicLink(root, path, report)) return;
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
    const blockStart = starts[0]!;
    const blockEnd = ends[0]!;
    const next = `${current.slice(0, blockStart)}${block}${current.slice(blockEnd + end.length)}`;
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

async function preserveSymbolicLink(
  root: string,
  path: string,
  report: IntegrationReport,
): Promise<boolean> {
  if (!(await isSymbolicLink(path))) return false;
  report.preserved.push(`${relativeLabel(root, path)} (symbolic link)`);
  return true;
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
