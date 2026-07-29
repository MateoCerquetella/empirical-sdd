import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { EmpiricalError } from "./errors.js";
import { SCHEMA_VERSION, type ChangeType, type IsolationConfig, type Workflow, type WorktreeProposal } from "./types.js";

export interface WorktreeOverrides {
  changeType?: ChangeType;
  feature?: string;
  branch?: string;
  path?: string;
  base?: string;
}

export function inferChangeType(request: string): ChangeType {
  if (/\b(fix|bug|broken|regression|repair|crash|error|incorrect)\b/i.test(request)) return "fix";
  if (/\b(chore|docs?|test|release|upgrade|update|maintenance|refactor|cleanup|migrate)\b/i.test(request)) return "chore";
  return "feature";
}

export function featureSlug(request: string): string {
  const slug = request
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .slice(0, 10)
    .join("-")
    .slice(0, 72)
    .replace(/-$/, "");
  return slug || "feature";
}

export function proposeWorktree(
  root: string,
  request: string,
  workflow: Workflow,
  activeFeature: string,
  config: IsolationConfig,
  overrides: WorktreeOverrides = {},
): WorktreeProposal {
  const cleanRequest = request.trim();
  if (!cleanRequest) throw new EmpiricalError("REQUEST_REQUIRED", "A non-empty feature request is required");
  const repoRoot = git(root, ["rev-parse", "--show-toplevel"]);
  const feature = overrides.feature ?? featureSlug(cleanRequest);
  assertFeature(feature);
  const changeType = overrides.changeType ?? inferChangeType(cleanRequest);
  const base = overrides.base ?? (config.baseBranch === "auto" ? detectBase(repoRoot) : config.baseBranch);
  const baseCommit = resolveBase(repoRoot, base);
  const repo = basename(repoRoot);
  const branch = overrides.branch ?? renderTemplate(config.branchPattern, { repo, feature, type: changeType });
  assertBranch(repoRoot, branch);
  const pathValue = overrides.path ?? renderTemplate(config.worktreePath, { repo, feature, type: changeType });
  const path = resolve(isAbsolute(pathValue) ? pathValue : resolve(repoRoot, pathValue));
  assertSafeTarget(repoRoot, path);
  const approvedFields = {
    root: repoRoot,
    request: cleanRequest,
    workflow,
    changeType,
    feature,
    branch,
    path,
    base,
    baseCommit,
    activeFeature,
  };
  return {
    kind: "worktree_proposal",
    protocol: "empirical-sdd",
    schemaVersion: SCHEMA_VERSION,
    ...approvedFields,
    approvalToken: createHash("sha256").update(JSON.stringify(approvedFields)).digest("hex"),
    command: ["git", "worktree", "add", "-b", branch, path, baseCommit],
    requiresApproval: true,
  };
}

export async function createGitWorktree(proposal: WorktreeProposal): Promise<void> {
  const repoRoot = git(proposal.root, ["rev-parse", "--show-toplevel"]);
  if (resolve(repoRoot) !== resolve(proposal.root)) {
    throw new EmpiricalError("STALE_WORKTREE_PROPOSAL", "The proposal repository root changed");
  }
  const status = git(repoRoot, ["status", "--porcelain=v1", "--untracked-files=all"], true);
  if (status.trim()) {
    throw new EmpiricalError(
      "DIRTY_CHECKOUT",
      "Commit, stash, or remove current changes before Empirical creates a worktree",
    );
  }
  assertFeature(proposal.feature);
  const currentBaseCommit = resolveBase(repoRoot, proposal.base);
  if (currentBaseCommit !== proposal.baseCommit) {
    throw new EmpiricalError(
      "STALE_WORKTREE_PROPOSAL",
      `Base ${proposal.base} moved from ${proposal.baseCommit} to ${currentBaseCommit}; review a new proposal`,
    );
  }
  assertBranch(repoRoot, proposal.branch);
  assertSafeTarget(repoRoot, proposal.path);
  if (await pathExists(proposal.path)) {
    throw new EmpiricalError("WORKTREE_PATH_EXISTS", `Worktree path already exists: ${proposal.path}`);
  }
  const worktrees = parseWorktreePaths(git(repoRoot, ["worktree", "list", "--porcelain"]));
  if (worktrees.some((path) => resolve(path) === resolve(proposal.path))) {
    throw new EmpiricalError("WORKTREE_PATH_EXISTS", `Worktree path is already registered: ${proposal.path}`);
  }
  const existingBranch = runGit(repoRoot, ["show-ref", "--verify", "--quiet", `refs/heads/${proposal.branch}`]);
  if (existingBranch.status === 0) {
    throw new EmpiricalError("WORKTREE_BRANCH_EXISTS", `Branch already exists: ${proposal.branch}`);
  }
  const result = runGit(repoRoot, ["worktree", "add", "-b", proposal.branch, proposal.path, proposal.baseCommit]);
  if (result.status !== 0 || result.error) {
    throw new EmpiricalError(
      "WORKTREE_CREATE_FAILED",
      result.error?.message || result.stderr.trim() || `git exited with ${String(result.status)}`,
    );
  }
}

