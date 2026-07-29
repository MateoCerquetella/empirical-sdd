import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { EmpiricalProject } from "../src/core.js";
import { EmpiricalError } from "../src/errors.js";
import { installGlobalAgentSkills } from "../src/integrations.js";

const directories: string[] = [];
const skillNames = [
  "empirical",
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
  test("project integration creates five native entrypoints for all supported agents", async () => {
    const root = await temporaryDirectory("empirical-project-integrations-");
    const { integrations } = await EmpiricalProject.initialize(root);

    expect(integrations.scope).toBe("project");
    expect(integrations.entrypoints).toHaveLength(5);
    expect(integrations.entrypoints.find((entrypoint) => entrypoint.id === "codex")?.invocations)
      .toEqual(skillNames.map((name) => `$${name}`));
    expect(integrations.entrypoints.find((entrypoint) => entrypoint.id === "claude")?.invocations)
      .toEqual(skillNames.map((name) => `/${name}`));

    for (const name of skillNames) {
      const codex = await readFile(join(root, ".agents", "skills", name, "SKILL.md"), "utf8");
      const claude = await readFile(join(root, ".claude", "skills", name, "SKILL.md"), "utf8");
      expect(codex).toContain(`name: ${name}`);
      expect(claude).toContain(`name: ${name}`);
      expect(await readFile(join(root, ".cursor", "commands", `${name}.md`), "utf8"))
        .toContain("empirical-sdd:managed-file");
      expect(await readFile(join(root, ".gemini", "commands", `${name}.toml`), "utf8"))
        .toContain("empirical-sdd:managed-file");
      expect(await readFile(join(root, ".windsurf", "workflows", `${name}.md`), "utf8"))
        .toContain("empirical-sdd:managed-file");
    }
  });

  test("global integration installs all workflows into every native user skill root", async () => {
    const home = await temporaryDirectory("empirical-global-skills-");
    const report = await installGlobalAgentSkills(home);

    expect(report.scope).toBe("global");
    expect(report.created).toHaveLength(25);
    expect(report.updated).toEqual([]);
    expect(report.preserved).toEqual([]);
    expect(report.entrypoints.map((entrypoint) => entrypoint.artifactRoot)).toEqual(
      globalRoots.map((segments) => join(home, ...segments)),
    );
    expect(report.entrypoints.every((entrypoint) => entrypoint.kind === "skill")).toBe(true);
    expect(report.entrypoints.find((entrypoint) => entrypoint.id === "codex")?.invocations[0])
      .toBe("$empirical");
    expect(report.entrypoints.find((entrypoint) => entrypoint.id === "claude")?.invocations[0])
      .toBe("/empirical");
    expect(report.entrypoints.find((entrypoint) => entrypoint.id === "windsurf")?.invocations[0])
      .toBe("@empirical");
    expect(report.entrypoints.find((entrypoint) => entrypoint.id === "gemini")?.reload)
      .toContain("/skills reload");

    for (const segments of globalRoots) {
      for (const name of skillNames) {
        const contents = await readFile(join(home, ...segments, name, "SKILL.md"), "utf8");
        expect(contents).toContain(`name: ${name}`);
        expect(contents).toContain("empirical-sdd:managed-file");
      }
    }

    expect(await readFile(join(home, ".codex", "skills", "empirical-explore", "SKILL.md"), "utf8"))
      .toContain("five Socratic passes");
    expect(await readFile(join(home, ".codex", "skills", "empirical-fast", "SKILL.md"), "utf8"))
      .toContain("tiny, localized");
    expect(await readFile(join(home, ".codex", "skills", "empirical-complex", "SKILL.md"), "utf8"))
      .toContain("Specify, Design, Plan, Implement, Verify, Review, and Archive");
    expect(await readFile(join(home, ".codex", "skills", "empirical-loop", "SKILL.md"), "utf8"))
      .toContain("no new request or profile");

    const repeated = await installGlobalAgentSkills(home);
    expect(repeated.created).toEqual([]);
    expect(repeated.updated).toEqual([]);
    expect(repeated.preserved).toEqual([]);
  });

  test("global refresh updates managed files and preserves unmanaged collisions", async () => {
    const home = await temporaryDirectory("empirical-global-preserve-");
    await installGlobalAgentSkills(home);

    const stale = join(home, ".codex", "skills", "empirical", "SKILL.md");
    const unmanaged = join(home, ".claude", "skills", "empirical-fast", "SKILL.md");
    const nonFile = join(home, ".gemini", "skills", "empirical-loop", "SKILL.md");
    await writeFile(stale, "<!-- empirical-sdd:managed-file -->\nstale\n", "utf8");
    await writeFile(unmanaged, "# My own skill\n", "utf8");
    await rm(nonFile);
    await mkdir(nonFile);

    const report = await installGlobalAgentSkills(home);
    expect(report.updated).toContain(".codex/skills/empirical/SKILL.md");
    expect(await readFile(stale, "utf8")).toContain("name: empirical");
    expect(report.preserved).toContain(
      ".claude/skills/empirical-fast/SKILL.md (existing unmanaged file)",
    );
    expect(await readFile(unmanaged, "utf8")).toBe("# My own skill\n");
    expect(report.preserved).toContain(
      ".gemini/skills/empirical-loop/SKILL.md (existing non-file)",
    );
    expect((await lstat(nonFile)).isDirectory()).toBe(true);
  });

  test("global refresh does not follow skill or parent-directory symbolic links", async () => {
    if (process.platform === "win32") return;
    const home = await temporaryDirectory("empirical-global-links-");
    const outside = await temporaryDirectory("empirical-global-links-outside-");
    await mkdir(join(home, ".codex", "skills"), { recursive: true });
    await mkdir(join(home, ".cursor"), { recursive: true });
    await symlink(outside, join(home, ".codex", "skills", "empirical"));
    await symlink(outside, join(home, ".cursor", "skills"));

    const report = await installGlobalAgentSkills(home);
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

  test("global CLI works outside a project and reports human and JSON skill metadata", async () => {
    const home = await temporaryDirectory("empirical-global-cli-home-");
    const cwd = await temporaryDirectory("empirical-global-cli-cwd-");
    const cli = join(import.meta.dir, "..", "src", "cli.ts");
    const env = {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
    };

    const human = spawnSync(process.execPath, [cli, "integrate", "--global"], {
      cwd,
      env,
      encoding: "utf8",
    });
    expect(human.status).toBe(0);
    expect(human.stderr).toBe("");
    expect(human.stdout).toContain("Global Agent Skills installed (25 created");
    expect(human.stdout).toContain("Installed global skills:");
    expect(human.stdout).toContain(`Codex global skills (${join(home, ".codex", "skills")})`);
    expect(human.stdout).toContain("$empirical-explore");
    expect(human.stdout).toContain("@empirical-loop");

    const json = spawnSync(process.execPath, [cli, "integrate", "--global", "--json"], {
      cwd,
      env,
      encoding: "utf8",
    });
    expect(json.status).toBe(0);
    const report = JSON.parse(json.stdout) as Awaited<ReturnType<typeof installGlobalAgentSkills>>;
    expect(report.scope).toBe("global");
    expect(report.created).toEqual([]);
    expect(report.entrypoints).toHaveLength(5);
    await expect(lstat(join(cwd, ".empirical"))).rejects.toBeDefined();

    const projectOnly = spawnSync(process.execPath, [cli, "integrate"], {
      cwd,
      env,
      encoding: "utf8",
    });
    expect(projectOnly.status).not.toBe(0);
    expect(projectOnly.stderr).toContain("No .empirical project found");
  });
});
