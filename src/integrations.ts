import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { isFile, readJson, writeJsonAtomic, writeTextAtomic } from "./storage.js";
import type { IntegrationReport } from "./types.js";

const START = "<!-- empirical-sdd:start -->";
const END = "<!-- empirical-sdd:end -->";

const GUIDANCE = `${START}
## Empirical SDD

When the user asks to build, change, fix, or continue a feature:

1. Prefer the Empirical MCP tools when they are available.
2. Otherwise run \`empirical next --json\`. If no feature is active, run
   \`empirical start "<the user's request>" --json\` first.
3. Follow the returned phase instructions and acceptance criteria.
4. Report the phase with \`empirical complete\` at the exact returned revision.
5. Continue until Done, Blocked, or genuinely awaiting human input.

Do not invent workflow state or weaken verification evidence. The committed
\`.empirical/\` directory is the source of truth.
${END}`;

const MCP_SERVER = {
  command: "empirical",
  args: ["mcp"],
};

export async function installProjectIntegrations(root: string): Promise<IntegrationReport> {
  const report: IntegrationReport = { created: [], updated: [], preserved: [] };

  await mergeMarkdown(root, join(root, "AGENTS.md"), GUIDANCE, report);
  await mergeMarkdown(root, join(root, "CLAUDE.md"), GUIDANCE, report);
  await mergeMarkdown(root, join(root, "GEMINI.md"), GUIDANCE, report);

  await mergeMcpJson(root, join(root, ".mcp.json"), report);
  await mergeMcpJson(root, join(root, ".cursor", "mcp.json"), report);
  await mergeMcpJson(root, join(root, ".gemini", "settings.json"), report, { cwd: "." });
  await mergeCodexToml(root, join(root, ".codex", "config.toml"), report);

  return report;
}

async function mergeMarkdown(
  root: string,
  path: string,
  managed: string,
  report: IntegrationReport,
): Promise<void> {
  if (!(await isFile(path))) {
    await writeTextAtomic(path, `${managed}\n`);
    report.created.push(relativeLabel(root, path));
    return;
  }
  const current = await readFile(path, "utf8");
  const start = current.indexOf(START);
  const end = current.indexOf(END);
  if (start >= 0 && end >= start) {
    const next = `${current.slice(0, start)}${managed}${current.slice(end + END.length)}`;
    if (next !== current) {
      await writeTextAtomic(path, next);
      report.updated.push(relativeLabel(root, path));
    }
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
  const start = "# empirical-sdd:mcp:start";
  const end = "# empirical-sdd:mcp:end";
  const block = `${start}
[mcp_servers.empirical]
command = "empirical"
args = ["mcp"]
cwd = ".."
${end}`;
  if (!(await isFile(path))) {
    await writeTextAtomic(path, `${block}\n`);
    report.created.push(relativeLabel(root, path));
    return;
  }
  const current = await readFile(path, "utf8");
  const blockStart = current.indexOf(start);
  const blockEnd = current.indexOf(end);
  if (blockStart >= 0 && blockEnd >= blockStart) {
    const next = `${current.slice(0, blockStart)}${block}${current.slice(blockEnd + end.length)}`;
    if (next !== current) {
      await writeTextAtomic(path, next);
      report.updated.push(relativeLabel(root, path));
    }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function relativeLabel(root: string, path: string): string {
  return relative(root, path).replaceAll("\\", "/");
}
