import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { EmpiricalProject } from "../src/core.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

test("the bundled stdio MCP server exposes and executes the portable workflow tools", async () => {
  const root = await mkdtemp(join(tmpdir(), "empirical-mcp-"));
  const complexRoot = await mkdtemp(join(tmpdir(), "empirical-mcp-complex-"));
  directories.push(root, complexRoot);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["run", resolve("src/cli.ts"), "mcp", "--root", root],
    cwd: resolve("."),
    stderr: "pipe",
  });
  const client = new Client({ name: "empirical-test", version: "1.0.0" });
  await client.connect(transport);
  try {
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name)).toContain("empirical_next");
    expect(listed.tools.map((tool) => tool.name)).toContain("empirical_complete");
    expect(listed.tools.map((tool) => tool.name)).toContain("empirical_loop");
    expect(listed.tools.map((tool) => tool.name)).toContain("empirical_fast");
    expect(listed.tools.map((tool) => tool.name)).toContain("empirical_complex");
    expect(listed.tools.map((tool) => tool.name)).toContain("empirical_explore");
    expect(listed.tools.map((tool) => tool.name)).toContain("empirical_archive");
    expect(listed.tools.map((tool) => tool.name)).toContain("empirical_workstreams");
    expect(listed.tools.map((tool) => tool.name)).toContain("empirical_capabilities");
    expect(listed.tools.map((tool) => tool.name)).toContain("empirical_policy");
    expect(listed.tools.map((tool) => tool.name)).not.toContain("empirical_strong");
    expect(listed.tools.map((tool) => tool.name)).toContain("empirical_start");

    const loopTool = listed.tools.find((tool) => tool.name === "empirical_loop");
    expect(Object.keys(loopTool?.inputSchema.properties ?? {})).toEqual(["root", "workstream"]);
    const legacyStart = listed.tools.find((tool) => tool.name === "empirical_start");
    expect(legacyStart?.inputSchema.properties?.profile).toMatchObject({
      enum: ["fast", "complex"],
    });

    const initialized = await client.callTool({
      name: "empirical_init",
      arguments: { root },
    });
    expect(initialized.isError).not.toBe(true);
    expect(initialized.structuredContent).toMatchObject({
      state: { profile: "complex", phase: "idle", revision: 0 },
    });

    const explored = await client.callTool({
      name: "empirical_explore",
      arguments: { root, problem: "We might need a more useful status experience" },
    });
    expect(explored.isError).not.toBe(true);
    expect(explored.structuredContent).toMatchObject({
      problem: "We might need a more useful status experience",
      projectContext: [],
      capabilityContext: [],
    });
    expect(explored.structuredContent).toEqual(
      await (await EmpiricalProject.open(root)).explore(
        "We might need a more useful status experience",
      ),
    );

    const idle = await client.callTool({
      name: "empirical_loop",
      arguments: { root },
    });
    expect(idle.isError).not.toBe(true);
    expect(idle.structuredContent).toMatchObject({ phase: "idle", revision: 0 });

    const started = await client.callTool({
      name: "empirical_fast",
      arguments: { root, request: "Add a status command" },
    });
    expect(started.isError).not.toBe(true);
    expect(started.structuredContent).toMatchObject({
      request: "Add a status command",
      profile: "fast",
      phase: "implement",
      status: "waiting",
      revision: 1,
      requiredEvidence: ["test", "review"],
      workstream: "default",
    });

    const resumed = await client.callTool({
      name: "empirical_loop",
      arguments: { root },
    });
    expect(resumed.isError).not.toBe(true);
    expect(resumed.structuredContent).toEqual(started.structuredContent);

    const idempotentFast = await client.callTool({
      name: "empirical_fast",
      arguments: { root, request: "Add a status command" },
    });
    expect(idempotentFast.isError).not.toBe(true);
    expect(idempotentFast.structuredContent).toEqual(started.structuredContent);

    const complexInitialized = await client.callTool({
      name: "empirical_init",
      arguments: { root: complexRoot },
    });
    expect(complexInitialized.isError).not.toBe(true);

    const complex = await client.callTool({
      name: "empirical_complex",
      arguments: { root: complexRoot, request: "Replace authentication safely" },
    });
    expect(complex.isError).not.toBe(true);
    expect(complex.structuredContent).toMatchObject({
      request: "Replace authentication safely",
      profile: "complex",
      phase: "specify",
      status: "waiting",
      revision: 1,
    });

    const resumedComplex = await client.callTool({
      name: "empirical_loop",
      arguments: { root: complexRoot },
    });
    expect(resumedComplex.isError).not.toBe(true);
    expect(resumedComplex.structuredContent).toEqual(complex.structuredContent);
  } finally {
    await client.close();
  }
}, 20_000);
