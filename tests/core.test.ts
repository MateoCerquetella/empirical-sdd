import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EmpiricalProject, parseCriteria } from "../src/core.js";
import { parseDecisions } from "../src/decisions.js";
import { SCHEMA_VERSION, PRODUCT_VERSION, type ActionPacket, type WorkflowState } from "../src/types.js";

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

async function temporaryProject(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "empirical-core-"));
  directories.push(directory);
  return directory;
}

function action(value: Awaited<ReturnType<EmpiricalProject["fast"]>>): ActionPacket {
  if (value.kind !== "action") throw new Error("Expected action packet");
  return value;
}

async function acceptedDecisions(root: string, feature: string): Promise<void> {
  await writeFile(join(root, ".empirical/specs", feature, "decisions.md"), `# Decisions

## D-001: Keep the implementation local

Status: Accepted

### Evidence

- The existing module owns this behavior.

### Options

1. Change the module.
2. Add a second subsystem.

### Chosen approach

Change the existing module and preserve its public boundary.

### Trade-offs and risks

The module grows slightly; focused regression coverage mitigates the risk.

### Verification

Run the focused behavior test and review the public diff.
`, "utf8");
}

async function addedDelta(root: string, feature: string): Promise<void> {
  const directory = join(root, ".empirical/specs", feature, "deltas");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "example.md"), `## Purpose

This capability describes an observable example behavior for users.

## ADDED Requirements

### Requirement: Example behavior

The product MUST expose the example behavior.

#### Scenario: Successful use

- **WHEN** a user invokes it
- **THEN** the example result is returned
`, "utf8");
}

