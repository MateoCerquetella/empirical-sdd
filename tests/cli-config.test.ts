import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const directories: string[] = [];
const cli = resolve(import.meta.dir, "../src/cli.ts");
afterEach(async () => Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

async function root(): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), "empirical-config-"));
  directories.push(value);
  return value;
}

async function run(args: string[], input = "") {
  const child = Bun.spawn([Bun.argv[0]!, "run", cli, ...args], {
    stdin: Buffer.from(input), stdout: "pipe", stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  return { stdout, stderr, exitCode };
}

describe("first-run configuration CLI", () => {
  test("forced interactive init asks once and persists every answer", async () => {
    const directory = await root();
    const first = await run([
      "init", "--interactive", "--no-integrations", "--root", directory,
    ], "off\nmain\n../{repo}-sandbox-{feature}\n{type}/team-{feature}\nrequired\n");
    expect(first.exitCode).toBe(0);
    expect(first.stderr).toBe("");
    expect(first.stdout).toContain("Empirical first-run setup");
    expect(first.stdout).toContain("Default Git base");
    expect(first.stdout).toContain("Complex decision records");
    expect(JSON.parse(await readFile(join(directory, ".empirical/config.json"), "utf8"))).toMatchObject({
      setupComplete: true,
      isolation: {
        mode: "off",
        baseBranch: "main",
        worktreePath: "../{repo}-sandbox-{feature}",
        branchPattern: "{type}/team-{feature}",
      },
      decisions: { complexRecords: "required" },
    });

    const second = await run(["init", "--interactive", "--no-integrations", "--root", directory]);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).not.toContain("Empirical first-run setup");
  });

  test("non-interactive init uses safe defaults and explicit flags can replace them", async () => {
    const directory = await root();
    const initialized = await run(["init", "--defaults", "--no-integrations", "--json", "--root", directory]);
    expect(initialized.exitCode).toBe(0);
    expect(JSON.parse(initialized.stdout).config).toMatchObject({
      setupComplete: true,
      isolation: { mode: "ask", baseBranch: "auto", worktreePath: "../{repo}-{feature}", branchPattern: "{type}/{feature}" },
      decisions: { complexRecords: "required" },
    });
    const configured = await run([
      "config", "--isolation", "off", "--base", "develop",
      "--worktree-path", "../alt-{feature}", "--branch-pattern", "{type}/alt-{feature}",
      "--decisions", "off", "--json", "--root", directory,
    ]);
    expect(configured.exitCode).toBe(0);
    expect(JSON.parse(configured.stdout)).toMatchObject({
      isolation: { mode: "off", baseBranch: "develop", worktreePath: "../alt-{feature}", branchPattern: "{type}/alt-{feature}" },
      decisions: { complexRecords: "off" },
    });
  });

  test("legacy workstream flags and commands are rejected", async () => {
    const directory = await root();
    await run(["init", "--defaults", "--no-integrations", "--root", directory]);
    const flag = await run(["status", "--workstream", "legacy", "--root", directory]);
    expect(flag.exitCode).toBe(1);
    expect(flag.stderr).toContain("INVALID_ARGUMENT");
    const command = await run(["workstream", "list", "--root", directory]);
    expect(command.exitCode).toBe(1);
    expect(command.stderr).toContain("UNKNOWN_COMMAND");
  });

  test("Explain has matching human and JSON surfaces", async () => {
    const directory = await root();
    await run(["init", "--defaults", "--no-integrations", "--root", directory]);
    await run(["fast", "Add one explainable command", "--root", directory]);
    const human = await run(["explain", "--root", directory]);
    const json = await run(["explain", "--json", "--root", directory]);
    expect(human.exitCode).toBe(0);
    expect(human.stdout).toContain("Empirical Explain");
    expect(human.stdout).toContain("Gate: proceed");
    expect(JSON.parse(json.stdout)).toMatchObject({
      feature: "add-one-explainable-command",
      rationale: { gate: "proceed" },
    });
  });
});
