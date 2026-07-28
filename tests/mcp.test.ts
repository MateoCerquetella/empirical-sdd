import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

test("the bundled stdio MCP server exposes and executes the portable workflow tools", async () => {
  const root = await mkdtemp(join(tmpdir(), "empirical-mcp-"));
  directories.push(root);
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

    const initialized = await client.callTool({
      name: "empirical_init",
      arguments: { root, profile: "quick" },
    });
    expect(initialized.isError).not.toBe(true);

    const started = await client.callTool({
      name: "empirical_start",
      arguments: { root, request: "Add a status page" },
    });
    expect(started.isError).not.toBe(true);
    expect(JSON.stringify(started.content)).toContain("shape");
  } finally {
    await client.close();
  }
});
