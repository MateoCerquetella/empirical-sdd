import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = await mkdtemp(join(tmpdir(), "empirical-dist-smoke-"));
const complexRoot = await mkdtemp(join(tmpdir(), "empirical-dist-complex-smoke-"));
const transport = new StdioClientTransport({
  command: process.execPath === Bun.which("bun") ? "node" : process.execPath,
  args: [resolve(import.meta.dir, "../dist/cli.js"), "mcp", "--root", root],
  cwd: root,
  stderr: "pipe",
});
const client = new Client({ name: "empirical-dist-smoke", version: "1.0.0" });
const cli = resolve(import.meta.dir, "../dist/cli.js");

async function runCli(rootDirectory: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const process = Bun.spawn(
    ["node", cli, ...args, "--root", rootDirectory],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  return { code, stdout, stderr };
}

try {
  await client.connect(transport);
  const tools = await client.listTools();
  for (const name of [
    "empirical_explore",
    "empirical_fast",
    "empirical_complex",
    "empirical_loop",
    "empirical_archive",
    "empirical_workstreams",
    "empirical_capabilities",
    "empirical_policy",
  ]) {
    if (!tools.tools.some((tool) => tool.name === name)) {
      throw new Error(`Bundled MCP server did not expose ${name}`);
    }
  }
  const initialized = await client.callTool({
    name: "empirical_init",
    arguments: { root },
  });
  if (initialized.isError) throw new Error("Bundled empirical_init failed");

  const explored = await client.callTool({
    name: "empirical_explore",
    arguments: { root, problem: "Make status easier to understand" },
  });
  const exploredPacket = explored.structuredContent as { problem?: string } | undefined;
  if (explored.isError || exploredPacket?.problem !== "Make status easier to understand") {
    throw new Error("Bundled empirical_explore failed");
  }
  const stateAfterExplore = JSON.parse(
    await readFile(join(root, ".empirical", "state.json"), "utf8"),
  ) as { revision?: number; activeFeature?: string | null };
  if (stateAfterExplore.revision !== 0 || stateAfterExplore.activeFeature !== null) {
    throw new Error("Bundled empirical_explore mutated workflow state");
  }

  const createdWorkstream = await client.callTool({
    name: "empirical_workstreams",
    arguments: { root, operation: "create", name: "parallel" },
  });
  if (createdWorkstream.isError) throw new Error("Bundled workstream creation failed");
  const parallelStarted = await client.callTool({
    name: "empirical_fast",
    arguments: { root, workstream: "parallel", request: "Add a parallel marker" },
  });
  const parallelPacket = parallelStarted.structuredContent as { workstream?: string; revision?: number } | undefined;
  if (parallelStarted.isError || parallelPacket?.workstream !== "parallel" || parallelPacket.revision !== 1) {
    throw new Error("Bundled explicit workstream start failed");
  }

  const complexInitProcess = Bun.spawn(
    ["node", cli, "init", "--root", complexRoot],
    { stdout: "pipe", stderr: "pipe" },
  );
  await new Response(complexInitProcess.stdout).text();
  if ((await complexInitProcess.exited) !== 0) throw new Error("Bundled CLI init failed");
  const complexProcess = Bun.spawn(
    ["node", cli, "complex", "Replace authentication safely", "--root", complexRoot],
    { stdout: "pipe", stderr: "pipe" },
  );
  const complexText = await new Response(complexProcess.stdout).text();
  if (
    (await complexProcess.exited) !== 0
    || !complexText.includes("specify (complex, waiting, revision 1)")
    || !complexText.includes("workstream default · step 1/7")
    || !complexText.includes("Required artifacts:")
  ) {
    throw new Error("Bundled CLI Complex starter did not return its specification action");
  }

  const fastProcess = Bun.spawn(
    ["node", cli, "fast", "Add a hello command", "--root", root],
    { stdout: "pipe", stderr: "pipe" },
  );
  const fastText = await new Response(fastProcess.stdout).text();
  if ((await fastProcess.exited) !== 0) throw new Error("Bundled CLI Fast starter failed");
  for (const expected of [
    "workstream default · step 1/1",
    "implement (fast, waiting, revision 1)",
    "Acceptance criteria:",
    "Required evidence: test, review",
    "Complete with:",
    '--test "<test result>" --review "<diff review>"',
  ]) {
    if (!fastText.includes(expected)) {
      throw new Error(`Bundled CLI Fast output omitted '${expected}'`);
    }
  }

  const started = await client.callTool({
    name: "empirical_fast",
    arguments: { root, request: "Add a hello command" },
  });
  const startedState = started.structuredContent as { phase?: string; revision?: number } | undefined;
  if (started.isError || startedState?.phase !== "implement" || startedState.revision !== 1) {
    throw new Error("Bundled empirical_fast did not idempotently resume Fast work");
  }

  const looped = await client.callTool({ name: "empirical_loop", arguments: { root } });
  const loopedState = looped.structuredContent as { phase?: string; revision?: number } | undefined;
  if (looped.isError || loopedState?.phase !== "implement" || loopedState.revision !== 1) {
    throw new Error("Bundled empirical_loop did not resume the current action");
  }

  const cliLoopProcess = Bun.spawn(
    ["node", cli, "loop", "--root", root],
    { stdout: "pipe", stderr: "pipe" },
  );
  const cliLoopText = await new Response(cliLoopProcess.stdout).text();
  if ((await cliLoopProcess.exited) !== 0) throw new Error("Bundled CLI loop failed");
  if (!cliLoopText.includes("implement (fast, waiting, revision 1)")) {
    throw new Error("CLI and MCP did not resume the same current action");
  }

  const invalidLoopProcess = Bun.spawn(
    ["node", cli, "loop", "Add another command", "--root", root],
    { stdout: "pipe", stderr: "pipe" },
  );
  const invalidLoopError = await new Response(invalidLoopProcess.stderr).text();
  if ((await invalidLoopProcess.exited) === 0 || !invalidLoopError.includes("empirical fast or empirical complex")) {
    throw new Error("Bundled CLI loop accepted a request instead of remaining resume-only");
  }

  const mixedInputPath = join(root, "mixed-completion.json");
  await writeFile(
    mixedInputPath,
    `${JSON.stringify({ revision: 1, outcome: "passed", summary: "Mixed input must fail" })}\n`,
    "utf8",
  );
  const mixedInputProcess = Bun.spawn(
    ["node", cli, "complete", "--input", mixedInputPath, "--test", "Must not be ignored", "--root", root],
    { stdout: "pipe", stderr: "pipe" },
  );
  const mixedInputError = await new Response(mixedInputProcess.stderr).text();
  if ((await mixedInputProcess.exited) === 0 || !mixedInputError.includes("--input cannot be combined")) {
    throw new Error("Bundled CLI silently ignored completion arguments combined with --input");
  }

  const completeProcess = Bun.spawn(
    [
      "node",
      cli,
      "complete",
      "--revision",
      "1",
      "--outcome",
      "passed",
      "--summary",
      "Implemented the command",
      "--test",
      "Focused command test passed",
      "--review",
      "Reviewed the focused diff",
      "--root",
      root,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const completeText = await new Response(completeProcess.stdout).text();
  if ((await completeProcess.exited) !== 0 || !completeText.includes("done (fast, done, revision 2)")) {
    throw new Error("Bundled CLI Fast evidence shortcuts did not complete the workflow");
  }

  const complexFeature = "001-replace-authentication-safely";
  const complexDirectory = join(complexRoot, ".empirical", "specs", complexFeature);
  await writeFile(
    join(complexDirectory, "spec.md"),
    "# Authentication\n\n## Acceptance Criteria\n\n- [ ] [AC-1] Existing users can sign in.\n",
    "utf8",
  );
  await mkdir(join(complexDirectory, "deltas"), { recursive: true });
  await writeFile(
    join(complexDirectory, "deltas", "authentication.md"),
    "## Purpose\n\nThis capability defines the current observable authentication behavior.\n\n## ADDED Requirements\n\n### Requirement: Existing users can sign in\n\nExisting users MUST be able to sign in.\n\n#### Scenario: Valid credentials\n\n- **WHEN** an existing user submits valid credentials\n- **THEN** the user is signed in\n",
    "utf8",
  );
  let complexStep = await runCli(complexRoot, [
    "complete", "--revision", "1", "--outcome", "passed", "--summary", "Specified",
  ]);
  if (complexStep.code !== 0 || !complexStep.stdout.includes("design (complex, waiting, revision 2)")) {
    throw new Error(`Built Complex Specify completion failed: ${complexStep.stderr}`);
  }
  await writeFile(join(complexDirectory, "design.md"), "# Design\n\nUse a session adapter.\n", "utf8");
  complexStep = await runCli(complexRoot, [
    "complete", "--revision", "2", "--outcome", "passed", "--summary", "Designed",
  ]);
  await writeFile(join(complexDirectory, "plan.md"), "# Plan\n\n1. Implement and verify.\n", "utf8");
  complexStep = await runCli(complexRoot, [
    "complete", "--revision", "3", "--outcome", "passed", "--summary", "Planned",
  ]);
  complexStep = await runCli(complexRoot, [
    "complete", "--revision", "4", "--outcome", "passed", "--summary", "Implemented", "--actor", "builder",
  ]);
  const verifyEvidence = join(complexRoot, "verify-evidence.json");
  await writeFile(verifyEvidence, `${JSON.stringify([{
    criterionId: "AC-1",
    kind: "test",
    passed: true,
    summary: "Authentication test passed",
  }])}\n`, "utf8");
  complexStep = await runCli(complexRoot, [
    "complete", "--revision", "5", "--outcome", "passed", "--summary", "Verified", "--evidence", verifyEvidence,
  ]);
  const reviewEvidence = join(complexRoot, "review-evidence.json");
  await writeFile(reviewEvidence, `${JSON.stringify([{
    criterionId: "all",
    kind: "review",
    passed: true,
    summary: "No blocking review findings",
  }])}\n`, "utf8");
  complexStep = await runCli(complexRoot, [
    "complete", "--revision", "6", "--outcome", "passed", "--summary", "Reviewed", "--actor", "reviewer", "--evidence", reviewEvidence,
  ]);
  if (complexStep.code !== 0 || !complexStep.stdout.includes("archive (complex, waiting, revision 7)")) {
    throw new Error(`Built Complex Review did not require Archive: ${complexStep.stderr}`);
  }
  const archived = await client.callTool({
    name: "empirical_archive",
    arguments: { root: complexRoot, workstream: "default", revision: 7 },
  });
  const archiveReport = archived.structuredContent as { report?: { added?: number }; action?: { phase?: string } } | undefined;
  if (archived.isError || archiveReport?.report?.added !== 1 || archiveReport.action?.phase !== "done") {
    throw new Error("Built MCP Archive failed");
  }
  complexStep = await runCli(complexRoot, ["archive", "--revision", "7"]);
  if (complexStep.code !== 0 || !complexStep.stdout.includes("was already archived")) {
    throw new Error(`Built CLI Archive retry did not converge: ${complexStep.stderr}`);
  }
  const capability = await readFile(
    join(complexRoot, ".empirical", "capabilities", "authentication", "spec.md"),
    "utf8",
  );
  if (!capability.includes("Requirement: Existing users can sign in")) {
    throw new Error("Built Archive did not write the living capability specification");
  }
  const capabilities = await client.callTool({
    name: "empirical_capabilities",
    arguments: { root: complexRoot },
  });
  const capabilityList = capabilities.structuredContent as { value?: Array<{ name?: string }> } | undefined;
  if (capabilities.isError || capabilityList?.value?.[0]?.name !== "authentication") {
    throw new Error("Built MCP capability listing failed");
  }

  const completeHelpProcess = Bun.spawn(
    ["node", cli, "complete", "--help", "--root", root],
    { stdout: "pipe", stderr: "pipe" },
  );
  const completeHelp = await new Response(completeHelpProcess.stdout).text();
  if ((await completeHelpProcess.exited) !== 0 || !completeHelp.includes("--test") || !completeHelp.includes("--review")) {
    throw new Error("Bundled CLI completion help omitted the Fast evidence shortcuts");
  }

  const versionProcess = Bun.spawn(["node", cli, "--version"], { stdout: "pipe", stderr: "pipe" });
  const installedVersion = (await new Response(versionProcess.stdout).text()).trim();
  if ((await versionProcess.exited) !== 0) throw new Error("Bundled CLI version command failed");
  const packageJson = JSON.parse(await readFile(resolve(import.meta.dir, "../package.json"), "utf8")) as {
    version: string;
  };
  if (installedVersion !== packageJson.version) {
    throw new Error(`Bundled CLI ${installedVersion} does not match package ${packageJson.version}`);
  }

  const helpProcess = Bun.spawn(["node", cli, "help"], { stdout: "pipe", stderr: "pipe" });
  const help = await new Response(helpProcess.stdout).text();
  if (
    (await helpProcess.exited) !== 0
    || !help.includes('empirical fast "<feature request>"')
    || !help.includes('empirical complex "<feature request>"')
    || !help.includes("empirical loop")
  ) {
    throw new Error("Bundled CLI help did not expose Fast, Complex, and resume-only loop");
  }

  console.log("Bundled Explore, Fast/Complex/Archive, workstream, CLI UX, and stdio MCP smoke test passed.");
} finally {
  await client.close();
  await Promise.all([
    rm(root, { recursive: true, force: true }),
    rm(complexRoot, { recursive: true, force: true }),
  ]);
}
