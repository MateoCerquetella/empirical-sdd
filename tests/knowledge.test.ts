import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EmpiricalProject } from "../src/core.js";
import {
  freshRepositoryKnowledgePaths,
  inspectRepositoryKnowledge,
  refreshRepositoryKnowledge,
} from "../src/knowledge.js";
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

const topicPages = ["overview", "architecture", "commands", "conventions"] as const;

async function refineTopicPages(root: string): Promise<void> {
  await Promise.all(topicPages.map((page) =>
    writeFile(
      join(root, ".empirical", "context", `${page}.md`),
      `# ${page[0]!.toUpperCase()}${page.slice(1)}\n\nEvidence-backed ${page} context.\n`,
      "utf8",
    )
  ));
  const report = await refreshRepositoryKnowledge(root);
  expect(report.refinementRequired).toEqual([]);
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

    expect(report.status).toBe("stale");
    expect(report.context).toEqual([".empirical/context/index.md"]);
    expect(report.refinementRequired).toEqual(topicPages.map(
      (page) => `.empirical/context/${page}.md`,
    ));
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
    await refineTopicPages(root);
    const manifestPath = join(root, ".empirical/context/manifest.json");
    const overviewPath = join(root, ".empirical/context/overview.md");
    const before = await readFile(manifestPath, "utf8");
    await writeFile(overviewPath, "# Project Overview\n\nMaintained evidence.\n", "utf8");

    expect((await refreshRepositoryKnowledge(root)).status).toBe("refreshed");
    expect(await readFile(manifestPath, "utf8")).not.toBe(before);
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

  test("Manifest v2 marks only source-dependent pages stale before explicit refresh", async () => {
    const root = await temporaryRepository();
    await writeFile(join(root, "README.md"), "overview\n", "utf8");
    await writeFile(
      join(root, "package.json"),
      '{"scripts":{"test":"bun test"}}\n',
      "utf8",
    );
    await writeFile(join(root, "CONTRIBUTING.md"), "Conventions stay stable.\n", "utf8");
    await EmpiricalProject.initialize(root, { integrations: false });
    await refineTopicPages(root);
    const current = await inspectRepositoryKnowledge(root);
    expect(current.valid).toBe(true);
    expect(current.fresh).toEqual(expect.arrayContaining([
      ".empirical/context/index.md",
      ".empirical/context/commands.md",
      ".empirical/context/conventions.md",
    ]));

    await writeFile(
      join(root, "package.json"),
      '{"scripts":{"test":"bun test","ci":"bun run check && bun test"}}\n',
      "utf8",
    );
    const stale = await inspectRepositoryKnowledge(root);
    expect(stale.stale).toEqual(expect.arrayContaining([
      ".empirical/context/index.md",
      ".empirical/context/overview.md",
      ".empirical/context/architecture.md",
      ".empirical/context/commands.md",
    ]));
    expect(stale.stale).not.toContain(".empirical/context/conventions.md");
    expect(await freshRepositoryKnowledgePaths(root)).not.toContain(
      ".empirical/context/commands.md",
    );
    expect((await refreshRepositoryKnowledge(root)).status).toBe("refreshed");
    expect((await inspectRepositoryKnowledge(root)).valid).toBe(true);
  });

  test("empty initialization becomes refinement-required after source is added and converges after agent refinement", async () => {
    const root = await temporaryRepository();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    expect((await project.context()).refinementRequired).toEqual([]);

    await writeFile(join(root, "index.html"), "<!doctype html><title>Example</title>\n", "utf8");
    const refreshed = await project.context();
    expect(refreshed.status).toBe("stale");
    expect(refreshed.context).toEqual([".empirical/context/index.md"]);
    expect(refreshed.refinementRequired).toHaveLength(4);
    expect(await freshRepositoryKnowledgePaths(root)).toEqual([".empirical/context/index.md"]);

    await refineTopicPages(root);
    const current = await project.context();
    expect(current.status).toBe("current");
    expect(current.refinementRequired).toEqual([]);
    expect(current.context).toHaveLength(5);
    expect((await inspectRepositoryKnowledge(root)).valid).toBe(true);
  });

  test("Manifest v2 excludes reserved migration stages and backups from source fingerprints", async () => {
    const root = await temporaryRepository();
    await writeFile(join(root, "README.md"), "overview\n", "utf8");
    await EmpiricalProject.initialize(root, { integrations: false });
    const before = await inspectRepositoryKnowledge(root);
    const stage = join(root, ".empirical.schema5-stage-aborted");
    const reserved = join(root, ".empirical.schema5-aborted-metadata");
    const backup = join(root, ".empirical.schema4-backup-aborted");
    await mkdir(stage);
    await mkdir(reserved);
    await mkdir(backup);
    await writeFile(join(stage, "README.md"), "stale duplicate\n", "utf8");
    await writeFile(join(reserved, "transaction.json"), "stale metadata\n", "utf8");
    await writeFile(join(backup, "README.md"), "stale backup\n", "utf8");
    const afterScratch = await inspectRepositoryKnowledge(root);
    expect(afterScratch.files).toEqual(before.files);
    expect(afterScratch.stale).toEqual([]);
    const nested = join(root, "ordinary", ".empirical.schema5-user");
    await mkdir(nested, { recursive: true });
    await writeFile(join(nested, "source.ts"), "nested ordinary source\n", "utf8");
    expect((await inspectRepositoryKnowledge(root)).files.map((file) => file.path)).toContain(
      "ordinary/.empirical.schema5-user/source.ts",
    );
    await writeFile(join(root, "README.md"), "ordinary source change\n", "utf8");
    expect((await inspectRepositoryKnowledge(root)).files).not.toEqual(before.files);
  });

  test("Manifest v2 detects page and manifest tampering deterministically", async () => {
    const root = await temporaryRepository();
    await writeFile(join(root, "README.md"), "overview\n", "utf8");
    await EmpiricalProject.initialize(root, { integrations: false });
    await writeFile(
      join(root, ".empirical", "context", "commands.md"),
      "<!-- empirical-sdd:managed-context-v2 -->\n# Commands\n\nTampered.\n",
      "utf8",
    );
    expect((await inspectRepositoryKnowledge(root)).stale).toContain(
      ".empirical/context/commands.md",
    );
    const manifestPath = join(root, ".empirical", "context", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    await writeFile(
      manifestPath,
      `${JSON.stringify({ ...manifest, generator: "edited" }, null, 2)}\n`,
      "utf8",
    );
    expect((await inspectRepositoryKnowledge(root)).issues[0]).toContain("digest check");
  });
});
