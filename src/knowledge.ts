import { createHash } from "node:crypto";
import { lstat, readFile, readdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename, join, relative, resolve } from "node:path";
import { EmpiricalError } from "./errors.js";
import {
  isFile,
  isSymbolicLink,
  readJson,
  writeJsonAtomic,
  writeTextAtomic,
} from "./storage.js";
import type {
  RepositoryKnowledgeFile,
  RepositoryKnowledgeManifest,
  RepositoryKnowledgeReport,
} from "./types.js";

export const KNOWLEDGE_SCHEMA_VERSION = 1 as const;
export const KNOWLEDGE_CONTEXT_PATHS = [
  ".empirical/context/index.md",
  ".empirical/context/overview.md",
  ".empirical/context/architecture.md",
  ".empirical/context/commands.md",
  ".empirical/context/conventions.md",
] as const;

const MAX_FILES = 1_200;
const MAX_FILE_BYTES = 1_000_000;
const MAX_TOTAL_BYTES = 16_000_000;
const EXCLUDED_DIRECTORIES = new Set([
  ".git", ".empirical", ".cache", ".next", ".turbo", ".venv",
  "build", "coverage", "dist", "node_modules", "out", "target", "temp", "tmp", "vendor",
]);
const BINARY_EXTENSIONS = new Set([
  ".7z", ".a", ".avi", ".bin", ".bmp", ".class", ".db", ".dylib", ".eot",
  ".gif", ".gz", ".ico", ".jar", ".jpeg", ".jpg", ".lockb", ".mov", ".mp3",
  ".mp4", ".o", ".otf", ".pdf", ".png", ".so", ".sqlite", ".tar", ".ttf",
  ".wav", ".webm", ".webp", ".woff", ".woff2", ".zip",
]);

export async function refreshRepositoryKnowledge(rootInput: string): Promise<RepositoryKnowledgeReport> {
  const root = resolve(rootInput);
  const contextDirectory = join(root, ".empirical", "context");
  const manifestPath = join(contextDirectory, "manifest.json");
  await assertContextPathsSafe(root, [contextDirectory, manifestPath, ...KNOWLEDGE_CONTEXT_PATHS.map((path) => join(root, path))]);

  const inventory = await repositoryInventory(root);
  const manifest: RepositoryKnowledgeManifest = {
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    digest: digest(inventory.files),
    files: inventory.files,
    truncated: inventory.truncated,
  };
  const previous = await isFile(manifestPath)
    ? await readJson<RepositoryKnowledgeManifest>(manifestPath, "INVALID_CONTEXT")
    : null;
  const context = [...KNOWLEDGE_CONTEXT_PATHS];
  const pagesExist = (await Promise.all(context.map((path) => isFile(join(root, path))))).every(Boolean);
  if (previous?.schemaVersion === KNOWLEDGE_SCHEMA_VERSION && previous.digest === manifest.digest && pagesExist) {
    return report(root, "current", manifest);
  }

  const status: RepositoryKnowledgeReport["status"] = previous ? "refreshed" : "created";
  await writeJsonAtomic(manifestPath, manifest);
  await writeTextAtomic(join(contextDirectory, "index.md"), renderIndex(root, manifest));
  await createTopicPage(join(contextDirectory, "overview.md"), overviewTemplate());
  await createTopicPage(join(contextDirectory, "architecture.md"), architectureTemplate());
  await createTopicPage(join(contextDirectory, "commands.md"), commandsTemplate());
  await createTopicPage(join(contextDirectory, "conventions.md"), conventionsTemplate());
  return report(root, status, manifest);
}

export function repositoryKnowledgePaths(): string[] {
  return [...KNOWLEDGE_CONTEXT_PATHS];
}

async function repositoryInventory(root: string): Promise<{ files: RepositoryKnowledgeFile[]; truncated: boolean }> {
  const candidates = gitCandidates(root) ?? await walkCandidates(root);
  const files: RepositoryKnowledgeFile[] = [];
  let totalBytes = 0;
  let truncated = false;
  for (const path of [...new Set(candidates.map(normalizePath))].sort()) {
    if (!safeKnowledgePath(path)) continue;
    if (files.length >= MAX_FILES) { truncated = true; break; }
    const absolute = join(root, path);
    const details = await lstat(absolute).catch(() => null);
    if (!details?.isFile() || details.isSymbolicLink()) continue;
    if (details.size > MAX_FILE_BYTES || totalBytes + details.size > MAX_TOTAL_BYTES) {
      truncated = true;
      continue;
    }
    const contents = await readFile(absolute).catch(() => null);
    if (!contents) continue;
    totalBytes += details.size;
    files.push({
      path,
      size: details.size,
      digest: createHash("sha256").update(contents).digest("hex"),
    });
  }
  return { files, truncated };
}

function gitCandidates(root: string): string[] | null {
  const result = spawnSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "utf8",
    shell: false,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0 || result.error) return null;
  return result.stdout.split("\0").filter(Boolean);
}

