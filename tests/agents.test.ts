import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildHandoffOption, detectSupportedAgents } from "../src/agents.js";
import { EmpiricalProject } from "../src/core.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryDirectory(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  directories.push(root);
  return root;
}

async function executable(directory: string, name: string): Promise<string> {
  const windows = process.platform === "win32";
  const path = join(directory, windows ? `${name}.CMD` : name);
  await writeFile(path, windows ? "@exit /b 99\r\n" : "#!/bin/sh\nexit 99\n", "utf8");
  if (!windows) await chmod(path, 0o755);
  return path;
}

async function specifyComplexFeature(root: string): Promise<EmpiricalProject> {
  const { project } = await EmpiricalProject.initialize(root, { integrations: false });
  const action = await project.complex("Add approved agent continuation");
  const directory = join(root, ".empirical/specs", action.feature!);
  await writeFile(
    join(directory, "spec.md"),
    "# Handoff\n\n## Acceptance Criteria\n\n- [ ] [AC-1] The approved agent can continue.\n",
    "utf8",
  );
  await writeFile(join(directory, "impact.json"), `${JSON.stringify({
    schemaVersion: 1,
    classification: "non-behavioral",
    capabilities: [],
    surfaces: ["agent-handoff-test"],
    regressionRationale: "The fixture exercises authorization without changing product behavior.",
  }, null, 2)}\n`, "utf8");
  await project.complete({ revision: 1, outcome: "passed", summary: "Specified" });
  return project;
}

describe("agent detection and handoff", () => {
  test("handoff is unavailable until a Complex specification has passed", async () => {
    const root = await temporaryDirectory("empirical-agent-handoff-gate-");
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    await project.complex("Design a gated continuation");
    await expect(project.handoff()).rejects.toMatchObject({ code: "HANDOFF_NOT_READY" });
  });

  test("detection distinguishes prompt and workspace launch capabilities", async () => {
    const root = await temporaryDirectory("empirical-agent-detection-");
    const bin = join(root, "bin");
    await mkdir(bin);
    const codex = await executable(bin, "codex");
    const cursor = await executable(bin, "cursor");

    const detected = await detectSupportedAgents({
      homeRoot: root,
      pathValue: bin,
      includeConfigured: false,
    });
    expect(detected).toEqual([
      { id: "codex", agent: "Codex", executable: codex, capability: "prompt" },
      { id: "cursor", agent: "Cursor", executable: cursor, capability: "workspace" },
    ]);

    const prompt = buildHandoffOption({
      root,
      feature: "feature-a",
      specification: join(root, "spec.md"),
      specDigest: "digest",
      agent: detected[0]!,
    });
    const workspace = buildHandoffOption({
      root,
      feature: "feature-a",
      specification: join(root, "spec.md"),
      specDigest: "digest",
      agent: detected[1]!,
    });
    expect(prompt.argv[0]).toBe(codex);
    expect(prompt.argv[1]).toContain("Resume the active Empirical feature feature-a");
    expect(workspace.argv).toEqual([cursor, root]);
  });

  test("handoff only authorizes an unchanged option after explicit approval and never launches it", async () => {
    const root = await temporaryDirectory("empirical-agent-handoff-");
    const bin = join(root, "bin");
    await mkdir(bin);
    await executable(bin, "codex");
    const launchMarker = join(root, "launched");
    const originalPath = process.env.PATH;
    process.env.PATH = bin;
    try {
      const project = await specifyComplexFeature(root);
      const offer = await project.handoff();
      expect(offer.choices).toEqual(["current", "save", "agent"]);
      expect(offer.agents).toHaveLength(1);
      await expect(project.authorizeHandoff("codex", offer.agents[0]!.approvalToken, false))
        .rejects.toMatchObject({ code: "HANDOFF_APPROVAL_REQUIRED" });

      const authorized = await project.authorizeHandoff("codex", offer.agents[0]!.approvalToken, true);
      expect(authorized.argv).toEqual(offer.agents[0]!.argv);
      expect(await Bun.file(launchMarker).exists()).toBe(false);

      await writeFile(offer.specification, "# Changed after proposal\n", "utf8");
      await expect(project.authorizeHandoff("codex", offer.agents[0]!.approvalToken, true))
        .rejects.toMatchObject({ code: "STALE_HANDOFF_PROPOSAL" });
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
    }
  });
});