describe("Empirical 0.20 core", () => {
  test("exports the alpha product and schema versions", () => {
    expect(PRODUCT_VERSION).toBe("0.20.1");
    expect(SCHEMA_VERSION).toBe(4);
  });

  test("parses wrapped criteria but ignores commented examples", () => {
    expect(parseCriteria("<!--\n- [ ] [AC-X] Example only\n-->\n")).toEqual([]);
    expect(parseCriteria("- [ ] [AC-1] The result is returned\n  without losing context.\n"))
      .toEqual([{ id: "AC-1", text: "The result is returned without losing context.", ui: false, checked: false }]);
  });

  test("init creates schema-4 configuration without root workflow state", async () => {
    const root = await temporaryProject();
    const initialized = await EmpiricalProject.initialize(root, { integrations: false, setupComplete: true });
    expect(initialized.state).toMatchObject({ phase: "idle", revision: 0, activeFeature: null });
    expect(await initialized.project.config()).toMatchObject({
      schemaVersion: 4,
      isolation: { mode: "ask", baseBranch: "auto", worktreePath: "../{repo}-{feature}", branchPattern: "{type}/{feature}" },
      decisions: { complexRecords: "required" },
      setupComplete: true,
    });
    expect(await stat(join(root, ".empirical/state.json")).then(() => true, () => false)).toBe(false);
  });

  test("configuration is durable and validates templates", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const configured = await project.configure({
      isolation: { mode: "off", baseBranch: "main", worktreePath: "../sandbox-{feature}", branchPattern: "{type}/alpha-{feature}" },
      decisions: { complexRecords: "off" },
    });
    expect((await EmpiricalProject.open(root)).config()).resolves.toEqual(configured);
    await expect(project.configure({ isolation: { worktreePath: "../fixed" } }))
      .rejects.toMatchObject({ code: "INVALID_CONFIG" });
  });

  test("Fast owns its state, journal, lock boundary, spec, and evidence under the feature", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const started = action(await project.fast("Add a deterministic hello command"));
    expect(started).toMatchObject({ kind: "action", feature: "add-a-deterministic-hello-command", phase: "implement", revision: 1 });
    expect(started.completion.cli).not.toContain("workstream");
    const directory = join(root, ".empirical/specs", started.feature!);
    expect((await readdir(directory)).sort()).toEqual(["events", "spec.md", "state.json"]);
    expect(await readdir(join(directory, "events"))).toEqual(["00000001.json"]);
    const done = await project.complete({
      revision: 1,
      outcome: "passed",
      summary: "Implemented and reviewed",
      evidence: [
        { criterionId: "AC-1", kind: "test", passed: true, summary: "Focused test passed" },
        { criterionId: "all", kind: "review", passed: true, summary: "Diff reviewed" },
      ],
    });
    expect(done).toMatchObject({ phase: "done", status: "done", revision: 2 });
    expect(await readdir(join(directory, "events"))).toEqual(["00000001.json", "00000002.json"]);
  });

  test("descriptive feature collisions are explicit", async () => {
    const root = await temporaryProject();
    let project = (await EmpiricalProject.initialize(root, { integrations: false })).project;
    const first = action(await project.fast("Add hello"));
    await project.complete({
      revision: first.revision, outcome: "passed", summary: "Done",
      evidence: [
        { criterionId: "AC-1", kind: "test", passed: true, summary: "Passed" },
        { criterionId: "all", kind: "review", passed: true, summary: "Reviewed" },
      ],
    });
    project = await EmpiricalProject.open(root);
    await expect(project.fast("Add hello")).rejects.toMatchObject({ code: "FEATURE_EXISTS" });
  });

  test("Complex creates a decision record and blocks Design until it is accepted and complete", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    let current = action(await project.complex("Add a durable example capability"));
    expect(current.artifacts).toContain(`.empirical/specs/${current.feature}/deltas/<capability>.md`);
    const feature = current.feature!;
    const specPath = join(root, ".empirical/specs", feature, "spec.md");
    await writeFile(specPath, `# Example\n\n## Acceptance Criteria\n\n- [ ] [AC-1] The example is observable.\n`, "utf8");
    await addedDelta(root, feature);
    current = await project.complete({ revision: 1, outcome: "passed", summary: "Specified" });
    expect(current.phase).toBe("design");
    await writeFile(join(root, ".empirical/specs", feature, "design.md"), "# Design\n\nKeep ownership local.\n", "utf8");
    await expect(project.complete({ revision: 2, outcome: "passed", summary: "Designed" }))
      .rejects.toMatchObject({ code: "DECISIONS_REQUIRED" });
    await acceptedDecisions(root, feature);
    current = await project.complete({ revision: 2, outcome: "passed", summary: "Designed with accepted evidence" });
    expect(current).toMatchObject({ phase: "plan", revision: 3 });
  });

  test("decision validation rejects private-reasoning sections and broken supersession", () => {
    const report = parseDecisions(`## D-001: Unsafe trace\n\nStatus: Superseded\n\n### Chain of thought\nsecret\n\n### Evidence\nfact\n\n### Options\na or b\n\n### Chosen approach\na\n\n### Trade-offs and risks\nrisk\n\n### Verification\ntest\n`);
    expect(report.valid).toBe(false);
    expect(report.issues.join(" ")).toContain("hidden-reasoning");
    expect(report.issues.join(" ")).toContain("Superseded by");
  });

  test("Explain is read-only and reports rationale, gates, context, and accepted decisions", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const started = action(await project.complex("Explain an active decision"));
    await acceptedDecisions(root, started.feature!);
    const statePath = join(root, ".empirical/specs", started.feature!, "state.json");
    const before = await readFile(statePath, "utf8");
    const report = await project.explain();
    expect(report).toMatchObject({ feature: started.feature, phase: "specify", rationale: { gate: "proceed" } });
    expect(report.rationale.reason).toContain("state machine");
    expect(report.rationale.requiredContext).toContain(`.empirical/specs/${started.feature}/spec.md`);
    expect(report.rationale.missingContext).not.toContain(`.empirical/specs/${started.feature}/spec.md`);
    expect(report.rationale.missingContext).toContain(`.empirical/specs/${started.feature}/deltas/<capability>.md`);
    expect(report.decisions[0]).toMatchObject({ id: "D-001", status: "Accepted" });
    expect(await readFile(statePath, "utf8")).toBe(before);
  });

  test("read-only open observes a newer journal event without repairing its state projection", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const started = action(await project.fast("Observe interrupted state read-only"));
    const directory = join(root, ".empirical/specs", started.feature!);
    const statePath = join(directory, "state.json");
    const before = await readFile(statePath, "utf8");
    const recovered = {
      ...(JSON.parse(before) as WorkflowState),
      revision: 2,
      message: "Journal committed before projection",
      updatedAt: new Date().toISOString(),
    };
    await writeFile(join(directory, "events/00000002.json"), `${JSON.stringify({
      schemaVersion: 4, revision: 2, previousRevision: 1, actor: "fixture",
      summary: "Interrupted projection", createdAt: recovered.updatedAt, state: recovered,
    })}\n`, "utf8");

    const report = await (await EmpiricalProject.openReadOnly(root)).explain();
    expect(report).toMatchObject({ feature: started.feature, revision: 2 });
    expect(await readFile(statePath, "utf8")).toBe(before);
  });

  test("read-only open refuses legacy root state without migrating it", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const legacy = {
      ...(await project.status()), schemaVersion: 3, revision: 3,
      activeFeature: null, phase: "done", status: "done",
    };
    const statePath = join(root, ".empirical/state.json");
    await writeFile(statePath, `${JSON.stringify(legacy)}\n`, "utf8");
    await expect(EmpiricalProject.openReadOnly(root)).rejects.toMatchObject({ code: "MIGRATION_REQUIRED" });
    expect(await readFile(statePath, "utf8")).toContain('"schemaVersion":3');
  });

  test("exact revisions and evidence gates remain enforced", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const started = action(await project.fast("Add one checked result"));
    await expect(project.complete({ revision: 0, outcome: "passed", summary: "stale" }))
      .rejects.toMatchObject({ code: "STALE_REVISION" });
    await expect(project.complete({ revision: 1, outcome: "passed", summary: "missing evidence" }))
      .rejects.toMatchObject({ code: "EVIDENCE_REQUIRED" });
    expect((await project.status()).revision).toBe(started.revision);
  });

  test("concurrent identical starters converge on one feature and journal", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const values = await Promise.all(Array.from({ length: 8 }, () => project.fast("Add one concurrent output")));
    for (const value of values) expect(value).toEqual(values[0]);
    const started = action(values[0]!);
    expect(await readdir(join(root, ".empirical/specs"))).toEqual([started.feature!]);
    expect(await readdir(join(root, ".empirical/specs", started.feature!, "events"))).toEqual(["00000001.json"]);
  });

  for (const schemaVersion of [1, 2, 3] as const) {
    test(`schema-${schemaVersion} default root state migrates into its feature`, async () => {
      const root = await temporaryProject();
      const initialized = await EmpiricalProject.initialize(root, { integrations: false });
      const feature = `legacy-schema-${schemaVersion}`;
      await initialized.project.store.writeSpec(feature, `# Legacy\n\n## Acceptance Criteria\n\n- [ ] [AC-1] Legacy state resumes.\n`);
      const state: WorkflowState = {
        ...(await initialized.project.status()),
        schemaVersion: SCHEMA_VERSION,
        revision: 1,
        activeFeature: feature,
        request: "Resume legacy state",
        profile: "fast",
        phase: "implement",
        status: "waiting",
        updatedAt: new Date().toISOString(),
      };
      const persisted = { ...state, schemaVersion } as unknown as Record<string, unknown>;
      if (schemaVersion < 3) {
        delete persisted.capabilityArchiveRequired;
        delete persisted.capabilityDeltaDigest;
      }
      await writeFile(join(root, ".empirical/state.json"), `${JSON.stringify(persisted)}\n`, "utf8");
      await mkdir(join(root, ".empirical/events"), { recursive: true });
      await writeFile(join(root, ".empirical/events/00000001.json"), `${JSON.stringify({
        schemaVersion, revision: 1, previousRevision: 0, actor: "legacy", summary: "Legacy event", createdAt: state.updatedAt, state: persisted,
      })}\n`, "utf8");
      const project = await EmpiricalProject.open(root);
      expect(await project.status()).toMatchObject({ schemaVersion: 4, activeFeature: feature, revision: 1 });
      expect(JSON.parse(await readFile(join(root, ".empirical/specs", feature, "state.json"), "utf8"))).toMatchObject({ schemaVersion: 4 });
      expect(await stat(join(root, ".empirical/state.json")).then(() => true, () => false)).toBe(false);
      expect(await readdir(join(root, ".empirical/specs", feature, "events"))).toEqual(["00000001.json"]);
    });
  }

  test("migration preserves root history when the referenced specification is missing", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const state = {
      ...(await project.status()), schemaVersion: 3, revision: 1,
      activeFeature: "missing-contract", request: "Resume missing contract",
      profile: "fast", phase: "implement", status: "waiting",
    };
    const statePath = join(root, ".empirical/state.json");
    const eventPath = join(root, ".empirical/events/00000001.json");
    await writeFile(statePath, `${JSON.stringify(state)}\n`, "utf8");
    await mkdir(join(root, ".empirical/events"), { recursive: true });
    await writeFile(eventPath, `${JSON.stringify({
      schemaVersion: 3, revision: 1, previousRevision: 0, actor: "legacy",
      summary: "Legacy", createdAt: state.updatedAt, state,
    })}\n`, "utf8");
    await expect(EmpiricalProject.open(root)).rejects.toMatchObject({ code: "MIGRATION_CONFLICT" });
    expect(await readFile(statePath, "utf8")).toContain("missing-contract");
    expect(await readFile(eventPath, "utf8")).toContain("Legacy");
  });

  test("an interrupted migration fills missing events before removing root history", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const feature = "interrupted-migration";
    await project.store.writeSpec(feature, "# Interrupted migration\n");
    const state = {
      ...(await project.status()), schemaVersion: 3, revision: 1,
      activeFeature: feature, request: "Resume interrupted migration",
      profile: "fast", phase: "implement", status: "waiting",
    };
    await writeFile(join(root, ".empirical/state.json"), `${JSON.stringify(state)}\n`, "utf8");
    await mkdir(join(root, ".empirical/events"), { recursive: true });
    await writeFile(join(root, ".empirical/events/00000001.json"), `${JSON.stringify({
      schemaVersion: 3, revision: 1, previousRevision: 0, actor: "legacy",
      summary: "Legacy", createdAt: state.updatedAt, state,
    })}\n`, "utf8");
    const featureDirectory = join(root, ".empirical/specs", feature);
    await writeFile(join(featureDirectory, "state.json"), `${JSON.stringify({ ...state, schemaVersion: 4 })}\n`, "utf8");

    const reopened = await EmpiricalProject.open(root);
    expect(await reopened.status()).toMatchObject({ activeFeature: feature, revision: 1 });
    expect(await readdir(join(featureDirectory, "events"))).toEqual(["00000001.json"]);
    expect(await stat(join(root, ".empirical/state.json")).then(() => true, () => false)).toBe(false);
  });

  test("migration partitions shared root history by the feature recorded in each event", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const firstFeature = "completed-legacy-feature";
    const secondFeature = "current-legacy-feature";
    await project.store.writeSpec(firstFeature, "# Completed legacy feature\n");
    await project.store.writeSpec(secondFeature, "# Current legacy feature\n");
    const idle = await project.status();
    const firstState = {
      ...idle, schemaVersion: 3, revision: 7, activeFeature: firstFeature,
      request: "Complete legacy work", profile: "fast", phase: "done", status: "done",
    };
    const secondState = {
      ...idle, schemaVersion: 3, revision: 8, activeFeature: secondFeature,
      request: "Resume current work", profile: "fast", phase: "implement", status: "waiting",
    };
    await writeFile(join(root, ".empirical/state.json"), `${JSON.stringify(secondState)}\n`, "utf8");
    await mkdir(join(root, ".empirical/events"), { recursive: true });
    for (const [name, state] of [["00000007.json", firstState], ["00000008.json", secondState]] as const) {
      await writeFile(join(root, ".empirical/events", name), `${JSON.stringify({
        schemaVersion: 3, revision: state.revision, previousRevision: state.revision - 1,
        actor: "legacy", summary: state.request, createdAt: state.updatedAt, state,
      })}\n`, "utf8");
    }

    const reopened = await EmpiricalProject.open(root);
    expect(await reopened.status()).toMatchObject({ activeFeature: secondFeature, revision: 8 });
    expect(await readdir(join(root, ".empirical/specs", firstFeature, "events"))).toEqual(["00000007.json"]);
    expect(await readdir(join(root, ".empirical/specs", secondFeature, "events"))).toEqual(["00000008.json"]);
    expect(JSON.parse(await readFile(join(root, ".empirical/specs", firstFeature, "state.json"), "utf8")))
      .toMatchObject({ activeFeature: firstFeature, phase: "done", revision: 7 });
  });

  test("feature creation refuses a symbolic-link destination without writing through it", async () => {
    const root = await temporaryProject();
    const outside = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const feature = "redirected-feature";
    await symlink(outside, join(root, ".empirical/specs", feature), "dir");
    await expect(project.fast("Create redirected feature", { id: feature }))
      .rejects.toMatchObject({ code: "UNSAFE_SPEC_PATH" });
    expect(await readdir(outside)).toEqual([]);
  });

  test("terminal legacy root state does not reserve the checkout", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const terminal = { ...(await project.status()), schemaVersion: 3, phase: "done", status: "done", activeFeature: null, revision: 9 };
    await writeFile(join(root, ".empirical/state.json"), `${JSON.stringify(terminal)}\n`, "utf8");
    const reopened = await EmpiricalProject.open(root);
    expect(await reopened.status()).toMatchObject({ phase: "idle", activeFeature: null });
    expect(action(await reopened.fast("Start after terminal legacy state"))).toMatchObject({ revision: 1, phase: "implement" });
  });

  test("a process that first sees a non-Git project discovers checkout metadata after Git is initialized", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    expect(await project.status()).toMatchObject({ phase: "idle" });
    spawnSync("git", ["init", "-b", "main"], { cwd: root, encoding: "utf8", shell: false });
    const started = action(await project.fast("Track work after Git initialization"));
    const selection = join(root, ".git/empirical-sdd/active-feature");
    expect(await readFile(selection, "utf8"))
      .toBe(`${started.feature}\n`);
    await rm(selection);
    const recovered = await EmpiricalProject.open(root);
    expect(await recovered.status()).toMatchObject({ activeFeature: started.feature });
    expect(await readFile(selection, "utf8")).toBe(`${started.feature}\n`);
    await recovered.complete({
      revision: 1,
      outcome: "passed",
      summary: "Completed after recovery",
      evidence: [
        { criterionId: "AC-1", kind: "test", passed: true, summary: "Passed" },
        { criterionId: "all", kind: "review", passed: true, summary: "Reviewed" },
      ],
    });
    expect(await stat(selection).then(() => true, () => false)).toBe(false);
  });

  test("recovery rejects multiple unclaimed non-terminal feature histories", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const started = action(await project.fast("Create the first recoverable feature"));
    const first = join(root, ".empirical/specs", started.feature!);
    const secondFeature = "second-unclaimed-feature";
    const second = join(root, ".empirical/specs", secondFeature);
    await mkdir(second, { recursive: true });
    const state = JSON.parse(await readFile(join(first, "state.json"), "utf8")) as WorkflowState;
    await writeFile(join(second, "spec.md"), "# Second\n\n## Acceptance Criteria\n\n- [ ] [AC-1] Second is observable.\n", "utf8");
    await writeFile(join(second, "state.json"), `${JSON.stringify({
      ...state,
      activeFeature: secondFeature,
      request: "Create a second unclaimed feature",
    })}\n`, "utf8");

    await expect(EmpiricalProject.open(root)).rejects.toMatchObject({
      code: "MULTIPLE_ACTIVE_FEATURES",
      details: { features: [started.feature, secondFeature].sort() },
    });
  });

  test("project initialization keeps runtime integration but installs no local workflow skill", async () => {
    const root = await temporaryProject();
    const { integrations } = await EmpiricalProject.initialize(root);
    expect(integrations.entrypoints).toEqual([]);
    expect(await readFile(join(root, ".mcp.json"), "utf8")).toContain("empirical");
    await expect(readFile(join(root, ".agents/skills/empirical/SKILL.md"), "utf8"))
      .rejects.toBeDefined();
  });

  test("v1 adoption preserves ai and stores active state inside the feature", async () => {
    const root = await temporaryProject();
    await mkdir(join(root, "ai/specs/legacy-feature"), { recursive: true });
    await writeFile(join(root, "ai/STATE.md"), "current_spec: legacy-feature\ncurrent_phase: implementation\n", "utf8");
    await writeFile(join(root, "ai/specs/legacy-feature/spec.md"), "# Legacy\n", "utf8");
    const adopted = await EmpiricalProject.adopt(root, { integrations: false });
    expect(await adopted.project.status()).toMatchObject({ activeFeature: "legacy-feature", phase: "implement" });
    expect(await readFile(join(root, "ai/STATE.md"), "utf8")).toContain("legacy-feature");
    expect(await stat(join(root, ".empirical/specs/legacy-feature/state.json"))).toBeDefined();
  });
});
