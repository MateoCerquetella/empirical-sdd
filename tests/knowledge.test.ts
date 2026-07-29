import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EmpiricalProject } from "../src/core.js";
import { refreshRepositoryKnowledge } from "../src/knowledge.js";
import type { RepositoryKnowledgeManifest } from "../src/types.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "empirical-knowledge-"));
  directories.push(root);
  return root;
}

describe("repository knowledge", () => {
  test("initialization creates bounded file-backed context without source contents or secrets", async () => {
    const root = await temporaryRepository();
    await writeFile(join(root, "README.md"), "# Example\nA public repository description.\n", "utf8");
    await writeFile(join(root, "package.json"), '{"scripts":{"test":"bun test"}}\n', "utf8");
    await writeFile(join(root, ".env"), "SECRET_VALUE=do-not-index\n", "utf8");
    await writeFile(join(root, "api-token.txt"), "do-not-index\n", "utf8");

    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const report = await project.context();
    const manifestText = await readFile(join(root, report.manifest), "utf8");
    const manifest = JSON.parse(manifestText) as RepositoryKnowledgeManifest;

    expect(report.status).toBe("current");
    expect(manifest.files.map((file) => file.path)).toContain("README.md");
    expect(manifest.files.map((file) => file.path)).toContain("package.json");
    expect(manifest.files.map((file) => file.path)).not.toContain(".env");
    expect(manifest.files.map((file) => file.path)).not.toContain("api-token.txt");
    expect(manifestText).not.toContain("A public repository description");
    expect(manifestText).not.toContain("do-not-index");
    expect(await readFile(join(root, ".empirical/context/index.md"), "utf8"))
      .toContain("compact file-backed context set");
  });

  test("refresh is byte-stable when current and preserves agent-maintained topic pages", async () => {
    const root = await temporaryRepository();
    await writeFile(join(root, "README.md"), "one\n", "utf8");
    await EmpiricalProject.initialize(root, { integrations: false });
    const manifestPath = join(root, ".empirical/context/manifest.json");
    const overviewPath = join(root, ".empirical/context/overview.md");
    const before = await readFile(manifestPath, "utf8");
    await writeFile(overviewPath, "# Project Overview\n\nMaintained evidence.\n", "utf8");

    expect((await refreshRepositoryKnowledge(root)).status).toBe("current");
    expect(await readFile(manifestPath, "utf8")).toBe(before);
    expect(await readFile(overviewPath, "utf8")).toContain("Maintained evidence");

    await writeFile(join(root, "README.md"), "two\n", "utf8");
    expect((await refreshRepositoryKnowledge(root)).status).toBe("refreshed");
    expect(await readFile(manifestPath, "utf8")).not.toBe(before);
    expect(await readFile(overviewPath, "utf8")).toContain("Maintained evidence");
  });

  test("Git-aware inventory excludes ignored files and enforces the file-count bound", async () => {
    const root = await temporaryRepository();
    const git = spawnSync("git", ["init", "-b", "main"], { cwd: root, encoding: "utf8", shell: false });
    expect(git.status).toBe(0);
    await writeFile(join(root, ".gitignore"), "ignored.txt\n", "utf8");
    await writeFile(join(root, "ignored.txt"), "not indexed\n", "utf8");
    const many = join(root, "many");
    await mkdir(many);
    await Promise.all(Array.from({ length: 1_205 }, (_, index) =>
      writeFile(join(many, `${String(index).padStart(4, "0")}.txt`), `${index}\n`, "utf8")
    ));

    await EmpiricalProject.initialize(root, { integrations: false });
    const report = await refreshRepositoryKnowledge(root);
    const manifest = JSON.parse(
      await readFile(join(root, ".empirical/context/manifest.json"), "utf8"),
    ) as RepositoryKnowledgeManifest;
    expect(report.truncated).toBe(true);
    expect(report.files).toBeLessThanOrEqual(1_200);
    expect(manifest.files.map((file) => file.path)).not.toContain("ignored.txt");
  });
});