async function walkCandidates(root: string): Promise<string[]> {
  const found: string[] = [];
  const pending = [root];
  while (pending.length && found.length < MAX_FILES * 2) {
    const directory = pending.shift()!;
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = join(directory, entry.name);
      const path = normalizePath(relative(root, absolute));
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) pending.push(absolute);
      } else if (entry.isFile()) found.push(path);
    }
  }
  return found;
}

function safeKnowledgePath(path: string): boolean {
  if (!path || path === ".." || path.startsWith("../") || path.startsWith("/")) return false;
  const segments = path.split("/");
  if (segments.some((segment) => EXCLUDED_DIRECTORIES.has(segment))) return false;
  const name = basename(path).toLowerCase();
  if (
    name === ".npmrc"
    || /^\.env(?:\.|$)/.test(name)
    || /(?:^|[._-])(credential|credentials|private[-_]?key|secret|secrets|token|tokens)(?:[._-]|$)/.test(name)
    || /\.(?:key|p12|pem|pfx)$/.test(name)
  ) return false;
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  return !BINARY_EXTENSIONS.has(extension);
}

async function assertContextPathsSafe(root: string, paths: string[]): Promise<void> {
  for (const path of paths) {
    const resolved = resolve(path);
    const label = normalizePath(relative(root, resolved));
    if (!label || label === ".." || label.startsWith("../")) {
      throw new EmpiricalError("UNSAFE_CONTEXT_PATH", `Repository context escapes the project: ${path}`);
    }
    let current = root;
    for (const segment of label.split("/")) {
      current = join(current, segment);
      if (await isSymbolicLink(current)) {
        throw new EmpiricalError("UNSAFE_CONTEXT_PATH", `Repository context cannot use symbolic links: ${current}`);
      }
      if (!(await stat(current).catch(() => null))) break;
    }
  }
}

async function createTopicPage(path: string, contents: string): Promise<void> {
  if (!(await isFile(path))) await writeTextAtomic(path, contents);
}

function renderIndex(root: string, manifest: RepositoryKnowledgeManifest): string {
  const paths = manifest.files.map((file) => file.path);
  const roots = [...new Set(paths.map((path) => path.includes("/") ? path.split("/")[0]! : "."))].slice(0, 24);
  const manifests = paths.filter((path) => /(^|\/)(?:package\.json|Cargo\.toml|go\.mod|pyproject\.toml|pom\.xml|build\.gradle|Makefile)$/.test(path)).slice(0, 24);
  const docs = paths.filter((path) => /(^|\/)(?:README|CONTRIBUTING|ARCHITECTURE|SECURITY)[^/]*$/i.test(path)).slice(0, 24);
  return `# Repository Knowledge Index

Generated from repository metadata. Topic pages are maintained by the current
agent from inspected evidence; refresh never overwrites them.

- Repository: ${basename(root)}
- Inventory digest: ${manifest.digest}
- Included files: ${manifest.files.length}${manifest.truncated ? " (bounded/truncated)" : ""}
- Roots: ${roots.length ? roots.join(", ") : "none"}
- Manifests: ${manifests.length ? manifests.join(", ") : "none"}
- Primary docs: ${docs.length ? docs.join(", ") : "none"}

## Topics

- [Overview](overview.md)
- [Architecture](architecture.md)
- [Commands](commands.md)
- [Conventions](conventions.md)

The machine-readable inventory is in [manifest.json](manifest.json). This is a
compact file-backed context set, not an embedding or vector database.
`;
}

function overviewTemplate(): string {
  return `# Project Overview

Maintain this page from repository evidence.

## Purpose

- TODO: What the project does and who it serves.

## Boundaries

- TODO: Major scope boundaries and explicit non-goals.

## Evidence

- TODO: Link the manifests, documentation, and entrypoints used.
`;
}

function architectureTemplate(): string {
  return `# Architecture

Maintain this page from repository evidence.

## Components and ownership

- TODO

## Data and control flow

- TODO

## External dependencies

- TODO
`;
}

function commandsTemplate(): string {
  return `# Commands

Maintain only commands verified from manifests, scripts, or CI configuration.

## Setup

- TODO

## Run, test, and build

- TODO

## Verification evidence

- TODO
`;
}

function conventionsTemplate(): string {
  return `# Conventions

Maintain this page from repository instructions and observed code.

## Code and structure

- TODO

## Testing and delivery

- TODO

## Repository-specific constraints

- TODO
`;
}

function report(
  root: string,
  status: RepositoryKnowledgeReport["status"],
  manifest: RepositoryKnowledgeManifest,
): RepositoryKnowledgeReport {
  return {
    root,
    status,
    digest: manifest.digest,
    files: manifest.files.length,
    truncated: manifest.truncated,
    manifest: ".empirical/context/manifest.json",
    context: repositoryKnowledgePaths(),
  };
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}
