import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
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

const internal = (args: string[]): string[] => ["__internal", ...args];

describe("first-run configuration CLI", () => {
  test("forced interactive init previews before writing and persists every customized answer", async () => {
    const directory = await root();
    const first = await run(internal([
      "init", "--interactive", "--no-integrations", "--root", directory,
    ]), "customize\noff\non\noff\non\nask\nmain\n../{repo}-sandbox-{feature}\n{type}/team-{feature}\nrequired\nsave\n");
    expect(first.exitCode).toBe(0);
    expect(first.stderr).toBe("");
    expect(first.stdout).toContain("Empirical setup");
    expect(first.stdout).toContain("Recommended settings");
    expect(first.stdout).toContain("Verification policy");
    expect(first.stdout).toContain("Default Git base");
    expect(first.stdout).toContain("Complex decision records");
    expect(first.stdout).toContain("Save these effective settings");
    expect(JSON.parse(await readFile(join(directory, ".empirical/config.json"), "utf8"))).toMatchObject({
      setupComplete: true,
      evidence: { required: false, browserForUi: true, screenshotForUi: false, codeReview: true },
      isolation: {
        mode: "ask",
        baseBranch: "main",
        worktreePath: "../{repo}-sandbox-{feature}",
        branchPattern: "{type}/team-{feature}",
      },
      decisions: { complexRecords: "required" },
    });

    const second = await run(internal(["init", "--interactive", "--no-integrations", "--root", directory]), "\n");
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain("Current settings");
    expect(second.stdout).toContain("Keep current settings");
    expect(JSON.parse(await readFile(join(directory, ".empirical/config.json"), "utf8"))).toMatchObject({
      evidence: { required: false, browserForUi: true, screenshotForUi: false, codeReview: true },
      isolation: { mode: "ask", baseBranch: "main" },
    });
  });

  test("setup cancellation happens before first-run or repair mutation", async () => {
    const directory = await root();
    const cancelled = await run(internal([
      "init", "--interactive", "--no-integrations", "--root", directory,
    ]), "cancel\n");
    expect(cancelled.exitCode).toBe(1);
    expect(cancelled.stderr).toContain("SETUP_CANCELLED");
    expect(await stat(join(directory, ".empirical")).then(() => true, () => false)).toBe(false);

    await run(internal(["init", "--defaults", "--no-integrations", "--root", directory]));
    const configPath = join(directory, ".empirical", "config.json");
    const before = await readFile(configPath, "utf8");
    const repairCancelled = await run(internal([
      "init", "--interactive", "--no-integrations", "--root", directory,
    ]), "cancel\n");
    expect(repairCancelled.exitCode).toBe(1);
    expect(await readFile(configPath, "utf8")).toBe(before);
  });

  test("non-interactive init uses safe defaults and explicit flags can replace them", async () => {
    const directory = await root();
    const initialized = await run(internal(["init", "--defaults", "--no-integrations", "--json", "--root", directory]));
    expect(initialized.exitCode).toBe(0);
    expect(JSON.parse(initialized.stdout).config).toMatchObject({
      setupComplete: true,
      evidence: { required: true, browserForUi: true, screenshotForUi: true, codeReview: true },
      isolation: { mode: "ask", baseBranch: "auto", worktreePath: "../{repo}-{feature}", branchPattern: "{type}/{feature}" },
      decisions: { complexRecords: "required" },
    });
    const configured = await run(internal([
      "config", "--isolation", "off", "--base", "develop",
      "--worktree-path", "../alt-{feature}", "--branch-pattern", "{type}/alt-{feature}",
      "--decisions", "off", "--evidence", "off", "--ui-browser", "off",
      "--ui-screenshot", "on", "--code-review", "on", "--json", "--root", directory,
    ]));
    expect(configured.exitCode).toBe(0);
    expect(JSON.parse(configured.stdout)).toMatchObject({
      isolation: { mode: "off", baseBranch: "develop", worktreePath: "../alt-{feature}", branchPattern: "{type}/alt-{feature}" },
      decisions: { complexRecords: "off" },
      evidence: { required: false, browserForUi: false, screenshotForUi: true, codeReview: true },
    });

    const partial = await run(internal([
      "config", "--evidence", "on", "--json", "--root", directory,
    ]));
    expect(JSON.parse(partial.stdout)).toMatchObject({
      evidence: { required: true, browserForUi: false, screenshotForUi: true, codeReview: true },
      isolation: { mode: "off", baseBranch: "develop" },
      decisions: { complexRecords: "off" },
    });
  });

  test("legacy workstream flags and commands are rejected", async () => {
    const directory = await root();
    await run(internal(["init", "--defaults", "--no-integrations", "--root", directory]));
    const flag = await run(internal(["status", "--workstream", "legacy", "--root", directory]));
    expect(flag.exitCode).toBe(1);
    expect(flag.stderr).toContain("INVALID_ARGUMENT");
    const command = await run(["workstream", "list", "--root", directory]);
    expect(command.exitCode).toBe(1);
    expect(command.stderr).toContain("UNKNOWN_COMMAND");
  });

  test("interactive/default modes reject conflicting configuration flags before mutation", async () => {
    const directory = await root();
    const interactive = await run(internal([
      "init", "--interactive", "--evidence", "off", "--no-integrations", "--root", directory,
    ]));
    expect(interactive.exitCode).toBe(1);
    expect(interactive.stderr).toContain("INVALID_ARGUMENT");
    expect(await stat(join(directory, ".empirical")).then(() => true, () => false)).toBe(false);

    const defaults = await run(internal([
      "init", "--defaults", "--decisions", "off", "--no-integrations", "--root", directory,
    ]));
    expect(defaults.exitCode).toBe(1);
    expect(defaults.stderr).toContain("INVALID_ARGUMENT");
    expect(await stat(join(directory, ".empirical")).then(() => true, () => false)).toBe(false);
  });

  test("Explain has matching human and JSON surfaces", async () => {
    const directory = await root();
    await run(internal(["init", "--defaults", "--no-integrations", "--root", directory]));
    await run(internal(["fast", "Add one explainable command", "--root", directory]));
    const human = await run(internal(["explain", "--root", directory]));
    const json = await run(internal(["explain", "--json", "--root", directory]));
    expect(human.exitCode).toBe(0);
    expect(human.stdout).toContain("Empirical Explain");
    expect(human.stdout).toContain("Gate: proceed");
    expect(JSON.parse(json.stdout)).toMatchObject({
      feature: "add-one-explainable-command",
      rationale: { gate: "proceed" },
    });
  });
});
