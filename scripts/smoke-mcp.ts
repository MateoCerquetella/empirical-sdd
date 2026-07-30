import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = await mkdtemp(join(tmpdir(), "empirical-dist-smoke-"));
const complexRoot = await mkdtemp(join(tmpdir(), "empirical-dist-complex-"));
const gitRoot = await mkdtemp(join(tmpdir(), "empirical-dist-git-"));
const skillHome = await mkdtemp(join(tmpdir(), "empirical-dist-skills-"));
const createdWorktrees: string[] = [];
const cli = resolve(import.meta.dir, "../dist/cli.js");
const transport = new StdioClientTransport({
  command: process.execPath === Bun.which("bun") ? "node" : process.execPath,
  args: [cli, "mcp", "--root", root],
  cwd: root,
  stderr: "pipe",
});
const client = new Client({ name: "empirical-dist-smoke", version: "1.0.0" });

async function runCli(directory: string, args: string[], env?: Record<string, string>) {
  const publicCommand = ["help", "--help", "-h", "--version", "-v", "install", "update"].includes(args[0] ?? "");
  const child = Bun.spawn(["node", cli, ...(publicCommand ? args : ["__internal", ...args]), "--root", directory], {
    stdout: "pipe",
    stderr: "pipe",
    ...(env ? { env: { ...process.env, ...env } } : {}),
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  return { code, stdout, stderr };
}

function git(directory: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd: directory, encoding: "utf8", shell: false });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

try {
  await client.connect(transport);
  const listed = (await client.listTools()).tools.map((tool) => tool.name);
  for (const name of [
    "empirical_explore", "empirical_discovery", "empirical_fast", "empirical_complex", "empirical_loop",
    "empirical_archive", "empirical_explain", "empirical_worktree_propose",
    "empirical_worktree_create", "empirical_configure", "empirical_capabilities",
    "empirical_context", "empirical_handoff",
  ]) {
    if (!listed.includes(name)) throw new Error(`Bundled MCP omitted ${name}`);
  }
  if (listed.some((name) => name.includes("workstreams"))) throw new Error("Bundled MCP retained the removed parallel-state tool");

  const initialized = await client.callTool({ name: "empirical_init", arguments: { root } });
  if (initialized.isError) throw new Error("Bundled MCP init failed");
  const configBefore = await readFile(join(root, ".empirical/config.json"), "utf8");
  const explored = await client.callTool({ name: "empirical_explore", arguments: { root, problem: "Make status easier to understand" } });
  if (explored.isError || (explored.structuredContent as { problem?: string })?.problem !== "Make status easier to understand") {
    throw new Error("Bundled Explore failed");
  }
  if (await readFile(join(root, ".empirical/config.json"), "utf8") !== configBefore) throw new Error("Explore mutated configuration");
  const discovery = await client.callTool({
    name: "empirical_discovery",
    arguments: {
      root,
      problem: "Clarify status behavior",
      answers: [{
        pass: "problem",
        title: "Problem and user",
        question: "Who needs clearer status?",
        answer: "Repository developers need to understand the selected workflow state.",
        followUp: null,
      }],
    },
  });
  if (discovery.isError || (discovery.structuredContent as { record?: { status?: string } })?.record?.status !== "draft") {
    throw new Error("Bundled progressive discovery failed");
  }

  let fast = await runCli(root, ["fast", "Add a hello command"]);
  for (const expected of [
    "Empirical · step 1/1", "implement (fast, waiting, revision 1)",
    "Required evidence: test, review", '--test "<test result>" --review "<diff review>"',
  ]) if (!fast.stdout.includes(expected)) throw new Error(`Bundled Fast output omitted ${expected}: ${fast.stderr}`);
  const loop = await client.callTool({ name: "empirical_loop", arguments: { root } });
  if (loop.isError || (loop.structuredContent as { revision?: number })?.revision !== 1) throw new Error("Bundled MCP loop failed");
  fast = await runCli(root, [
    "complete", "--revision", "1", "--outcome", "passed", "--summary", "Implemented",
    "--test", "Focused test passed", "--review", "Diff reviewed",
  ]);
  if (fast.code !== 0 || !fast.stdout.includes("done (fast, done, revision 2)")) throw new Error(`Bundled Fast completion failed: ${fast.stderr}`);

  let complex = await runCli(complexRoot, ["init", "--defaults", "--no-integrations"]);
  if (complex.code !== 0) throw new Error(`Bundled Complex init failed: ${complex.stderr}`);
  complex = await runCli(complexRoot, ["complex", "Replace authentication safely"]);
  if (complex.code !== 0 || !complex.stdout.includes("specify (complex, waiting, revision 1)")) throw new Error(`Bundled Complex start failed: ${complex.stderr}`);
  const feature = "replace-authentication-safely";
  const directory = join(complexRoot, ".empirical/specs", feature);
  await writeFile(join(directory, "spec.md"), "# Authentication\n\n## Acceptance Criteria\n\n- [ ] [AC-1] Existing users can sign in.\n", "utf8");
  await mkdir(join(directory, "deltas"), { recursive: true });
  await writeFile(join(directory, "deltas/authentication.md"), `## Purpose

This capability defines current observable authentication behavior.

## ADDED Requirements

### Requirement: Existing users can sign in

Existing users MUST be able to sign in.

#### Scenario: Valid credentials

- **WHEN** valid credentials are submitted
- **THEN** the user is signed in
`, "utf8");
  complex = await runCli(complexRoot, ["complete", "--revision", "1", "--outcome", "passed", "--summary", "Specified"]);
  if (!complex.stdout.includes("design (complex, waiting, revision 2)")) throw new Error(`Bundled Specify failed: ${complex.stderr}`);
  await writeFile(join(directory, "design.md"), "# Design\n\nUse the current authentication boundary.\n", "utf8");
  await writeFile(join(directory, "decisions.md"), `# Decisions

## D-001: Preserve authentication ownership

Status: Accepted

### Evidence

The current authentication service owns session creation.

### Options

1. Extend it. 2. Add a second session owner.

### Chosen approach

Extend the current authentication service.

### Trade-offs and risks

The service grows; regression tests protect existing sessions.

### Verification

Run existing and new sign-in tests.
`, "utf8");
  complex = await runCli(complexRoot, ["complete", "--revision", "2", "--outcome", "passed", "--summary", "Designed"]);
  await writeFile(join(directory, "plan.md"), "# Plan\n\n1. Implement and verify.\n", "utf8");
  complex = await runCli(complexRoot, ["complete", "--revision", "3", "--outcome", "passed", "--summary", "Planned"]);
  complex = await runCli(complexRoot, ["complete", "--revision", "4", "--outcome", "passed", "--summary", "Implemented", "--actor", "builder"]);
  const verifyPath = join(complexRoot, "verify.json");
  await writeFile(verifyPath, JSON.stringify([{ criterionId: "AC-1", kind: "test", passed: true, summary: "Authentication test passed" }]), "utf8");
  complex = await runCli(complexRoot, ["complete", "--revision", "5", "--outcome", "passed", "--summary", "Verified", "--evidence", verifyPath]);
  const reviewPath = join(complexRoot, "review.json");
  await writeFile(reviewPath, JSON.stringify([{ criterionId: "all", kind: "review", passed: true, summary: "No blocking findings" }]), "utf8");
  complex = await runCli(complexRoot, ["complete", "--revision", "6", "--outcome", "passed", "--summary", "Reviewed", "--evidence", reviewPath]);
  if (!complex.stdout.includes("archive (complex, waiting, revision 7)")) throw new Error(`Bundled Review failed: ${complex.stderr}`);
  const archived = await client.callTool({ name: "empirical_archive", arguments: { root: complexRoot, revision: 7 } });
  const archive = archived.structuredContent as { report?: { added?: number }; action?: { phase?: string } } | undefined;
  if (archived.isError || archive?.report?.added !== 1 || archive.action?.phase !== "done") throw new Error("Bundled Archive failed");
  const explained = await runCli(complexRoot, ["explain", "--json"]);
  if (explained.code !== 0 || JSON.parse(explained.stdout).rationale.gate !== "proceed") throw new Error("Bundled Explain failed");

  git(gitRoot, ["init", "-b", "main"]);
  git(gitRoot, ["config", "user.name", "Empirical Smoke"]);
  git(gitRoot, ["config", "user.email", "empirical@example.test"]);
  await writeFile(join(gitRoot, "README.md"), "# Worktree smoke\n", "utf8");
  let gitCli = await runCli(gitRoot, ["init", "--defaults", "--no-integrations"]);
  if (gitCli.code !== 0) throw new Error(`Git fixture init failed: ${gitCli.stderr}`);
  git(gitRoot, ["add", "."]); git(gitRoot, ["commit", "-m", "base"]); git(gitRoot, ["checkout", "-b", "feature/current"]);
  gitCli = await runCli(gitRoot, ["fast", "Keep current work active"]);
  if (gitCli.code !== 0) throw new Error(`Current feature start failed: ${gitCli.stderr}`);
  git(gitRoot, ["add", "."]); git(gitRoot, ["commit", "-m", "current feature"]);
  const target = join(dirname(gitRoot), `${basename(gitRoot)}-isolated`);
  createdWorktrees.push(target);
  gitCli = await runCli(gitRoot, [
    "worktree", "create", "Add isolated output", "--workflow", "fast", "--type", "feature",
    "--id", "isolated-output", "--branch", "feature/isolated-output", "--path", target, "--base", "main", "--yes",
  ]);
  if (gitCli.code !== 0 || !gitCli.stdout.includes("Worktree created") || git(target, ["branch", "--show-current"]) !== "feature/isolated-output") {
    throw new Error(`Bundled real-worktree handoff failed: ${gitCli.stderr}`);
  }

  const version = await runCli(root, ["--version"]);
  const packageJson = JSON.parse(await readFile(resolve(import.meta.dir, "../package.json"), "utf8")) as { version: string };
  if (version.stdout.trim() !== packageJson.version || packageJson.version !== "0.20.2") {
    throw new Error(`Bundled/package version mismatch: cli=${JSON.stringify(version.stdout.trim())} package=${JSON.stringify(packageJson.version)} stderr=${JSON.stringify(version.stderr)}`);
  }
  const help = await runCli(root, ["help"]);
  if (!help.stdout.includes("empirical install") || !help.stdout.includes("empirical update")) throw new Error("Bundled help omitted lifecycle UX");
  for (const hidden of ["empirical init", "empirical explore", "empirical fast", "empirical complex", "empirical loop"]) {
    if (help.stdout.includes(hidden)) throw new Error(`Bundled help exposed internal operation ${hidden}`);
  }

  const installed = await runCli(root, ["install", "--all", "--json"], {
    HOME: skillHome,
    USERPROFILE: skillHome,
  });
  const integration = JSON.parse(installed.stdout) as { created?: string[]; entrypoints?: Array<{ invocations: string[] }> };
  if (installed.code !== 0 || integration.created?.length !== 25 || integration.entrypoints?.some((entry) => entry.invocations.length !== 5)) {
    throw new Error(`Bundled five-skill install failed: ${installed.stderr}`);
  }
  for (const name of ["empirical", "empirical-init", "empirical-spec", "empirical-socratic", "empirical-loop"]) {
    const skill = await readFile(join(skillHome, ".codex", "skills", name, "SKILL.md"), "utf8");
    if (!skill.includes(`name: ${name}`) || !skill.includes("empirical-sdd:managed-file")) {
      throw new Error(`Bundled install produced an invalid ${name} skill`);
    }
  }

  console.log("Bundled 0.20 five-skill help, discovery, workflow, context, handoff, worktree, CLI, and MCP smoke passed.");
} finally {
  await client.close();
  await Promise.all([...createdWorktrees, root, complexRoot, gitRoot, skillHome].map((path) => rm(path, { recursive: true, force: true })));
}
