import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { EmpiricalError } from "./errors.js";

interface CheckoutMetadata {
  gitDirectory: string;
  commonDirectory: string;
  selectionPath: string;
  linked: boolean;
}

const metadataCache = new Map<string, CheckoutMetadata>();

export interface CheckoutSelection {
  feature: string | null;
  linked: boolean;
  selectionPath: string | null;
  claimedElsewhere: Set<string>;
}

export async function readCheckoutSelection(rootInput: string): Promise<CheckoutSelection> {
  const root = resolve(rootInput);
  const metadata = gitMetadata(root);
  if (!metadata) return { feature: null, linked: false, selectionPath: null, claimedElsewhere: new Set() };
  await assertGitMetadataPathSafe(metadata);
  const feature = await readSelectionFile(metadata.selectionPath);
  const claimedElsewhere = new Set<string>();
  for (const worktree of worktreePaths(root)) {
    const other = gitMetadata(worktree);
    if (!other) continue;
    if (other.selectionPath === metadata.selectionPath) continue;
    const claim = await readSelectionFile(other.selectionPath).catch(() => null);
    if (claim) claimedElsewhere.add(claim);
  }
  return {
    feature,
    linked: metadata.linked,
    selectionPath: metadata.selectionPath,
    claimedElsewhere,
  };
}

export async function writeCheckoutSelection(rootInput: string, feature: string | null): Promise<void> {
  const root = resolve(rootInput);
  const metadata = gitMetadata(root);
  if (!metadata) return;
  await assertGitMetadataPathSafe(metadata);
  if (feature !== null && !isFeatureId(feature)) {
    throw new EmpiricalError("INVALID_FEATURE", `Invalid checkout feature '${feature}'`);
  }
  if (feature === null) {
    await rm(metadata.selectionPath, { force: true });
    return;
  }
  await writeTextAtomic(metadata.selectionPath, `${feature}\n`);
}

function gitMetadata(root: string): CheckoutMetadata | null {
  const cached = metadataCache.get(root);
  if (cached) return cached;
  const directories = gitPaths(root, ["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"]);
  if (directories.length !== 2) return null;
  const git = resolveMaybe(root, directories[0]!);
  const common = resolveMaybe(root, directories[1]!);
  const selection = join(git, "empirical-sdd", "active-feature");
  const label = relative(git, selection);
  if (!label || label === ".." || label.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(label)) {
    throw new EmpiricalError("UNSAFE_CHECKOUT_METADATA", `Checkout selection escapes Git metadata: ${selection}`);
  }
  const metadata = { gitDirectory: git, commonDirectory: common, selectionPath: selection, linked: git !== common };
  metadataCache.set(root, metadata);
  return metadata;
}

function gitPaths(root: string, args: string[]): string[] {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", shell: false });
  if (result.status !== 0 || result.error) return [];
  return result.stdout.trim().split(/\r?\n/).filter(Boolean);
}

function worktreePaths(root: string): string[] {
  const result = spawnSync("git", ["worktree", "list", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0 || result.error) return [];
  return result.stdout.split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length));
}

async function readSelectionFile(path: string): Promise<string | null> {
  const details = await lstat(path).catch(() => null);
  if (!details) return null;
  if (details.isSymbolicLink() || !details.isFile()) {
    throw new EmpiricalError("UNSAFE_CHECKOUT_METADATA", `Checkout selection is not a regular file: ${path}`);
  }
  const feature = (await readFile(path, "utf8")).trim();
  if (!isFeatureId(feature)) {
    throw new EmpiricalError("INVALID_FEATURE", `Checkout selection contains invalid feature '${feature}'`);
  }
  return feature;
}

async function assertGitMetadataPathSafe(metadata: CheckoutMetadata): Promise<void> {
  const label = relative(metadata.gitDirectory, metadata.selectionPath);
  let current = metadata.gitDirectory;
  for (const segment of label.split(/[\\/]/)) {
    current = join(current, segment);
    const details = await lstat(current).catch(() => null);
    if (!details) break;
    if (details.isSymbolicLink()) {
      throw new EmpiricalError("UNSAFE_CHECKOUT_METADATA", `Checkout metadata cannot use symbolic links: ${current}`);
    }
  }
}

async function writeTextAtomic(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, contents, "utf8");
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function resolveMaybe(root: string, path: string): string {
  return isAbsolute(path) ? resolve(path) : resolve(root, path);
}

function isFeatureId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
