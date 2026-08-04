import { lstat, open, readFile, realpath, stat } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, relative, resolve } from "node:path";

import {
  collectedReceiptSchema,
  digestJson,
  evidenceReceiptSchema,
  executedReceiptSchema,
  RECEIPT_SCHEMA_VERSION,
  sha256,
  validateCriteria,
  verifyReceiptDigest,
  type CollectedReceipt,
  type Criterion,
  type EvidenceReceipt,
  type ExecutedReceipt,
} from "./protocol.js";
import type { RuntimeResult } from "./runtime.js";
import { isMigrationScratchPath } from "./migration-scratch.js";

export interface ReceiptProvenanceInput {
  repositoryId: string;
  feature: string;
  specRevision: number;
  specDigest: string;
  treeDigest: string;
  policyDigest: string;
}

function normalizeCriteria(ids: readonly string[]): string[] {
  const normalized = [...new Set(ids)].sort();
  if (normalized.length === 0) {
    throw new Error("Evidence receipt must reference at least one criterion.");
  }
  return normalized;
}

function receiptId(kind: string, body: unknown): string {
  return `${kind}-${digestJson(body).slice("sha256:".length, "sha256:".length + 24)}`;
}

export function createExecutedReceipt(input: {
  criteria: string[];
  evidenceKinds?: Array<"test" | "browser" | "screenshot" | "review" | "human">;
  summary: string;
  provenance: ReceiptProvenanceInput;
  result: RuntimeResult;
}): ExecutedReceipt {
  const criteria = normalizeCriteria(input.criteria);
  const evidenceKinds = [...new Set(input.evidenceKinds ?? ["test"])].sort();
  const passed =
    input.result.exitCode === 0 &&
    input.result.signal === null &&
    !input.result.timedOut;
  const command = {
    argv: [...input.result.argv],
    cwd: input.result.cwd,
    timeoutMs: input.result.timeoutMs,
    maxOutputBytes: input.result.maxOutputBytes,
    environmentKeys: [...input.result.environmentKeys],
  };
  const result = {
    exitCode: input.result.exitCode,
    signal: input.result.signal,
    timedOut: input.result.timedOut,
    stdoutDigest: input.result.stdoutDigest,
    stderrDigest: input.result.stderrDigest,
    stdoutTail: input.result.stdoutTail,
    stderrTail: input.result.stderrTail,
    stdoutTruncated: input.result.stdoutTruncated,
    stderrTruncated: input.result.stderrTruncated,
  };
  const seed = {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    kind: "executed" as const,
    criteria,
    evidenceKinds,
    summary: input.summary.trim(),
    passed,
    startedAt: input.result.startedAt,
    completedAt: input.result.completedAt,
    provenance: input.provenance,
    command,
    result,
  };
  const id = receiptId("executed", seed);
  const body = { ...seed, id };
  return executedReceiptSchema.parse({ ...body, digest: digestJson(body) });
}

function ensureContained(root: string, artifact: string): string {
  const absolute = resolve(root, artifact);
  const rel = relative(resolve(root), absolute);
  if (rel === ".." || rel.startsWith("../") || rel.startsWith("..\\")) {
    throw new Error(`Evidence artifact escapes the repository: ${artifact}`);
  }
  return absolute;
}

async function resolveContainedRegularFile(root: string, artifact: string): Promise<string> {
  const absolute = ensureContained(root, artifact);
  const metadata = await lstat(absolute);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`Evidence artifact is not a regular non-symbolic file: ${artifact}`);
  }
  const [resolvedRoot, resolvedArtifact] = await Promise.all([
    realpath(resolve(root)),
    realpath(absolute),
  ]);
  const rel = relative(resolvedRoot, resolvedArtifact);
  if (rel === ".." || rel.startsWith("../") || rel.startsWith("..\\")) {
    throw new Error(`Evidence artifact resolves outside the repository: ${artifact}`);
  }
  return resolvedArtifact;
}

export async function createCollectedReceipt(input: {
  root: string;
  criteria: string[];
  evidenceKinds?: Array<"test" | "browser" | "screenshot" | "review" | "human">;
  summary: string;
  collector: string;
  provenance: ReceiptProvenanceInput;
  artifacts: Array<{ path: string; mediaType: string }>;
  now?: () => Date;
}): Promise<CollectedReceipt> {
  if (input.artifacts.length === 0) {
    throw new Error("Collected evidence requires at least one artifact.");
  }
  const canonicalRoot = await realpath(resolve(input.root));
  const artifacts = [];
  for (const item of input.artifacts) {
    const absolute = await resolveContainedRegularFile(input.root, item.path);
    const [bytes, metadata] = await Promise.all([readFile(absolute), stat(absolute)]);
    if (!metadata.isFile()) {
      throw new Error(`Evidence artifact is not a regular file: ${item.path}`);
    }
    artifacts.push({
      path: relative(canonicalRoot, absolute).replaceAll("\\", "/"),
      mediaType: item.mediaType,
      bytes: bytes.byteLength,
      digest: sha256(bytes),
    });
  }
  artifacts.sort((left, right) => left.path.localeCompare(right.path));
  const timestamp = (input.now ?? (() => new Date()))().toISOString();
  const seed = {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    kind: "collected" as const,
    criteria: normalizeCriteria(input.criteria),
    evidenceKinds: [...new Set(input.evidenceKinds ?? ["screenshot"])].sort(),
    summary: input.summary.trim(),
    passed: true,
    startedAt: timestamp,
    completedAt: timestamp,
    provenance: input.provenance,
    collector: input.collector.trim(),
    artifacts,
  };
  const id = receiptId("collected", seed);
  const body = { ...seed, id };
  return collectedReceiptSchema.parse({ ...body, digest: digestJson(body) });
}

