import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { EmpiricalProject } from "../src/core.js";
import { refreshRepositoryKnowledge } from "../src/knowledge.js";
import type { ActionPacket, WorktreeProposal } from "../src/types.js";

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

function git(root: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", shell: false });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

async function repository(): Promise<{ root: string; project: EmpiricalProject }> {
  const root = await mkdtemp(join(tmpdir(), "empirical-worktree-"));
  directories.push(root);
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.name", "Empirical Test"]);
  git(root, ["config", "user.email", "empirical@example.test"]);
  await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
  await EmpiricalProject.initialize(root, { integrations: false, setupComplete: true });
  await Promise.all(["overview", "architecture", "commands", "conventions"].map((page) =>
    writeFile(
      join(root, ".empirical", "context", `${page}.md`),
      `# ${page}\n\nVerified worktree fixture context.\n`,
      "utf8",
    )
  ));
  await refreshRepositoryKnowledge(root);
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "base"]);
  git(root, ["checkout", "-b", "feature/current-work"]);
  const project = await EmpiricalProject.open(root);
  const started = await project.fast("Keep the current feature active");
  if (started.kind !== "action") throw new Error("Expected action");
  return { root, project };
}

function proposal(value: Awaited<ReturnType<EmpiricalProject["fast"]>>): WorktreeProposal {
  if (value.kind !== "worktree_proposal") throw new Error("Expected proposal");
  return value;
}

