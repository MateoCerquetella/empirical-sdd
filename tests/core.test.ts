import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EmpiricalProject } from "../src/core.js";
import { parseCriteria } from "../src/core.js";
import { EmpiricalError } from "../src/errors.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryProject(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "empirical-core-"));
  directories.push(directory);
  return directory;
}

describe("Empirical core", () => {
  test("template examples inside HTML comments are not acceptance criteria", () => {
    expect(parseCriteria("<!--\n- [ ] [AC-1] Example only.\n-->\n")).toEqual([]);
  });

  test("one init installs portable state, instructions, and project MCP discovery", async () => {
    const root = await temporaryProject();
    await writeFile(join(root, "AGENTS.md"), "# Existing guidance\n", "utf8");
    await writeFile(
      join(root, ".mcp.json"),
      JSON.stringify({ mcpServers: { existing: { command: "existing-server" } } }),
      "utf8",
    );

    const result = await EmpiricalProject.initialize(root);

    expect(result.state.phase).toBe("idle");
    expect(await readFile(join(root, "AGENTS.md"), "utf8")).toContain("Existing guidance");
    expect(await readFile(join(root, "AGENTS.md"), "utf8")).toContain("empirical next --json");
    expect(await readFile(join(root, "CLAUDE.md"), "utf8")).toContain("Empirical SDD");
    expect(await readFile(join(root, "GEMINI.md"), "utf8")).toContain("Empirical SDD");
    expect(JSON.parse(await readFile(join(root, ".mcp.json"), "utf8")).mcpServers.empirical)
      .toEqual({ command: "empirical", args: ["mcp"] });
    expect(JSON.parse(await readFile(join(root, ".mcp.json"), "utf8")).mcpServers.existing)
      .toEqual({ command: "existing-server" });
    expect(JSON.parse(await readFile(join(root, ".cursor/mcp.json"), "utf8")).mcpServers.empirical)
      .toBeDefined();
    expect(JSON.parse(await readFile(join(root, ".gemini/settings.json"), "utf8")).mcpServers.empirical)
      .toBeDefined();
    expect(await readFile(join(root, ".codex/config.toml"), "utf8")).toContain("[mcp_servers.empirical]");

    const second = await EmpiricalProject.initialize(root);
    expect(second.state.revision).toBe(0);
    expect((await readFile(join(root, "AGENTS.md"), "utf8")).match(/empirical-sdd:start/g)).toHaveLength(1);
  });

  test("Quick runs shape through evidenced verification and review", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    let action = await project.start("Add a dark mode toggle");
    expect(action.phase).toBe("shape");
    expect(action.revision).toBe(1);

    const specPath = join(root, ".empirical/specs", action.feature!, "spec.md");
    await writeFile(
      specPath,
      `# Dark mode\n\n## Acceptance Criteria\n\n- [ ] [AC-1] The preference survives reload.\n- [ ] [AC-UI-1] [UI] A theme toggle is visible.\n`,
      "utf8",
    );
    action = await project.complete({ revision: 1, outcome: "passed", summary: "Criteria shaped" });
    expect(action.phase).toBe("implement");
    action = await project.complete({ revision: 2, outcome: "passed", summary: "Implemented", actor: "builder" });
    expect(action.phase).toBe("verify");

    await expect(project.complete({ revision: 3, outcome: "passed", summary: "Looks good" }))
      .rejects.toMatchObject({ code: "EVIDENCE_REQUIRED" });

    const verification = {
      revision: 3,
      outcome: "passed" as const,
      summary: "Tests and browser checks passed",
      evidence: [
        { criterionId: "AC-1", kind: "test", passed: true, summary: "Preference test passed" },
        { criterionId: "AC-UI-1", kind: "browser", passed: true, summary: "Toggle worked" },
        {
          criterionId: "AC-UI-1",
          kind: "screenshot",
          passed: true,
          summary: "Dark theme rendered",
          artifact: ".empirical/specs/001-add-a-dark-mode-toggle/dark.png",
        },
      ],
    };
    await expect(project.complete(verification))
      .rejects.toMatchObject({ code: "EVIDENCE_REQUIRED" });

    await writeFile(
      join(root, ".empirical/specs/001-add-a-dark-mode-toggle/dark.png"),
      "screenshot fixture",
      "utf8",
    );

    action = await project.complete(verification);
    expect(action.phase).toBe("review");

    action = await project.complete({
      revision: 4,
      outcome: "passed",
      summary: "Review passed",
      actor: "reviewer",
      evidence: [
        { criterionId: "all", kind: "review", passed: true, summary: "No blocking findings" },
      ],
    });
    expect(action.phase).toBe("done");
    expect(action.status).toBe("done");
    expect((await project.verify()).valid).toBe(true);

    await rm(join(root, ".empirical/specs/001-add-a-dark-mode-toggle/dark.png"));
    expect(await project.verify()).toMatchObject({
      valid: false,
      missing: ["Screenshot artifact does not exist: .empirical/specs/001-add-a-dark-mode-toggle/dark.png"],
    });
  });

  test("init preserves an incompatible MCP configuration shape", async () => {
    const root = await temporaryProject();
    const path = join(root, ".mcp.json");
    await writeFile(path, JSON.stringify({ mcpServers: "managed elsewhere" }), "utf8");

    const result = await EmpiricalProject.initialize(root);

    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ mcpServers: "managed elsewhere" });
    expect(result.integrations.preserved).toContain(".mcp.json (invalid mcpServers value)");
  });

  test("Strong requires design and plan artifacts", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, {
      profile: "strong",
      integrations: false,
    });
    let action = await project.start("Replace authentication", { profile: "strong" });
    const directory = join(root, ".empirical/specs", action.feature!);
    await writeFile(
      join(directory, "spec.md"),
      "# Auth\n\n## Acceptance Criteria\n- [ ] [AC-1] Existing users can sign in.\n",
      "utf8",
    );
    action = await project.complete({ revision: 1, outcome: "passed", summary: "Specified" });
    expect(action.phase).toBe("design");
    await expect(project.complete({ revision: 2, outcome: "passed", summary: "Designed" }))
      .rejects.toMatchObject({ code: "ARTIFACT_REQUIRED" });
    await writeFile(join(directory, "design.md"), "# Design\nUse sessions.\n", "utf8");
    action = await project.complete({ revision: 2, outcome: "passed", summary: "Designed" });
    expect(action.phase).toBe("plan");
    await writeFile(join(directory, "plan.md"), "# Plan\n1. Implement sessions.\n", "utf8");
    action = await project.complete({ revision: 3, outcome: "passed", summary: "Planned" });
    expect(action.phase).toBe("implement");
  });

  test("stale clients cannot overwrite newer state", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const action = await project.start("Add export");
    await writeFile(
      join(root, ".empirical/specs", action.feature!, "spec.md"),
      "# Export\n\n## Acceptance Criteria\n- [ ] [AC-1] A report can be exported.\n",
      "utf8",
    );
    await project.complete({ revision: 1, outcome: "passed", summary: "Shaped" });
    await expect(project.complete({ revision: 1, outcome: "passed", summary: "Stale" }))
      .rejects.toBeInstanceOf(EmpiricalError);
  });

  test("untrusted JSON completion input cannot bypass outcome or artifact validation", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    await project.start("Add export");
    await expect(project.complete({
      revision: 1,
      outcome: "invented" as "passed",
      summary: "Bypass",
    })).rejects.toMatchObject({ code: "INVALID_OUTCOME" });
    await expect(project.complete({
      revision: 1,
      outcome: "failed",
      summary: "Failure",
      evidence: [{
        criterionId: "AC-1",
        kind: "test",
        passed: true,
        summary: "Unsafe artifact",
        artifact: "../outside.txt",
      }],
    })).rejects.toMatchObject({ code: "INVALID_EVIDENCE" });
  });

  test("v1 adoption preserves ai and copies the active spec", async () => {
    const root = await temporaryProject();
    await mkdir(join(root, "ai/specs/007-existing"), { recursive: true });
    await writeFile(join(root, "ai/STATE.md"), "current_spec: 007-existing\ncurrent_phase: developer\n");
    await writeFile(
      join(root, "ai/specs/007-existing/spec.md"),
      "# Existing\n\n## Acceptance Criteria\n- [ ] [AC-1] It works.\n",
    );

    const { state } = await EmpiricalProject.adopt(root, { integrations: false });
    expect(state.activeFeature).toBe("007-existing");
    expect(state.phase).toBe("implement");
    expect(await readFile(join(root, "ai/STATE.md"), "utf8")).toContain("current_spec");
    expect(await readFile(join(root, ".empirical/specs/007-existing/spec.md"), "utf8"))
      .toContain("AC-1");
  });
});
