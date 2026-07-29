import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

try {
  await client.connect(transport);
  const tools = await client.listTools();
  for (const name of ["empirical_fast", "empirical_complex", "empirical_loop"]) {
    if (!tools.tools.some((tool) => tool.name === name)) {
      throw new Error(`Bundled MCP server did not expose ${name}`);
    }
  }
  const initialized = await client.callTool({
    name: "empirical_init",
    arguments: { root },
  });
  if (initialized.isError) throw new Error("Bundled empirical_init failed");

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

  console.log("Bundled Fast/Complex SDD starters, resume-only loop, and stdio MCP smoke test passed.");
} finally {
  await client.close();
  await Promise.all([
    rm(root, { recursive: true, force: true }),
    rm(complexRoot, { recursive: true, force: true }),
  ]);
}