export async function appendReceipt(path: string, receipt: EvidenceReceipt): Promise<void> {
  verifyReceiptDigest(receipt);
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory(dirname(path));
}

async function syncDirectory(path: string): Promise<void> {
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(path, "r");
  } catch (error) {
    if (
      process.platform === "win32"
      && ["EISDIR", "EPERM", "EACCES"].includes(String((error as NodeJS.ErrnoException).code))
    ) return;
    throw error;
  }
  try {
    await handle.sync().catch((error: NodeJS.ErrnoException) => {
      if (
        process.platform === "win32"
        && ["EINVAL", "ENOTSUP", "EBADF", "EPERM"].includes(String(error.code))
      ) return;
      throw error;
    });
  } finally {
    await handle.close();
  }
}

export interface ReceiptValidationContext {
  root: string;
  repositoryId: string;
  feature: string;
  criteria: Criterion[];
  specRevision: number;
  specDigest: string;
  treeDigest: string;
  policyDigest: string;
}

export async function validateReceipt(
  input: unknown,
  context: ReceiptValidationContext,
): Promise<EvidenceReceipt> {
  const receipt = evidenceReceiptSchema.parse(input);
  verifyReceiptDigest(receipt);
  validateCriteria(context.criteria);
  if (receipt.provenance.repositoryId !== context.repositoryId) {
    throw new Error(`Evidence receipt ${receipt.id} belongs to another repository.`);
  }
  if (receipt.provenance.feature !== context.feature) {
    throw new Error(`Evidence receipt ${receipt.id} belongs to another feature.`);
  }
  const known = new Set(context.criteria.map((criterion) => criterion.id));
  for (const criterionId of receipt.criteria) {
    if (!known.has(criterionId)) {
      throw new Error(`Evidence receipt ${receipt.id} references unknown criterion ${criterionId}.`);
    }
  }
  if (receipt.provenance.specRevision !== context.specRevision) {
    throw new Error(`Evidence receipt ${receipt.id} has a stale specification revision.`);
  }
  for (const [label, actual, expected] of [
    ["specification", receipt.provenance.specDigest, context.specDigest],
    ["tree", receipt.provenance.treeDigest, context.treeDigest],
    ["policy", receipt.provenance.policyDigest, context.policyDigest],
  ] as const) {
    if (actual !== expected) {
      throw new Error(`Evidence receipt ${receipt.id} has a stale ${label} digest.`);
    }
  }
  if (receipt.kind === "collected") {
    for (const artifact of receipt.artifacts) {
      const absolute = await resolveContainedRegularFile(context.root, artifact.path);
      const bytes = await readFile(absolute);
      if (bytes.byteLength !== artifact.bytes || sha256(bytes) !== artifact.digest) {
        throw new Error(`Evidence receipt ${receipt.id} artifact was modified: ${artifact.path}`);
      }
    }
  }
  return receipt;
}

export async function readAndValidateReceipt(
  path: string,
  context: ReceiptValidationContext,
): Promise<EvidenceReceipt> {
  const raw = await readFile(path, "utf8");
  return validateReceipt(JSON.parse(raw) as unknown, context);
}

export function receiptDirectoryForFeature(featureDir: string): string {
  return resolve(featureDir, "evidence", "receipts");
}

export function receiptPath(featureDir: string, receipt: EvidenceReceipt): string {
  return resolve(receiptDirectoryForFeature(featureDir), `${receipt.id}.json`);
}

export function receiptParent(path: string): string {
  return dirname(path);
}

const TREE_EXCLUDED = new Set([
  ".git",
  ".empirical",
  "node_modules",
  "dist",
  "coverage",
  "build",
  "target",
]);

async function walkTree(root: string, directory = root): Promise<string[]> {
  const files: string[] = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = resolve(directory, entry.name);
    const path = relative(root, absolute).replaceAll("\\", "/");
    if (TREE_EXCLUDED.has(entry.name) || isMigrationScratchPath(path) || entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...(await walkTree(root, absolute)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

export async function repositoryTreeDigest(rootInput: string): Promise<string> {
  const root = resolve(rootInput);
  const git = spawnSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "utf8",
    shell: false,
    maxBuffer: 16 * 1024 * 1024,
  });
  const candidates = git.status === 0 && !git.error
    ? git.stdout.split("\0").filter(Boolean)
    : await walkTree(root);
  const inventory = [];
  for (const path of [...new Set(candidates)].sort()) {
    const normalized = path.replaceAll("\\", "/");
    if (
      normalized.split("/").some((segment) => TREE_EXCLUDED.has(segment)) ||
      isMigrationScratchPath(normalized) ||
      normalized.startsWith("../")
    ) {
      continue;
    }
    const lexical = ensureContained(root, normalized);
    const linkMetadata = await lstat(lexical).catch(() => null);
    if (!linkMetadata?.isFile() || linkMetadata.isSymbolicLink()) continue;
    const absolute = await resolveContainedRegularFile(root, normalized);
    const bytes = await readFile(absolute);
    inventory.push({ path: normalized, bytes: bytes.byteLength, digest: sha256(bytes) });
  }
  return digestJson(inventory);
}
