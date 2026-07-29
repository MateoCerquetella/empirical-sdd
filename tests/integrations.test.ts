import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { EmpiricalProject } from "../src/core.js";
import { EmpiricalError } from "../src/errors.js";
import { installGlobalAgentSkills } from "../src/integrations.js";
import type { IntegrationReport } from "../src/types.js";

const directories: string[] = [];
const obsoleteSkillNames = [
  "empirical-explore",
  "empirical-fast",
  "empirical-complex",
  "empirical-loop",
] as const;
const globalRoots = [
  [".codex", "skills"],
  [".claude", "skills"],
  [".cursor", "skills"],
  [".gemini", "skills"],
  [".codeium", "windsurf", "skills"],
] as const;

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  directories.push(directory);
  return directory;
}

describe("agent integrations", () => {
  test("project initialization installs runtime bridges without project-local workflow commands", async () => {
    const root = await temporaryDirectory("empirical-project-integrations-");
    const { integrations } = await EmpiricalProject.initialize(root);

    expect(integrations.scope).toBe("project");
    expect(integrations.entrypoints).toEqual([]);
    expect(integrations.created.sort()).toEqual([
      ".codex/config.toml",
      ".cursor/mcp.json",
      ".gemini/settings.json",
      ".mcp.json",
    ]);
    await expect(readFile(join(root, ".agents", "skills", "empirical", "SKILL.md"), "utf8"))
      .rejects.toBeDefined();
    expect(await readFile(join(root, ".mcp.json"), "utf8")).toContain('"empirical"');
  });

  test("project integration removes only marker-owned legacy commands and instruction blocks", async () => {
    const root = await temporaryDirectory("empirical-project-migration-");
    await mkdir(join(root, ".agents", "skills", "empirical-fast"), { recursive: true });
    await mkdir(join(root, ".claude", "skills", "empirical-complex"), { recursive: true });
    await writeFile(
      join(root, "AGENTS.md"),
      "  Keep this spacing.  \n<!-- empirical-sdd:start -->\nold workflow\n<!-- empirical-sdd:end -->\n",
      "utf8",
    );
    await writeFile(
      join(root, ".agents", "skills", "empirical-fast", "SKILL.md"),
      "<!-- empirical-sdd:managed-file -->\nold\n",
      "utf8",
    );
    await writeFile(
      join(root, ".claude", "skills", "empirical-complex", "SKILL.md"),
      "# Mine\n",
      "utf8",
    );

    const { integrations } = await EmpiricalProject.initialize(root);
    expect(await readFile(join(root, "AGENTS.md"), "utf8")).toBe("  Keep this spacing.  \n");
    expect(integrations.removed).toContain(".agents/skills/empirical-fast/SKILL.md");
    expect(integrations.preserved).toContain(
      ".claude/skills/empirical-complex/SKILL.md (existing unmanaged file)",
    );
    expect(await readFile(join(root, ".claude", "skills", "empirical-complex", "SKILL.md"), "utf8"))
      .toBe("# Mine\n");
  });

  test("global install creates exactly one Empirical skill for every selected agent", async () => {
    const home = await temporaryDirectory("empirical-global-skills-");
    const report = await installGlobalAgentSkills(home, { all: true, pathValue: "" });

    expect(report.scope).toBe("global");
    expect(report.created).toHaveLength(5);
    expect(report.updated).toEqual([]);
    expect(report.removed).toEqual([]);
    expect(report.preserved).toEqual([]);
    expect(report.entrypoints.map((entrypoint) => entrypoint.artifactRoot)).toEqual(
      globalRoots.map((segments) => join(home, ...segments)),
    );
    expect(report.entrypoints.every((entrypoint) => entrypoint.invocations.length === 1)).toBe(true);
    expect(report.entrypoints.find((entrypoint) => entrypoint.id === "codex")?.invocations)
      .toEqual(["$empirical"]);
    expect(report.entrypoints.find((entrypoint) => entrypoint.id === "claude")?.invocations)
      .toEqual(["/empirical"]);
    expect(report.entrypoints.find((entrypoint) => entrypoint.id === "windsurf")?.invocations)
      .toEqual(["@empirical"]);

    for (const segments of globalRoots) {
      const contents = await readFile(join(home, ...segments, "empirical", "SKILL.md"), "utf8");
      expect(contents).toContain("name: empirical");
      expect(contents).toContain("the only user-facing Empirical workflow");
      expect(contents).toContain("pass the chosen isolation, base, worktree");
      expect(contents).toContain("reports selected non-terminal work");
      expect(contents).toContain("five Socratic passes");
      expect(contents).toContain("call empirical_fast only when");
      expect(contents).toContain("Continue here, Save for later");
      expect(contents).toContain("empirical __internal loop");
      expect(contents).not.toMatch(/empirical (?:init|explore|fast|complex|loop|complete|archive|context|handoff)(?:\s|$)/);
      for (const obsolete of obsoleteSkillNames) {
        await expect(readFile(join(home, ...segments, obsolete, "SKILL.md"), "utf8"))
          .rejects.toBeDefined();
      }
    }

    const repeated = await installGlobalAgentSkills(home, { all: true, pathValue: "" });
    expect(repeated.created).toEqual([]);
    expect(repeated.updated).toEqual([]);
    expect(repeated.removed).toEqual([]);
    expect(repeated.preserved).toEqual([]);
  });

  test("global refresh updates the single managed skill, removes managed legacy skills, and preserves unmanaged collisions", async () => {
    const home = await temporaryDirectory("empirical-global-preserve-");
    await installGlobalAgentSkills(home, { all: true, pathValue: "" });

    const stale = join(home, ".codex", "skills", "empirical", "SKILL.md");
    const managedObsolete = join(home, ".codex", "skills", "empirical-fast", "SKILL.md");
    const unmanagedObsolete = join(home, ".claude", "skills", "empirical-fast", "SKILL.md");
    const nonFile = join(home, ".gemini", "skills", "empirical-loop", "SKILL.md");
    await writeFile(stale, "<!-- empirical-sdd:managed-file -->\nstale\n", "utf8");
    await mkdir(join(managedObsolete, ".."), { recursive: true });
    await writeFile(managedObsolete, "<!-- empirical-sdd:managed-file -->\nold\n", "utf8");
    await mkdir(join(unmanagedObsolete, ".."), { recursive: true });
    await writeFile(unmanagedObsolete, "# My own skill\n", "utf8");
    await mkdir(nonFile, { recursive: true });

    const report = await installGlobalAgentSkills(home, { all: true, pathValue: "" });
    expect(report.updated).toContain(".codex/skills/empirical/SKILL.md");
    expect(report.removed).toContain(".codex/skills/empirical-fast/SKILL.md");
    expect(await readFile(stale, "utf8")).toContain("name: empirical");
    expect(report.preserved).toContain(
      ".claude/skills/empirical-fast/SKILL.md (existing unmanaged file)",
    );
    expect(await readFile(unmanagedObsolete, "utf8")).toBe("# My own skill\n");
    expect(report.preserved).toContain(
      ".gemini/skills/empirical-loop/SKILL.md (existing non-file)",
    );
    expect((await lstat(nonFile)).isDirectory()).toBe(true);
  });

  test("an explicit selection installs selected agents and removes only deselected managed skills", async () => {
    const home = await temporaryDirectory("empirical-global-selection-");
    await installGlobalAgentSkills(home, { all: true, pathValue: "" });
    const unmanaged = join(home, ".claude", "skills", "my-skill", "SKILL.md");
    await mkdir(join(unmanaged, ".."), { recursive: true });
    await writeFile(unmanaged, "# Mine\n", "utf8");

    const report = await installGlobalAgentSkills(home, { agents: ["codex", "cursor"], pathValue: "" });
    expect(report.entrypoints.map((entrypoint) => entrypoint.id)).toEqual(["codex", "cursor"]);
    expect(report.removed).toEqual(expect.arrayContaining([
      ".claude/skills/empirical/SKILL.md",
      ".gemini/skills/empirical/SKILL.md",
      ".codeium/windsurf/skills/empirical/SKILL.md",
    ]));
    expect(await readFile(unmanaged, "utf8")).toBe("# Mine\n");
    expect(await readFile(join(home, ".codex", "skills", "empirical", "SKILL.md"), "utf8"))
      .toContain("name: empirical");
    await expect(readFile(join(home, ".claude", "skills", "empirical", "SKILL.md"), "utf8"))
      .rejects.toBeDefined();
  });

  test("global refresh does not follow skill or parent-directory symbolic links", async () => {
    if (process.platform === "win32") return;
    const home = await temporaryDirectory("empirical-global-links-");
    const outside = await temporaryDirectory("empirical-global-links-outside-");
    await mkdir(join(home, ".codex", "skills"), { recursive: true });
    await mkdir(join(home, ".cursor"), { recursive: true });
    await symlink(outside, join(home, ".codex", "skills", "empirical"));
    await symlink(outside, join(home, ".cursor", "skills"));

    const report = await installGlobalAgentSkills(home, { all: true, pathValue: "" });
    expect(report.preserved).toContain(
      ".codex/skills/empirical/SKILL.md (symbolic link ancestor .codex/skills/empirical)",
    );
    expect(report.preserved).toContain(
      ".cursor/skills/empirical/SKILL.md (symbolic link ancestor .cursor/skills)",
    );
    expect(await lstat(join(home, ".codex", "skills", "empirical"))).toSatisfy((value) => value.isSymbolicLink());
    await expect(readFile(join(outside, "SKILL.md"), "utf8")).rejects.toBeDefined();
  });

  test("global integration rejects empty and filesystem-root homes", async () => {
    await expect(installGlobalAgentSkills(" ")).rejects.toBeInstanceOf(EmpiricalError);
    await expect(installGlobalAgentSkills(parse(tmpdir()).root)).rejects.toBeInstanceOf(EmpiricalError);
  });

  test("install CLI works outside a project and reports one human and JSON entrypoint per agent", async () => {
    const home = await temporaryDirectory("empirical-global-cli-home-");
    const cwd = await temporaryDirectory("empirical-global-cli-cwd-");
    const cli = join(import.meta.dir, "..", "src", "cli.ts");
    const env = {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
    };

    const human = spawnSync(process.execPath, [cli, "install", "--all"], {
      cwd,
      env,
      encoding: "utf8",
    });
    expect(human.status).toBe(0);
    expect(human.stderr).toBe("");
    expect(human.stdout).toContain("reconciled 5 selected agents (5 created");
    expect(human.stdout).toContain("Installed Empirical entrypoints:");
    expect(human.stdout).toContain(`Codex (${join(home, ".codex", "skills")}): $empirical`);
    expect(human.stdout).toContain("Windsurf");
    expect(human.stdout).not.toContain("$empirical-explore");

    const json = spawnSync(process.execPath, [cli, "install", "--all", "--json"], {
      cwd,
      env,
      encoding: "utf8",
    });
    expect(json.status).toBe(0);
    const report = JSON.parse(json.stdout) as Awaited<ReturnType<typeof installGlobalAgentSkills>>;
    expect(report.scope).toBe("global");
    expect(report.created).toEqual([]);
    expect(report.entrypoints).toHaveLength(5);
    expect(report.entrypoints.every((entrypoint) => entrypoint.invocations.length === 1)).toBe(true);
    await expect(lstat(join(cwd, ".empirical"))).rejects.toBeDefined();
  });

  test("primary help exposes only install and update as normal terminal commands", () => {
    const cli = join(import.meta.dir, "..", "src", "cli.ts");
    const cwd = spawnSync(process.execPath, [cli, "help"], {
      encoding: "utf8",
    });
    expect(cwd.status).toBe(0);
    expect(cwd.stdout).toContain("empirical install");
    expect(cwd.stdout).toContain("empirical update");
    for (const hidden of [
      "init", "config", "explore", "fast", "complex", "loop", "complete",
      "archive", "status", "integrate", "doctor", "migrate",
    ]) expect(cwd.stdout).not.toContain(`empirical ${hidden}`);
    const empty = spawnSync(process.execPath, [cli], { encoding: "utf8" });
    expect(empty.status).toBe(0);
    expect(empty.stdout).toBe(cwd.stdout);
  });

  test("public workflow verbs are rejected before project discovery", () => {
    const cli = join(import.meta.dir, "..", "src", "cli.ts");
    for (const command of ["init", "config", "explore", "fast", "complex", "loop"]) {
      const result = spawnSync(process.execPath, [cli, command], { encoding: "utf8" });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("UNKNOWN_COMMAND");
      expect(result.stderr).toContain("empirical install or empirical update");
    }
  });

  test("non-interactive install requires an explicit selection", async () => {
    const home = await temporaryDirectory("empirical-global-no-tty-");
    const cli = join(import.meta.dir, "..", "src", "cli.ts");
    const result = spawnSync(process.execPath, [cli, "install"], {
      encoding: "utf8",
      env: { ...process.env, HOME: home, USERPROFILE: home, PATH: "" },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("AGENT_SELECTION_REQUIRED");
    expect(result.stderr).toContain("--agent <name>");
  });

  test("repeatable agent flags install the exact selection", async () => {
    const home = await temporaryDirectory("empirical-global-flags-");
    const cli = join(import.meta.dir, "..", "src", "cli.ts");
    const result = spawnSync(process.execPath, [
      cli, "install", "-a", "codex", "--agent", "gemini", "--json",
    ], {
      encoding: "utf8",
      env: { ...process.env, HOME: home, USERPROFILE: home, PATH: "" },
    });
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as Awaited<ReturnType<typeof installGlobalAgentSkills>>;
    expect(report.entrypoints.map((entrypoint) => entrypoint.id)).toEqual(["codex", "gemini"]);
  });

  test("yes mode preserves detected agents without prompting", async () => {
    const home = await temporaryDirectory("empirical-global-yes-");
    await mkdir(join(home, ".codex"), { recursive: true });
    const cli = join(import.meta.dir, "..", "src", "cli.ts");
    const result = spawnSync(process.execPath, [cli, "install", "--yes", "--json"], {
      encoding: "utf8",
      env: { ...process.env, HOME: home, USERPROFILE: home, PATH: "" },
    });
    expect(result.status).toBe(0);
    expect((JSON.parse(result.stdout) as IntegrationReport).entrypoints.map((entrypoint) => entrypoint.id))
      .toEqual(["codex"]);
  });
});
