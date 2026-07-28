import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = await mkdtemp(join(tmpdir(), "empirical-dist-smoke-"));
const transport = new StdioClientTransport({
  command: process.execPath === Bun.which("bun") ? "node" : process.execPath,
  args: [resolve(import.meta.dir, "../dist/cli.js"), "mcp", "--root", root],
  cwd: root,
  stderr: "pipe",
});
const client = new Client({ name: "empirical-dist-smoke", version: "1.0.0" });

try {
  await client.connect(transport);
  const tools = await client.listTools();
  if (!tools.tools.some((tool) => tool.name === "empirical_next")) {
    throw new Error("Bundled MCP server did not expose empirical_next");
  }
  const initialized = await client.callTool({
    name: "empirical_init",
    arguments: { root, profile: "quick" },
  });
  if (initialized.isError) throw new Error("Bundled empirical_init failed");
  console.log("Bundled Node CLI and stdio MCP smoke test passed.");
} finally {
  await client.close();
  await rm(root, { recursive: true, force: true });
}
