import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { join, relative } from "node:path";
import { EmpiricalError } from "./errors.js";
import { assertCapabilityId, isFile, isSymbolicLink, type ProjectStore } from "./storage.js";
import type {
  ArchiveReport,
  CapabilityDelta,
  CapabilitySummary,
  DeltaOperation,
  DeltaValidationReport,
  RequirementDelta,
} from "./types.js";

interface CapabilityProjection {
  capability: string;
  original: string | null;
  next: string;
}

export interface CapabilityArchivePlan {
  report: Omit<ArchiveReport, "feature" | "converged">;
  commit: () => Promise<() => Promise<void>>;
}

export async function loadCapabilityDeltas(
  store: ProjectStore,
  feature: string,
): Promise<CapabilityDelta[]> {
  const directory = store.deltaDirectory(feature);
  if (await isSymbolicLink(directory)) {
    throw new EmpiricalError("INVALID_DELTA", `Capability delta storage cannot use symbolic links: ${directory}`);
  }
  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new EmpiricalError("INVALID_DELTA", `Could not read ${directory}`, error);
  }
  const deltas: CapabilityDelta[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const capability = entry.name.slice(0, -3);
    assertCapabilityId(capability);
    const path = join(directory, entry.name);
    deltas.push(parseCapabilityDelta(capability, await readFile(path, "utf8"), portableRelative(store.root, path)));
  }
  return deltas;
}

export function parseCapabilityDelta(
  capability: string,
  markdown: string,
  source = `${capability}.md`,
): CapabilityDelta {
  assertCapabilityId(capability);
  const purpose = sectionContents(markdown, "Purpose");
  const requirements: RequirementDelta[] = [];
  const sectionPattern = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/gim;
  const sections = [...markdown.matchAll(sectionPattern)];
  for (let index = 0; index < sections.length; index += 1) {
    const match = sections[index]!;
    const label = match[1]!.toLowerCase();
    if (label === "renamed") {
      throw new EmpiricalError("INVALID_DELTA", `${source}: RENAMED requirements are not supported; use add/remove with migration text`);
    }
    const operation = label as DeltaOperation;
    const start = (match.index ?? 0) + match[0].length;
    const end = sections[index + 1]?.index ?? markdown.length;
    const body = markdown.slice(start, end);
    const blocks = requirementBlocks(body);
    if (blocks.length === 0) {
      throw new EmpiricalError("INVALID_DELTA", `${source}: ${match[1]} Requirements has no requirement blocks`);
    }
    for (const block of blocks) {
      if (!/^####\s+Scenario:\s*\S+/im.test(block.contents)) {
        throw new EmpiricalError("INVALID_DELTA", `${source}: requirement '${block.name}' needs at least one #### Scenario`);
      }
      requirements.push({ operation, name: block.name, contents: block.contents.trim() });
    }
  }
  if (requirements.length === 0) {
    throw new EmpiricalError("INVALID_DELTA", `${source}: no ADDED, MODIFIED, or REMOVED requirements found`);
  }
  return { capability, purpose: purpose?.trim() || null, requirements, source };
}

export async function validateFeatureDeltas(
  store: ProjectStore,
  feature: string,
): Promise<DeltaValidationReport> {
  try {
    const deltas = await loadCapabilityDeltas(store, feature);
    if (deltas.length === 0) {
      return {
        valid: false,
        capabilities: [],
        operations: 0,
        issues: [`Create at least one ${portableRelative(store.root, store.deltaDirectory(feature))}/<capability>.md delta`],
        digest: null,
      };
    }
    const planned = await buildProjections(store, deltas);
    return {
      valid: planned.issues.length === 0,
      capabilities: [...new Set(deltas.map((delta) => delta.capability))],
      operations: deltas.reduce((total, delta) => total + delta.requirements.length, 0),
      issues: planned.issues,
      digest: digestCapabilityDeltas(deltas),
    };
  } catch (error) {
    return {
      valid: false,
      capabilities: [],
      operations: 0,
      issues: [error instanceof Error ? error.message : String(error)],
      digest: null,
    };
  }
}

export async function capabilityDeltaDigest(
  store: ProjectStore,
  feature: string,
): Promise<string | null> {
  const deltas = await loadCapabilityDeltas(store, feature);
  return deltas.length === 0 ? null : digestCapabilityDeltas(deltas);
}