export function detectBase(root: string): string {
  const originHead = runGit(root, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  if (originHead.status === 0 && originHead.stdout.trim()) return originHead.stdout.trim();
  for (const candidate of ["main", "master"] as const) {
    if (runGit(root, ["rev-parse", "--verify", "--quiet", candidate]).status === 0) return candidate;
    const remote = `origin/${candidate}`;
    if (runGit(root, ["rev-parse", "--verify", "--quiet", remote]).status === 0) return remote;
  }
  throw new EmpiricalError(
    "BASE_BRANCH_REQUIRED",
    "Empirical could not detect origin/HEAD, main, or master; provide --base <ref>",
  );
}

function resolveBase(root: string, base: string): string {
  if (!base.trim() || /[\0\r\n]/.test(base)) throw new EmpiricalError("INVALID_BASE", "Git base ref is invalid");
  const result = runGit(root, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`]);
  if (result.status !== 0 || !result.stdout.trim()) {
    throw new EmpiricalError("BASE_NOT_FOUND", `Git base does not resolve to a commit: ${base}`);
  }
  return result.stdout.trim();
}

function assertBranch(root: string, branch: string): void {
  if (!branch.trim() || runGit(root, ["check-ref-format", "--branch", branch]).status !== 0) {
    throw new EmpiricalError("INVALID_BRANCH", `Invalid Git branch: ${branch}`);
  }
  if (!/^(feature|fix|chore)\//.test(branch)) {
    throw new EmpiricalError("INVALID_BRANCH", "Worktree branches must begin with feature/, fix/, or chore/");
  }
}

function assertFeature(feature: string): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(feature) || feature.length > 80) {
    throw new EmpiricalError("INVALID_FEATURE", `Invalid feature id: ${feature}`);
  }
}

function assertSafeTarget(repoRoot: string, target: string): void {
  const root = resolve(repoRoot);
  const path = resolve(target);
  if (path === root || root.startsWith(`${path}${sep}`)) {
    throw new EmpiricalError("INVALID_WORKTREE_PATH", "Worktree path cannot be the repository or its ancestor");
  }
  if (path.startsWith(`${root}${sep}`)) {
    throw new EmpiricalError("INVALID_WORKTREE_PATH", "Worktree path must be outside the current checkout");
  }
  if (!relative(dirname(root), path)) {
    throw new EmpiricalError("INVALID_WORKTREE_PATH", "Worktree path must identify a new checkout");
  }
}

function renderTemplate(template: string, values: { repo: string; feature: string; type: ChangeType }): string {
  const rendered = template
    .replaceAll("{repo}", values.repo)
    .replaceAll("{feature}", values.feature)
    .replaceAll("{type}", values.type);
  if (/[{}\0\r\n]/.test(rendered)) {
    throw new EmpiricalError("INVALID_CONFIG", `Template did not resolve safely: ${template}`);
  }
  return rendered;
}

function git(root: string, args: string[], allowEmpty = false): string {
  const result = runGit(root, args);
  if (result.status !== 0 || result.error) {
    throw new EmpiricalError("GIT_REQUIRED", result.error?.message || result.stderr.trim() || `git ${args[0]} failed`);
  }
  const output = result.stdout.trim();
  if (!allowEmpty && !output) throw new EmpiricalError("GIT_REQUIRED", `git ${args.join(" ")} returned no value`);
  return output;
}

function runGit(root: string, args: string[]) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8", shell: false });
}

function parseWorktreePaths(output: string): string[] {
  return output.split(/\r?\n/).filter((line) => line.startsWith("worktree ")).map((line) => line.slice(9));
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
