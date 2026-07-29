import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { EmpiricalProject } from "../src/core.js";
import {
  parseCapabilityDelta,
  planCapabilityArchive,
  validateFeatureDeltas,
} from "../src/specifications.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

async function temporaryProject(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "empirical-living-specs-"));
  directories.push(directory);
  return directory;
}

function delta(
  operation: "ADDED" | "MODIFIED" | "REMOVED",
  requirement: string,
  purpose = "This capability documents a meaningful observable product behavior.",
): string {
  return `## Purpose\n\n${purpose}\n\n## ${operation} Requirements\n\n### Requirement: ${requirement}\n\nThe behavior MUST match this requirement.\n\n#### Scenario: Observable result\n\n- **WHEN** the behavior is invoked\n- **THEN** the expected result is visible\n`;
}

async function writeDelta(
  root: string,
  feature: string,
  capability: string,
  contents: string,
): Promise<void> {
  const directory = join(root, ".empirical", "specs", feature, "deltas");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${capability}.md`), contents, "utf8");
}

async function writeAcceptedDecision(directory: string): Promise<void> {
  await writeFile(join(directory, "decisions.md"), `# Decisions

## D-001: Preserve the capability boundary

Status: Accepted

### Evidence

The existing capability specification is the canonical behavior contract.

### Options

1. Update it transactionally. 2. Maintain a second projection.

### Chosen approach

Update the canonical projection transactionally.

### Trade-offs and risks

Partial writes are a risk and require rollback.

### Verification

Exercise archive success, convergence, and rollback.
`, "utf8");
}

async function advanceToArchive(
  project: EmpiricalProject,
  root: string,
  request = "Add a durable export capability",
): Promise<{ feature: string; revision: number }> {
  let action = await project.complex(request);
  const feature = action.feature!;
  const directory = join(root, ".empirical", "specs", feature);
  await writeFile(
    join(directory, "spec.md"),
    "# Export\n\n## Acceptance Criteria\n\n- [ ] [AC-1] A user can export a durable report.\n",
    "utf8",
  );
  await writeDelta(root, feature, "report-export", delta("ADDED", "A report can be exported"));

  action = await project.complete({ revision: action.revision, outcome: "passed", summary: "Specified" });
  await writeFile(join(directory, "design.md"), "# Design\n\nUse a deterministic export boundary.\n", "utf8");
  await writeAcceptedDecision(directory);
  action = await project.complete({ revision: action.revision, outcome: "passed", summary: "Designed" });
  await writeFile(join(directory, "plan.md"), "# Plan\n\n1. Implement and verify export.\n", "utf8");
  action = await project.complete({ revision: action.revision, outcome: "passed", summary: "Planned" });
  action = await project.complete({ revision: action.revision, outcome: "passed", summary: "Implemented", actor: "builder" });
  action = await project.complete({
    revision: action.revision,
    outcome: "passed",
    summary: "Verified",
    evidence: [{
      criterionId: "AC-1",
      kind: "test",
      passed: true,
      summary: "The export behavior passed its focused test",
    }],
  });
  action = await project.complete({
    revision: action.revision,
    outcome: "passed",
    summary: "Reviewed",
    actor: "reviewer",
    evidence: [{
      criterionId: "all",
      kind: "review",
      passed: true,
      summary: "No blocking findings",
    }],
  });
  expect(action).toMatchObject({ phase: "archive", status: "waiting" });
  expect(action.completion).toMatchObject({
    available: true,
    mcpTool: "empirical_archive",
    requiredFields: ["revision"],
  });
  return { feature, revision: action.revision };
}

describe("living capability specifications", () => {
  test("Explore is pure and returns project and capability context", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    await project.store.writePolicy({
      schemaVersion: 1,
      context: ["Reports are immutable after publication."],
      phases: {},
    });
    await project.store.writeCapability(
      "published-reports",
      "# Published Reports Specification\n\n## Purpose\n\nCurrent report publication behavior.\n\n## Requirements\n\n_No current requirements._\n",
    );
    const configBefore = await readFile(project.store.configPath, "utf8");
    const specsBefore = await readdir(join(root, ".empirical", "specs"));

    const first = await project.explore("  Make report sharing easier  ");
    const second = await project.explore("Make report sharing easier");
    const cli = Bun.spawn([
      process.execPath,
      "run",
      resolve(import.meta.dir, "../src/cli.ts"),
      "explore",
      "Make report sharing easier",
      "--root",
      root,
      "--json",
    ], { stdout: "pipe", stderr: "pipe" });
    const cliPacket = JSON.parse(await new Response(cli.stdout).text()) as typeof first;

    expect(first).toEqual(second);
    expect(await cli.exited).toBe(0);
    expect(cliPacket).toEqual(first);
    expect(first).toMatchObject({
      problem: "Make report sharing easier",
      projectContext: ["Reports are immutable after publication."],
      capabilityContext: [".empirical/capabilities/published-reports/spec.md"],
    });
    expect(await readFile(project.store.configPath, "utf8")).toBe(configBefore);
    expect(await readdir(join(root, ".empirical", "specs"))).toEqual(specsBefore);
  });

  test("validated deltas archive into canonical capability specs exactly once", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const ready = await advanceToArchive(project, root);

    const archived = await project.archive(ready.revision, "archiver");

    expect(archived.action).toMatchObject({ phase: "done", status: "done", revision: ready.revision + 1 });
    expect(archived.report).toEqual({
      feature: ready.feature,
      capabilities: ["report-export"],
      added: 1,
      modified: 0,
      removed: 0,
      converged: false,
    });
    const capability = await readFile(
      join(root, ".empirical", "capabilities", "report-export", "spec.md"),
      "utf8",
    );
    expect(capability.match(/### Requirement: A report can be exported/g)).toHaveLength(1);
    expect(await project.capabilities()).toEqual([{
      name: "report-export",
      path: ".empirical/capabilities/report-export/spec.md",
      requirements: 1,
    }]);

    const repeated = await project.archive(ready.revision, "archiver");
    expect(repeated.report.converged).toBe(true);
    expect(repeated.action).toEqual(archived.action);
    expect(await readFile(
      join(root, ".empirical", "capabilities", "report-export", "spec.md"),
      "utf8",
    )).toBe(capability);
  });

  test("Archive rejects capability deltas changed after Specify and Review", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const ready = await advanceToArchive(project, root, "Add reviewed export behavior");
    const path = join(
      root,
      ".empirical",
      "specs",
      ready.feature,
      "deltas",
      "report-export.md",
    );
    await writeFile(
      path,
      (await readFile(path, "utf8")).replace(
        "The behavior MUST match this requirement.",
        "A different, unreviewed behavior MUST replace it.",
      ),
      "utf8",
    );

    await expect(project.archive(ready.revision)).rejects.toMatchObject({ code: "DELTA_CHANGED" });
    expect(await project.status()).toMatchObject({ phase: "archive", revision: ready.revision });
    expect(await project.capability("report-export")).toBeNull();
    expect(await project.verify()).toMatchObject({
      valid: false,
      missing: expect.arrayContaining(["Capability deltas changed after Specify approval"]),
    });
  });

  test("valid modifications and removals project canonically and can be rolled back", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const original = "# Reports Specification\n\n## Purpose\n\nThis capability defines current report behavior.\n\n## Requirements\n\n### Requirement: Keep report\n\nThe old behavior MUST apply.\n\n#### Scenario: Old behavior\n\n- **WHEN** a report is kept\n- **THEN** the old result appears\n\n### Requirement: Remove report\n\nRemoval MUST be available.\n\n#### Scenario: Removal\n\n- **WHEN** removal is requested\n- **THEN** the report is removed\n";
    await project.store.writeCapability("reports", original);
    const feature = "001-change-reports";
    await project.store.writeSpec(feature, "# Change reports\n");
    await writeDelta(
      root,
      feature,
      "reports",
      "## MODIFIED Requirements\n\n### Requirement: Keep report\n\nThe new behavior MUST apply.\n\n#### Scenario: New behavior\n\n- **WHEN** a report is kept\n- **THEN** the new result appears\n\n## REMOVED Requirements\n\n### Requirement: Remove report\n\nRemoval MUST no longer be available.\n\n#### Scenario: Removal is retired\n\n- **WHEN** old removal is requested\n- **THEN** it is unavailable\n",
    );

    const plan = await planCapabilityArchive(project.store, feature);
    expect(plan.report).toEqual({
      capabilities: ["reports"],
      added: 0,
      modified: 1,
      removed: 1,
    });
    const rollback = await plan.commit();
    const projected = await project.store.readCapability("reports");
    expect(projected).toContain("The new behavior MUST apply.");
    expect(projected).not.toContain("Requirement: Remove report");
    await rollback();
    expect(await project.store.readCapability("reports")).toBe(original);
  });

  test("delta validation rejects malformed, unsafe, duplicate, and missing operations", async () => {
    expect(() => parseCapabilityDelta("../escape", delta("ADDED", "Unsafe")))
      .toThrow();
    expect(() => parseCapabilityDelta(
      "reports",
      "## ADDED Requirements\n\n### Requirement: Missing scenario\n\nThis MUST work.\n",
    )).toThrow();

    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    await project.store.writeCapability(
      "reports",
      "# Reports Specification\n\n## Purpose\n\nCurrent report behavior.\n\n## Requirements\n\n### Requirement: Existing report\n\nReports MUST exist.\n\n#### Scenario: Existing\n\n- **WHEN** reports are listed\n- **THEN** existing reports appear\n",
    );
    const feature = "001-invalid-deltas";
    await project.store.writeSpec(feature, "# Invalid deltas\n");
    await writeDelta(
      root,
      feature,
      "reports",
      `${delta("ADDED", "Existing report")}\n${delta("MODIFIED", "Missing report")}\n${delta("REMOVED", "Also missing")}`,
    );

    const report = await validateFeatureDeltas(project.store, feature);
    expect(report.valid).toBe(false);
    expect(report.issues.join("\n")).toContain("cannot add existing requirement 'Existing report'");
    expect(report.issues.join("\n")).toContain("cannot modify missing requirement 'Missing report'");
    expect(report.issues.join("\n")).toContain("cannot remove missing requirement 'Also missing'");

    await writeDelta(
      root,
      feature,
      "reports",
      `## ADDED Requirements\n\n${delta("ADDED", "Duplicate").split("## ADDED Requirements\n\n")[1]}\n${delta("ADDED", "Duplicate").split("## ADDED Requirements\n\n")[1]}`,
    );
    expect((await validateFeatureDeltas(project.store, feature)).issues.join("\n"))
      .toContain("requirement 'Duplicate' is changed more than once");
  });

  test("capability storage rejects symbolic-link escapes", async () => {
    const root = await temporaryProject();
    const outside = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    await symlink(outside, join(root, ".empirical", "capabilities", "escaped"), "dir");

    await expect(project.store.writeCapability("escaped", "# Must not escape\n"))
      .rejects.toMatchObject({ code: "UNSAFE_CAPABILITY_PATH" });
    expect(await stat(join(outside, "spec.md")).then(() => true, () => false)).toBe(false);
  });

  test("archive refuses early calls and rolls capability writes back as one unit", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const started = await project.complex("Change two capabilities atomically");
    await expect(project.archive(started.revision)).rejects.toMatchObject({ code: "ARCHIVE_NOT_READY" });

    const directory = join(root, ".empirical", "specs", started.feature!);
    await writeFile(
      join(directory, "spec.md"),
      "# Atomic capabilities\n\n## Acceptance Criteria\n\n- [ ] [AC-1] Both capabilities update together.\n",
      "utf8",
    );
    await writeDelta(root, started.feature!, "alpha", delta("ADDED", "Alpha behavior"));
    await writeDelta(root, started.feature!, "zeta", delta("ADDED", "Zeta behavior"));

    let action = await project.complete({ revision: 1, outcome: "passed", summary: "Specified" });
    await writeFile(join(directory, "design.md"), "# Design\n\nAtomic projection.\n", "utf8");
    await writeAcceptedDecision(directory);
    action = await project.complete({ revision: action.revision, outcome: "passed", summary: "Designed" });
    await writeFile(join(directory, "plan.md"), "# Plan\n\n1. Archive atomically.\n", "utf8");
    action = await project.complete({ revision: action.revision, outcome: "passed", summary: "Planned" });
    action = await project.complete({ revision: action.revision, outcome: "passed", summary: "Implemented", actor: "builder" });
    action = await project.complete({
      revision: action.revision,
      outcome: "passed",
      summary: "Verified",
      evidence: [{ criterionId: "AC-1", kind: "test", passed: true, summary: "Atomic test passed" }],
    });
    action = await project.complete({
      revision: action.revision,
      outcome: "passed",
      summary: "Reviewed",
      actor: "reviewer",
      evidence: [{ criterionId: "all", kind: "review", passed: true, summary: "Review passed" }],
    });

    await mkdir(join(root, ".empirical", "capabilities", "zeta", "spec.md"), { recursive: true });
    await expect(project.archive(action.revision)).rejects.toBeDefined();
    expect(await project.status()).toMatchObject({ phase: "archive", revision: action.revision });
    expect(await stat(join(root, ".empirical", "capabilities", "alpha")).then(
      () => true,
      () => false,
    )).toBe(false);
  });
});