describe("Git worktree isolation", () => {
  test("unrelated work returns a complete read-only proposal", async () => {
    const { root, project } = await repository();
    const before = git(root, ["status", "--porcelain=v1", "--untracked-files=all"]);
    const result = proposal(await project.complex("Fix the invoice retry regression"));
    expect(result).toMatchObject({
      kind: "worktree_proposal",
      workflow: "complex",
      changeType: "fix",
      feature: "fix-the-invoice-retry-regression",
      branch: "fix/fix-the-invoice-retry-regression",
      base: "main",
      activeFeature: "keep-the-current-feature-active",
      requiresApproval: true,
    });
    expect(basename(result.path)).toBe(`${basename(root)}-fix-the-invoice-retry-regression`);
    expect(result.baseCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(result.command).toEqual(["git", "worktree", "add", "-b", result.branch, result.path, result.baseCommit]);
    expect(git(root, ["status", "--porcelain=v1", "--untracked-files=all"])).toBe(before);
    expect(await stat(result.path).then(() => true, () => false)).toBe(false);
    await expect(project.createWorktree({
      request: result.request, workflow: result.workflow, changeType: result.changeType,
      feature: result.feature, branch: "fix/tampered-after-approval", path: result.path,
      base: result.base, baseCommit: result.baseCommit, activeFeature: result.activeFeature,
      approvalToken: result.approvalToken, approved: true,
    })).rejects.toMatchObject({ code: "STALE_WORKTREE_PROPOSAL" });
  });

  test("approved creation blocks a dirty source checkout", async () => {
    const { root, project } = await repository();
    const request = "Add an isolated export command";
    const proposed = proposal(await project.fast(request));
    await expect(project.createWorktree({
      request,
      workflow: "fast",
      changeType: proposed.changeType,
      feature: proposed.feature,
      branch: proposed.branch,
      path: proposed.path,
      base: proposed.base,
      baseCommit: proposed.baseCommit,
      activeFeature: proposed.activeFeature,
      approvalToken: proposed.approvalToken,
      approved: true,
    })).rejects.toMatchObject({ code: "DIRTY_CHECKOUT" });
    expect(git(root, ["branch", "--list", proposed.branch])).toBe("");
    expect(await stat(proposed.path).then(() => true, () => false)).toBe(false);
  });

  test("approved clean creation runs exact -b behavior and starts the request in the new checkout", async () => {
    const { root, project } = await repository();
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "record current feature"]);
    const request = "Add an isolated export command";
    const proposed = proposal(await project.fast(request));
    directories.push(proposed.path);
    const handoff = await project.createWorktree({
      request,
      workflow: "fast",
      changeType: proposed.changeType,
      feature: proposed.feature,
      branch: proposed.branch,
      path: proposed.path,
      base: proposed.base,
      baseCommit: proposed.baseCommit,
      activeFeature: proposed.activeFeature,
      approvalToken: proposed.approvalToken,
      approved: true,
    });
    expect(handoff).toMatchObject({
      kind: "worktree_handoff",
      path: proposed.path,
      branch: proposed.branch,
      base: "main",
      feature: proposed.feature,
      workflow: "fast",
      revision: 1,
      action: { kind: "action", request, phase: "implement" },
    });
    const listedWorktrees = git(root, ["worktree", "list", "--porcelain"]).replaceAll("\\", "/");
    expect(listedWorktrees).toContain(`worktree ${proposed.path.replaceAll("\\", "/")}`);
    expect(git(proposed.path, ["branch", "--show-current"])).toBe(proposed.branch);
    expect(JSON.parse(await readFile(join(proposed.path, ".empirical/specs", proposed.feature, "state.json"), "utf8")))
      .toMatchObject({ activeFeature: proposed.feature, request, revision: 1 });
    expect(await project.status()).toMatchObject({ activeFeature: "keep-the-current-feature-active", revision: 1 });
  });

  test("a linked worktree does not inherit a committed blocked feature owned by its source checkout", async () => {
    const root = await mkdtemp(join(tmpdir(), "empirical-worktree-blocked-base-"));
    directories.push(root);
    git(root, ["init", "-b", "main"]);
    git(root, ["config", "user.name", "Empirical Test"]);
    git(root, ["config", "user.email", "empirical@example.test"]);
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    const { project } = await EmpiricalProject.initialize(root, { integrations: false, setupComplete: true });
    const existing = await project.complex("Keep a historical feature blocked");
    if (existing.kind !== "action") throw new Error("Expected action");
    await project.complete({ revision: 1, outcome: "blocked", summary: "Awaiting an external decision" });
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "commit blocked feature on base"]);

    const request = "Start clean work in a linked checkout";
    const proposed = proposal(await project.fast(request));
    directories.push(proposed.path);
    const handoff = await project.createWorktree({
      request,
      workflow: proposed.workflow,
      changeType: proposed.changeType,
      feature: proposed.feature,
      branch: proposed.branch,
      path: proposed.path,
      base: proposed.base,
      baseCommit: proposed.baseCommit,
      activeFeature: proposed.activeFeature,
      approvalToken: proposed.approvalToken,
      approved: true,
    });

    expect(handoff).toMatchObject({
      feature: "start-clean-work-in-a-linked-checkout",
      revision: 1,
      action: { phase: "implement", status: "waiting" },
    });
    expect(await EmpiricalProject.open(proposed.path).then((linked) => linked.status()))
      .toMatchObject({ activeFeature: "start-clean-work-in-a-linked-checkout", phase: "implement" });
    expect(await project.status())
      .toMatchObject({ activeFeature: "keep-a-historical-feature-blocked", status: "blocked" });
  });

  test("branch and path collisions are rejected without force or workflow mutation", async () => {
    const { root, project } = await repository();
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "record current feature"]);
    const request = "Create a collision check";
    const proposed = proposal(await project.fast(request));
    git(root, ["branch", proposed.branch, "main"]);
    await expect(project.createWorktree({
      request, workflow: "fast", changeType: proposed.changeType, feature: proposed.feature,
      branch: proposed.branch, path: proposed.path, base: proposed.base,
      baseCommit: proposed.baseCommit, activeFeature: proposed.activeFeature,
      approvalToken: proposed.approvalToken, approved: true,
    })).rejects.toMatchObject({ code: "WORKTREE_BRANCH_EXISTS" });
    expect(await project.status()).toMatchObject({ activeFeature: "keep-the-current-feature-active", revision: 1 });

    const second = proposal(await project.fast("Create a path collision check"));
    await mkdir(second.path);
    directories.push(second.path);
    await expect(project.createWorktree({
      request: second.request, workflow: second.workflow, changeType: second.changeType,
      feature: second.feature, branch: second.branch, path: second.path, base: second.base,
      baseCommit: second.baseCommit, activeFeature: second.activeFeature,
      approvalToken: second.approvalToken, approved: true,
    })).rejects.toMatchObject({ code: "WORKTREE_PATH_EXISTS" });
  });

  test("editable type, base, branch, and path survive proposal and approval", async () => {
    const { root, project } = await repository();
    const target = join(dirname(root), `${basename(root)}-custom-target`);
    directories.push(target);
    const custom = await project.proposeWorktree("Update release notes", "complex", {
      changeType: "chore",
      feature: "release-notes",
      branch: "chore/custom-release-notes",
      path: target,
      base: "main",
    });
    expect(custom).toMatchObject({ changeType: "chore", feature: "release-notes", branch: "chore/custom-release-notes", path: target, base: "main" });
  });

  test("approval becomes stale when the base or active feature changes", async () => {
    const { root, project } = await repository();
    await project.configurePolicy({
      schemaVersion: 2,
      context: [],
      phases: {},
      verification: {
        evidence: { required: true, browserForUi: true, screenshotForUi: true, codeReview: true },
        commands: [{
          id: "verify",
          argv: [process.execPath, "-e", "process.exit(0)"],
          cwd: ".",
          timeoutMs: 30_000,
          maxOutputBytes: 65_536,
          evidenceKinds: ["test", "review"],
          criteria: [],
        }],
      },
      delivery: null,
      preferredAgent: null,
    });
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "record current feature"]);
    const oldBase = proposal(await project.fast("Add stale-base coverage"));
    git(root, ["branch", "-f", "main", "HEAD"]);
    await expect(project.createWorktree({
      request: oldBase.request, workflow: oldBase.workflow, changeType: oldBase.changeType,
      feature: oldBase.feature, branch: oldBase.branch, path: oldBase.path, base: oldBase.base,
      baseCommit: oldBase.baseCommit, activeFeature: oldBase.activeFeature,
      approvalToken: oldBase.approvalToken, approved: true,
    })).rejects.toMatchObject({ code: "STALE_WORKTREE_PROPOSAL" });

    const oldFeature = proposal(await project.fast("Add stale-active coverage", { id: "stale-active" }));
    const receipt = await project.executeEvidence({
      commandId: "verify",
      criteria: ["AC-1"],
      evidenceKinds: ["test", "review"],
      summary: "Focused fixture verification and review passed",
    });
    await project.complete({
      revision: 1, outcome: "passed", summary: "Finish current",
      receiptIds: [receipt.id],
    });
    await project.fast("Start a different active feature");
    await expect(project.createWorktree({
      request: oldFeature.request, workflow: oldFeature.workflow, changeType: oldFeature.changeType,
      feature: oldFeature.feature, branch: oldFeature.branch, path: oldFeature.path, base: oldFeature.base,
      baseCommit: oldFeature.baseCommit, activeFeature: oldFeature.activeFeature,
      approvalToken: oldFeature.approvalToken, approved: true,
    })).rejects.toMatchObject({ code: "STALE_WORKTREE_PROPOSAL" });
  });

  test("isolation can be explicitly disabled", async () => {
    const { project } = await repository();
    await project.configure({ isolation: { mode: "off" } });
    await expect(project.fast("Start unrelated work"))
      .rejects.toMatchObject({ code: "FEATURE_ACTIVE" });
  });
});