export async function planCapabilityArchive(
  store: ProjectStore,
  feature: string,
): Promise<CapabilityArchivePlan> {
  const deltas = await loadCapabilityDeltas(store, feature);
  if (deltas.length === 0) {
    throw new EmpiricalError("DELTA_REQUIRED", `Complex change ${feature} has no capability deltas`);
  }
  const planned = await buildProjections(store, deltas);
  if (planned.issues.length > 0) {
    throw new EmpiricalError("INVALID_DELTA", `Capability archive is invalid: ${planned.issues.join("; ")}`);
  }
  const counts = { added: 0, modified: 0, removed: 0 };
  for (const delta of deltas) {
    for (const requirement of delta.requirements) counts[requirement.operation] += 1;
  }
  return {
    report: {
      capabilities: planned.projections.map((projection) => projection.capability),
      ...counts,
    },
    commit: async () => {
      const applied: CapabilityProjection[] = [];
      const rollback = async () => {
        for (const projection of [...applied].reverse()) {
          if (projection.original === null) await store.removeCapability(projection.capability);
          else await store.writeCapability(projection.capability, projection.original);
        }
      };
      try {
        for (const projection of planned.projections) {
          await store.writeCapability(projection.capability, projection.next);
          applied.push(projection);
        }
      } catch (error) {
        try {
          await rollback();
        } catch (rollbackError) {
          throw new EmpiricalError(
            "ARCHIVE_ROLLBACK_FAILED",
            "Capability archive failed and could not fully restore its earlier writes",
            {
              error: error instanceof Error ? error.message : String(error),
              rollbackError: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
            },
          );
        }
        throw error;
      }
      return rollback;
    },
  };
}

export async function listCapabilities(store: ProjectStore): Promise<CapabilitySummary[]> {
  const summaries: CapabilitySummary[] = [];
  for (const name of await store.listCapabilityNames()) {
    const path = store.capabilitySpecPath(name);
    if (!(await isFile(path))) continue;
    const contents = await readFile(path, "utf8");
    summaries.push({
      name,
      path: portableRelative(store.root, path),
      requirements: requirementBlocks(contents).length,
    });
  }
  return summaries;
}

function portableRelative(from: string, to: string): string {
  return relative(from, to).replaceAll("\\", "/");
}

async function buildProjections(
  store: ProjectStore,
  deltas: CapabilityDelta[],
): Promise<{ projections: CapabilityProjection[]; issues: string[] }> {
  const grouped = new Map<string, CapabilityDelta[]>();
  for (const delta of deltas) {
    const group = grouped.get(delta.capability) ?? [];
    group.push(delta);
    grouped.set(delta.capability, group);
  }
  const projections: CapabilityProjection[] = [];
  const issues: string[] = [];
  for (const [capability, capabilityDeltas] of [...grouped].sort(([left], [right]) => left.localeCompare(right))) {
    const original = await store.readCapability(capability);
    const current = new Map(requirementBlocks(original ?? "").map((block) => [normalizedName(block.name), block]));
    const touched = new Set<string>();
    let purpose = original ? sectionContents(original, "Purpose") : null;
    for (const delta of capabilityDeltas) {
      if (!purpose && delta.purpose) purpose = delta.purpose;
      for (const requirement of delta.requirements) {
        const key = normalizedName(requirement.name);
        if (touched.has(key)) {
          issues.push(`${delta.source}: requirement '${requirement.name}' is changed more than once`);
          continue;
        }
        touched.add(key);
        const existing = current.get(key);
        if (requirement.operation === "added") {
          if (existing) issues.push(`${delta.source}: cannot add existing requirement '${requirement.name}'`);
          else current.set(key, { name: requirement.name, contents: requirement.contents });
        } else if (requirement.operation === "modified") {
          if (!existing) issues.push(`${delta.source}: cannot modify missing requirement '${requirement.name}'`);
          else current.set(key, { name: requirement.name, contents: requirement.contents });
        } else if (!existing) {
          issues.push(`${delta.source}: cannot remove missing requirement '${requirement.name}'`);
        } else {
          current.delete(key);
        }
      }
    }
    if (!original && (!purpose || purpose.trim().length < 20)) {
      issues.push(`${capability}: new capability needs a meaningful ## Purpose`);
    }
    projections.push({
      capability,
      original,
      next: renderCapability(capability, purpose, [...current.values()].map((block) => block.contents)),
    });
  }
  return { projections, issues };
}

function requirementBlocks(markdown: string): Array<{ name: string; contents: string }> {
  const pattern = /^###\s+Requirement:\s*(.+?)\s*$/gim;
  const matches = [...markdown.matchAll(pattern)];
  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? nextSecondLevelHeading(markdown, start + match[0].length);
    return { name: match[1]!.trim(), contents: markdown.slice(start, end).trim() };
  });
}

function nextSecondLevelHeading(markdown: string, start: number): number {
  const match = /^##\s+/m.exec(markdown.slice(start));
  return match?.index === undefined ? markdown.length : start + match.index;
}

function sectionContents(markdown: string, title: string): string | null {
  const pattern = new RegExp(`^##\\s+${escapeRegExp(title)}\\s*$`, "im");
  const match = pattern.exec(markdown);
  if (!match) return null;
  const start = (match.index ?? 0) + match[0].length;
  const end = nextSecondLevelHeading(markdown, start);
  return markdown.slice(start, end).trim();
}

function renderCapability(capability: string, purpose: string | null, requirements: string[]): string {
  const title = capability
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
  const body = requirements.length > 0 ? `${requirements.join("\n\n")}\n` : "_No current requirements._\n";
  return `# ${title} Specification\n\n## Purpose\n\n${purpose?.trim() ?? `Current behavior for ${title}.`}\n\n## Requirements\n\n${body}`;
}

function normalizedName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function digestCapabilityDeltas(deltas: CapabilityDelta[]): string {
  return createHash("sha256").update(JSON.stringify(deltas)).digest("hex");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
