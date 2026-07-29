import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { EmpiricalError } from "./errors.js";
import { isFile, writeTextAtomic, type ProjectStore } from "./storage.js";
import type { DecisionSummary, DecisionValidationReport } from "./types.js";

interface ParsedDecision {
  id: string;
  title: string;
  status: "Proposed" | "Accepted" | "Superseded";
  evidence: string;
  options: string;
  chosenApproach: string;
  tradeoffs: string;
  verification: string;
  supersedes: string[];
  supersededBy: string | null;
}

const REQUIRED_SECTIONS = [
  "Evidence",
  "Options",
  "Chosen approach",
  "Trade-offs and risks",
  "Verification",
] as const;

export function decisionPath(store: ProjectStore, feature: string): string {
  return join(store.specDirectory(feature), "decisions.md");
}

export async function createDecisionTemplate(store: ProjectStore, feature: string): Promise<void> {
  const path = decisionPath(store, feature);
  await store.assertFeaturePathSafe(feature, [path]);
  if (await isFile(path)) return;
  await writeTextAtomic(path, renderDecisionTemplate(feature));
}

export async function validateDecisions(
  store: ProjectStore,
  feature: string,
  requireAccepted = true,
): Promise<DecisionValidationReport> {
  const path = decisionPath(store, feature);
  await store.assertFeaturePathSafe(feature, [path]);
  if (!(await isFile(path))) {
    return { valid: false, decisions: [], issues: [`Create ${path}`] };
  }
  return parseDecisions(await readFile(path, "utf8"), requireAccepted);
}

export function parseDecisions(markdown: string, requireAccepted = true): DecisionValidationReport {
  const issues: string[] = [];
  if (/^#{1,6}\s+.*(?:chain[- ]of[- ]thought|private reasoning|prompt transcript|scratchpad|credentials?|secrets?)\b/im.test(markdown)) {
    issues.push("Decision records cannot contain hidden-reasoning, prompt, credential, or secret sections");
  }
  const heading = /^##\s+(D-\d{3}):\s*(.+?)\s*$/gim;
  const matches = [...markdown.matchAll(heading)];
  const parsed: ParsedDecision[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]!;
    const id = match[1]!.toUpperCase();
    const title = match[2]!.trim();
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? markdown.length;
    const body = markdown.slice(start, end);
    if (seen.has(id)) issues.push(`${id} is duplicated`);
    seen.add(id);
    const statusMatch = /^Status:\s*(Proposed|Accepted|Superseded)\s*$/im.exec(body);
    if (!statusMatch) {
      issues.push(`${id} needs Status: Proposed, Accepted, or Superseded`);
      continue;
    }
    const sections = new Map<string, string>();
    for (const name of REQUIRED_SECTIONS) sections.set(name, section(body, name));
    for (const name of REQUIRED_SECTIONS) {
      const value = sections.get(name) ?? "";
      if (!meaningful(value)) issues.push(`${id} has an empty ${name} section`);
    }
    const supersedes = /^Supersedes:\s*(.+)$/im.exec(body)?.[1]
      ?.split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean) ?? [];
    const supersededBy = /^Superseded by:\s*(D-\d{3})\s*$/im.exec(body)?.[1]?.toUpperCase() ?? null;
    const status = statusMatch[1] as ParsedDecision["status"];
    if (status === "Superseded" && !supersededBy) issues.push(`${id} is Superseded but has no Superseded by link`);
    if (status !== "Superseded" && supersededBy) issues.push(`${id} has Superseded by but is not Superseded`);
    parsed.push({
      id,
      title,
      status,
      evidence: sections.get("Evidence") ?? "",
      options: sections.get("Options") ?? "",
      chosenApproach: sections.get("Chosen approach") ?? "",
      tradeoffs: sections.get("Trade-offs and risks") ?? "",
      verification: sections.get("Verification") ?? "",
      supersedes,
      supersededBy,
    });
  }
  if (parsed.length === 0) issues.push("Add at least one material decision entry");
  if (requireAccepted && !parsed.some((decision) => decision.status === "Accepted")) {
    issues.push("Accept at least one material decision before completing Design");
  }
  const byId = new Map(parsed.map((decision) => [decision.id, decision]));
  for (const decision of parsed) {
    for (const previousId of decision.supersedes) {
      const previous = byId.get(previousId);
      if (!previous) issues.push(`${decision.id} supersedes missing ${previousId}`);
      else if (previous.status !== "Superseded" || previous.supersededBy !== decision.id) {
        issues.push(`${decision.id} and ${previousId} need reciprocal supersession links`);
      }
    }
    if (decision.supersededBy) {
      const replacement = byId.get(decision.supersededBy);
      if (!replacement || !replacement.supersedes.includes(decision.id)) {
        issues.push(`${decision.id} points to ${decision.supersededBy} without a reciprocal Supersedes link`);
      }
    }
  }
  const decisions: DecisionSummary[] = parsed
    .filter((decision): decision is ParsedDecision & { status: "Accepted" | "Superseded" } => decision.status !== "Proposed")
    .map((decision) => ({
      id: decision.id,
      title: decision.title,
      status: decision.status,
      chosenApproach: summarize(decision.chosenApproach),
      supersedes: decision.supersedes,
      supersededBy: decision.supersededBy,
    }));
  return { valid: issues.length === 0, decisions, issues };
}

export async function requireValidDecisions(store: ProjectStore, feature: string): Promise<DecisionSummary[]> {
  const report = await validateDecisions(store, feature, true);
  if (!report.valid) {
    throw new EmpiricalError("DECISIONS_REQUIRED", `Decision record is incomplete: ${report.issues.join("; ")}`);
  }
  return report.decisions;
}

function section(body: string, title: string): string {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^###\\s+${escaped}\\s*$`, "im").exec(body);
  if (!match) return "";
  const start = (match.index ?? 0) + match[0].length;
  const next = /^###\s+/m.exec(body.slice(start));
  return body.slice(start, next?.index === undefined ? body.length : start + next.index).trim();
}

function meaningful(value: string): boolean {
  const clean = value.replace(/<!--[^]*?-->/g, "").replace(/[-*#>`_\s]/g, "").trim();
  return clean.length >= 3 && !/^(todo|tbd|none|n\/a|fillthisin)$/i.test(clean);
}

function summarize(value: string): string {
  return value.replace(/^[-*]\s+/gm, "").replace(/\s+/g, " ").trim().slice(0, 500);
}

function renderDecisionTemplate(feature: string): string {
  return `# Decisions: ${title(feature)}

Record concise, externally reviewable evidence and choices here. Do not store
private chain-of-thought, prompts, credentials, secrets, or scratchpad text.

## D-001: Select the implementation approach

Status: Proposed

### Evidence

<!-- Repository facts, user constraints, or measured behavior. -->

### Options

<!-- Two or more viable approaches. -->

### Chosen approach

<!-- Change Status to Accepted and state the chosen approach. -->

### Trade-offs and risks

<!-- Costs, limitations, failure modes, and mitigations. -->

### Verification

<!-- Checks that will prove the decision was implemented correctly. -->
`;
}

function title(feature: string): string {
  return feature.split("-").filter(Boolean).map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`).join(" ");
}
