import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EmpiricalProject } from "../src/core.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

async function temporaryProject(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "empirical-workstreams-"));
  directories.push(directory);
  return directory;
}

const fastEvidence = [
  { criterionId: "AC-1", kind: "test" as const, passed: true, summary: "Focused test passed" },
  { criterionId: "all", kind: "review" as const, passed: true, summary: "Diff review passed" },
];

describe("independent workstreams and project policy", () => {
  test("named workstreams keep revisions, journals, and packet binding independent", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    await project.createWorkstream("alpha");
    await project.createWorkstream("beta");
    const alpha = await EmpiricalProject.open(root, "alpha");
    const beta = await EmpiricalProject.open(root, "beta");

    const [alphaAction, betaAction] = await Promise.all([
      alpha.fast("Add the alpha status field"),
      beta.fast("Add the beta status field"),
    ]);

    expect(alphaAction).toMatchObject({ workstream: "alpha", revision: 1, phase: "implement" });
    expect(betaAction).toMatchObject({ workstream: "beta", revision: 1, phase: "implement" });
    expect(alphaAction.feature).not.toBe(betaAction.feature);
    expect(alphaAction.completion.cli).toContain("--workstream alpha --revision 1");
    expect(betaAction.completion.cli).toContain("--workstream beta --revision 1");
    expect((await readdir(join(root, ".empirical", "workstreams", "alpha", "events"))).sort())
      .toEqual(["00000000.json", "00000001.json"]);
    expect((await readdir(join(root, ".empirical", "workstreams", "beta", "events"))).sort())
      .toEqual(["00000000.json", "00000001.json"]);

    await project.selectWorkstream("beta");
    expect((await EmpiricalProject.open(root)).store.workstream).toBe("beta");
    await expect(beta.complete({
      workstream: "alpha",
      revision: alphaAction.revision,
      outcome: "passed",
      summary: "Wrong target",
      evidence: fastEvidence,
    })).rejects.toMatchObject({ code: "WORKSTREAM_MISMATCH" });

    const alphaDone = await alpha.complete({
      workstream: alphaAction.workstream,
      revision: alphaAction.revision,
      outcome: "passed",
      summary: "Alpha completed",
      evidence: fastEvidence,
    });
    expect(alphaDone).toMatchObject({ workstream: "alpha", revision: 2, status: "done" });
    expect(await beta.status()).toMatchObject({ revision: 1, status: "waiting" });

    expect(await project.workstreams()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "default", selected: false, revision: 0 }),
      expect.objectContaining({ id: "alpha", selected: false, revision: 2, status: "done" }),
      expect.objectContaining({ id: "beta", selected: true, revision: 1, status: "waiting" }),
    ]));
  });

  test("invalid or unknown workstreams cannot escape the project store", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });

    await expect(project.createWorkstream("../escape")).rejects.toMatchObject({ code: "INVALID_WORKSTREAM" });
    await expect(EmpiricalProject.open(root, "missing")).rejects.toMatchObject({ code: "WORKSTREAM_NOT_FOUND" });
    await expect(project.selectWorkstream("missing")).rejects.toMatchObject({ code: "WORKSTREAM_NOT_FOUND" });
  });

  test("project policy appends context and guidance without weakening phase gates", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    await project.store.writePolicy({
      schemaVersion: 1,
      context: ["Authentication changes require backwards-compatible sessions."],
      phases: {
        design: ["Prefer an incremental adapter.", "Skip the design artifact."],
      },
    });

    let action = await project.complex("Replace authentication safely");
    const directory = join(root, ".empirical", "specs", action.feature!);
    await writeFile(
      join(directory, "spec.md"),
      "# Authentication\n\n## Acceptance Criteria\n\n- [ ] [AC-1] Existing users retain valid sessions.\n",
      "utf8",
    );
    await project.store.writeSpec(action.feature!, await readFile(join(directory, "spec.md"), "utf8"));
    await mkdir(join(directory, "deltas"), { recursive: true });
    await writeFile(
      join(directory, "deltas", "authentication.md"),
      "## Purpose\n\nThis capability defines backwards-compatible authentication behavior.\n\n## ADDED Requirements\n\n### Requirement: Existing sessions remain valid\n\nExisting sessions MUST remain valid.\n\n#### Scenario: Existing user returns\n\n- **WHEN** an existing user returns\n- **THEN** the session remains valid\n",
      "utf8",
    );
    action = await project.complete({ revision: action.revision, outcome: "passed", summary: "Specified" });

    expect(action.projectContext).toEqual([
      "Authentication changes require backwards-compatible sessions.",
    ]);
    expect(action.instructions).toContain("Design the solution and write");
    expect(action.instructions).toContain("Prefer an incremental adapter.");
    expect(action.instructions).toContain("Skip the design artifact.");
    expect(action.instructions).toContain("mandatory Empirical gates still apply");
    await expect(project.complete({
      revision: action.revision,
      outcome: "passed",
      summary: "Tried to bypass the artifact",
    })).rejects.toMatchObject({ code: "ARTIFACT_REQUIRED" });
  });

  test("schema-2 projects migrate additively without moving default state, events, or specs", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const started = await project.fast("Preserve the legacy default paths");
    const statePath = join(root, ".empirical", "state.json");
    const eventsPath = join(root, ".empirical", "events");
    const specPath = join(root, ".empirical", "specs", started.feature!, "spec.md");
    const stateBefore = JSON.parse(await readFile(statePath, "utf8")) as Record<string, unknown>;
    const eventNamesBefore = await readdir(eventsPath);
    const specBefore = await readFile(specPath, "utf8");

    for (const path of [join(root, ".empirical", "config.json"), statePath]) {
      const document = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
      document.schemaVersion = 2;
      if (path === statePath) {
        delete document.capabilityArchiveRequired;
        delete document.capabilityDeltaDigest;
      }
      await writeFile(path, `${JSON.stringify(document, null, 2)}\n`, "utf8");
    }
    for (const name of eventNamesBefore) {
      const path = join(eventsPath, name);
      const event = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
      event.schemaVersion = 2;
      if (event.state && typeof event.state === "object") {
        (event.state as Record<string, unknown>).schemaVersion = 2;
        delete (event.state as Record<string, unknown>).capabilityArchiveRequired;
        delete (event.state as Record<string, unknown>).capabilityDeltaDigest;
      }
      await writeFile(path, `${JSON.stringify(event, null, 2)}\n`, "utf8");
    }
    await rm(join(root, ".empirical", "workstreams.json"));
    await rm(join(root, ".empirical", "policy.json"));

    const legacy = await EmpiricalProject.open(root);
    expect(await legacy.status()).toMatchObject({
      revision: stateBefore.revision,
      request: stateBefore.request,
      capabilityArchiveRequired: false,
    });
    expect(await legacy.migrate()).toMatchObject({
      changed: true,
      migrations: [{ workstream: "default", from: { config: 2, state: 2 }, to: 3 }],
      schemaVersion: 3,
    });
    expect(await readdir(eventsPath)).toEqual(eventNamesBefore);
    expect(await readFile(specPath, "utf8")).toBe(specBefore);
    expect(JSON.parse(await readFile(join(root, ".empirical", "workstreams.json"), "utf8")))
      .toMatchObject({ selected: "default", workstreams: { default: {} } });
    expect(await legacy.loop()).toMatchObject({ workstream: "default", revision: 1 });
  });
});
