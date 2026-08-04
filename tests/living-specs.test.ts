import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { EmpiricalProject } from "../src/core.js";
import {
  captureCapabilityBase,
  capabilityMarkdownDigest,
  parseCapabilityDelta,
  planCapabilityArchive,
  replayCapabilityDeltas,
  validateFeatureDeltas,
} from "../src/specifications.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryProject(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "empirical-living-specs-"));
  directories.push(directory);
  return directory;
}

function git(root: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", shell: false });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

async function initializeRepository(root: string): Promise<EmpiricalProject> {
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.name", "Empirical Test"]);
  git(root, ["config", "user.email", "empirical@example.test"]);
  await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
  const { project } = await EmpiricalProject.initialize(root, { integrations: false });
  await project.configurePolicy({
    schemaVersion: 2,
    context: [],
    phases: {},
    verification: {
      evidence: { required: true, browserForUi: true, screenshotForUi: true, codeReview: true },
      commands: [{
        id: "verify",
        argv: [
          process.execPath,
          "-e",
          "process.exit(require('node:fs').existsSync('source-overlay-marker.txt') ? 0 : 1)",
        ],
        cwd: ".",
        timeoutMs: 30_000,
        maxOutputBytes: 65_536,
        evidenceKinds: ["test", "review"],
        criteria: [],
      }],
    },
    delivery: null,
    preferredAgent: null,
  });
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "initialize"]);
  return project;
}

function delta(
  operation: "ADDED" | "MODIFIED" | "REMOVED",
  requirement: string,
  purpose = "This capability documents a meaningful observable product behavior.",
): string {
  return `## Purpose\n\n${purpose}\n\n## ${operation} Requirements\n\n### Requirement: ${requirement}\n\nThe behavior MUST match this requirement.\n\n#### Scenario: Observable result\n\n- **WHEN** the behavior is invoked\n- **THEN** the expected result is visible\n`;
}

async function writeDelta(root: string, feature: string, capability: string, contents: string): Promise<void> {
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

Exercise integration replay, validation, convergence, and rollback.
`, "utf8");
}

async function advanceToIntegrate(
  project: EmpiricalProject,
  root: string,
  request = "Add a durable export capability",
): Promise<{ feature: string; revision: number; target: string }> {
  let action = await project.complex(request);
  if (action.kind !== "action" || !action.feature) throw new Error("Expected Complex action");
  const feature = action.feature;
  const directory = join(root, ".empirical", "specs", feature);
  await writeFile(join(root, "source-overlay-marker.txt"), "validated source overlay\n", "utf8");
  await writeFile(join(directory, "spec.md"), "# Export\n\n## Acceptance Criteria\n\n- [ ] [AC-1] A user can export a durable report.\n", "utf8");
  await writeDelta(root, feature, "report-export", delta("ADDED", "A report can be exported"));
  action = await project.complete({ revision: action.revision, outcome: "passed", summary: "Specified" });
  await writeFile(join(directory, "design.md"), "# Design\n\nUse a deterministic export boundary.\n", "utf8");
  await writeAcceptedDecision(directory);
  action = await project.complete({ revision: action.revision, outcome: "passed", summary: "Designed" });
  await writeFile(join(directory, "plan.md"), "# Plan\n\n1. Implement and verify export.\n", "utf8");
  action = await project.complete({ revision: action.revision, outcome: "passed", summary: "Planned" });
  action = await project.complete({ revision: action.revision, outcome: "passed", summary: "Implemented", actor: "builder" });
  const verification = await project.executeEvidence({
    commandId: "verify",
    criteria: ["AC-1"],
    evidenceKinds: ["test"],
    summary: "The export behavior passed its focused test",
  });
  action = await project.complete({ revision: action.revision, outcome: "passed", summary: "Verified", receiptIds: [verification.id] });
  const review = await project.executeEvidence({
    commandId: "verify",
    criteria: ["AC-1"],
    evidenceKinds: ["review"],
    summary: "Independent review found no blocking issue",
  });
  action = await project.complete({ revision: action.revision, outcome: "passed", summary: "Reviewed", receiptIds: [review.id] });
  expect(action).toMatchObject({ phase: "integrate", status: "waiting", completionLevel: { highest: "verified" } });
  expect(action.completion).toMatchObject({
    available: true,
    mcpTool: "empirical_integrate",
    requiredFields: ["revision", "targetRoot"],
  });
  const target = await temporaryProject();
  git(root, ["worktree", "add", "-b", `target-${feature}`, target, "HEAD"]);
  return { feature, revision: action.revision, target };
}

describe("living capability specifications", () => {
  test("capability replay canonicalizes line endings without hiding semantic changes", () => {
    const original = `# Example Specification

## Purpose

Describe stable example behavior across supported checkout conventions.

## Requirements

### Requirement: Portable replay

The product MUST preserve the original value.

#### Scenario: Original

- **WHEN** replay runs
- **THEN** the original value is retained
`;
    const change = parseCapabilityDelta("example", `## MODIFIED Requirements

### Requirement: Portable replay

The product MUST return the revised value.

#### Scenario: Revised

- **WHEN** replay runs
- **THEN** the revised value is returned
`);
    const base = captureCapabilityBase("example", original, [change]);
    const crlfBase = captureCapabilityBase(
      "example",
      original.replaceAll("\n", "\r\n"),
      [change],
    );
    expect(crlfBase.digest).toBe(base.digest);
    expect(crlfBase.requirements).toEqual(base.requirements);

    const canonical = replayCapabilityDeltas("example", original, [change], base);
    const equivalent = replayCapabilityDeltas(
      "example",
      original.replaceAll("\n", "\r\n"),
      [change],
      base,
    );
    expect(equivalent.issues).toEqual([]);
    expect(equivalent.next).toContain("revised value");
    expect(equivalent.next).not.toContain("\r");
    expect(equivalent.resultDigest).toBe(canonical.resultDigest);
    expect(capabilityMarkdownDigest(original.replaceAll("\n", "\r\n"))).toBe(
      capabilityMarkdownDigest(original),
    );

    const changed = replayCapabilityDeltas(
      "example",
      original.replace("original value", "concurrent value"),
      [change],
      base,
    );
    expect(changed.issues).toContain(
      "example.md: requirement 'Portable replay' changed since the feature base",
    );
  });

  test("Explore is pure and returns fresh project and capability context", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    await project.configurePolicy({
      schemaVersion: 2,
      context: ["Reports are immutable after publication."],
      phases: {},
      verification: { evidence: { required: true, browserForUi: true, screenshotForUi: true, codeReview: true }, commands: [] },
      delivery: null,
      preferredAgent: null,
    });
    await project.store.writeCapability("published-reports", "# Published Reports Specification\n\n## Purpose\n\nCurrent report publication behavior.\n\n## Requirements\n\n_No current requirements._\n");
    const configBefore = await readFile(project.store.configPath, "utf8");
    const specsBefore = await readdir(join(root, ".empirical", "specs"));
    const first = await project.explore("  Make report sharing easier  ");
    const second = await project.explore("Make report sharing easier");
    const cli = Bun.spawn([
      process.execPath, "run", resolve(import.meta.dir, "../src/cli.ts"), "__internal", "explore",
      "Make report sharing easier", "--root", root, "--json",
    ], { stdout: "pipe", stderr: "pipe" });
    const cliPacket = JSON.parse(await new Response(cli.stdout).text()) as typeof first;
    expect(first).toEqual(second);
    expect(await cli.exited).toBe(0);
    expect(cliPacket).toEqual(first);
    expect(first).toMatchObject({
      projectContext: ["Reports are immutable after publication."],
      capabilityContext: [".empirical/capabilities/published-reports/spec.md"],
    });
    expect(await readFile(project.store.configPath, "utf8")).toBe(configBefore);
    expect(await readdir(join(root, ".empirical", "specs"))).toEqual(specsBefore);
  });

  test("reviewed deltas integrate into canonical capability specs with an immutable receipt", async () => {
    const root = await temporaryProject();
    const project = await initializeRepository(root);
    const ready = await advanceToIntegrate(project, root);
    const scratch = join(root, ".empirical.schema5-aborted-metadata");
    await mkdir(scratch);
    await writeFile(join(scratch, "must-not-overlay.txt"), "migration scratch\n", "utf8");
    const integrated = await project.integrate(ready.revision, ready.target, "integrator");
    expect(integrated.action).toMatchObject({ phase: "done", status: "done", revision: ready.revision + 1, completionLevel: { highest: "integrated" } });
    expect(integrated.report).toEqual({
      feature: ready.feature,
      capabilities: ["report-export"],
      added: 1,
      modified: 0,
      removed: 0,
      converged: false,
    });
    expect(integrated.receipt).toMatchObject({ feature: ready.feature, verificationReceiptDigests: [expect.stringMatching(/^sha256:/)] });
    expect(await stat(join(ready.target, "source-overlay-marker.txt")).then(() => true, () => false)).toBe(false);
    expect(await stat(join(ready.target, ".empirical.schema5-aborted-metadata")).then(() => true, () => false)).toBe(false);
    const capability = await readFile(join(root, ".empirical/capabilities/report-export/spec.md"), "utf8");
    expect(capability.match(/### Requirement: A report can be exported/g)).toHaveLength(1);
    expect(await project.capabilities()).toEqual([{
      name: "report-export",
      path: ".empirical/capabilities/report-export/spec.md",
      requirements: 1,
    }]);
    const repeated = await project.integrate(ready.revision, ready.target, "integrator");
    expect(repeated.action).toEqual(integrated.action);
    expect(repeated.report).toEqual({ ...integrated.report, converged: true });
    expect(await readFile(join(root, ".empirical/capabilities/report-export/spec.md"), "utf8")).toBe(capability);
  });

  test("integration rejects capability deltas changed after Specify and Review", async () => {
    const root = await temporaryProject();
    const project = await initializeRepository(root);
    const ready = await advanceToIntegrate(project, root, "Add reviewed export behavior");
    const path = join(root, ".empirical/specs", ready.feature, "deltas/report-export.md");
    await writeFile(path, (await readFile(path, "utf8")).replace(
      "The behavior MUST match this requirement.",
      "A different, unreviewed behavior MUST replace it.",
    ), "utf8");
    await expect(project.integrate(ready.revision, ready.target)).rejects.toMatchObject({ code: "DELTA_CHANGED" });
    expect(await project.status()).toMatchObject({ phase: "integrate", revision: ready.revision });
    expect(await project.capability("report-export")).toBeNull();
  });

  test("integration rejects a target that independently changed a source-overlay path", async () => {
    const root = await temporaryProject();
    const project = await initializeRepository(root);
    const ready = await advanceToIntegrate(project, root, "Validate source changes against the target");
    await writeFile(join(ready.target, "source-overlay-marker.txt"), "conflicting target version\n", "utf8");
    git(ready.target, ["add", "source-overlay-marker.txt"]);
    git(ready.target, ["commit", "-m", "advance target source"]);

    await expect(project.integrate(ready.revision, ready.target)).rejects.toMatchObject({
      code: "INTEGRATION_SOURCE_CONFLICT",
    });
    expect(await readFile(join(ready.target, "source-overlay-marker.txt"), "utf8")).toBe(
      "conflicting target version\n",
    );
    expect(await project.status()).toMatchObject({ phase: "integrate", revision: ready.revision });
  });

  test("valid modifications and removals project canonically and roll back", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const original = "# Reports Specification\n\n## Purpose\n\nThis capability defines current report behavior.\n\n## Requirements\n\n### Requirement: Keep report\n\nThe old behavior MUST apply.\n\n#### Scenario: Old behavior\n\n- **WHEN** a report is kept\n- **THEN** the old result appears\n\n### Requirement: Remove report\n\nRemoval MUST be available.\n\n#### Scenario: Removal\n\n- **WHEN** removal is requested\n- **THEN** the report is removed\n";
    await project.store.writeCapability("reports", original);
    const feature = "change-reports";
    await project.store.writeSpec(feature, "# Change reports\n");
    await writeDelta(root, feature, "reports", "## MODIFIED Requirements\n\n### Requirement: Keep report\n\nThe new behavior MUST apply.\n\n#### Scenario: New behavior\n\n- **WHEN** a report is kept\n- **THEN** the new result appears\n\n## REMOVED Requirements\n\n### Requirement: Remove report\n\nRemoval MUST no longer be available.\n\n#### Scenario: Removal is retired\n\n- **WHEN** old removal is requested\n- **THEN** it is unavailable\n");
    const plan = await planCapabilityArchive(project.store, feature);
    expect(plan.report).toEqual({ capabilities: ["reports"], added: 0, modified: 1, removed: 1 });
    const rollback = await plan.commit();
    expect(await project.store.readCapability("reports")).toContain("The new behavior MUST apply.");
    await rollback();
    expect(await project.store.readCapability("reports")).toBe(original);
  });

  test("delta validation rejects malformed, unsafe, duplicate, and missing operations", async () => {
    expect(() => parseCapabilityDelta("../escape", delta("ADDED", "Unsafe"))).toThrow();
    expect(() => parseCapabilityDelta("reports", "## ADDED Requirements\n\n### Requirement: Missing scenario\n\nThis MUST work.\n")).toThrow();
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    await project.store.writeCapability("reports", "# Reports Specification\n\n## Purpose\n\nCurrent report behavior.\n\n## Requirements\n\n### Requirement: Existing report\n\nReports MUST exist.\n\n#### Scenario: Existing\n\n- **WHEN** reports are listed\n- **THEN** existing reports appear\n");
    const feature = "invalid-deltas";
    await project.store.writeSpec(feature, "# Invalid deltas\n");
    await writeDelta(root, feature, "reports", `${delta("ADDED", "Existing report")}\n${delta("MODIFIED", "Missing report")}\n${delta("REMOVED", "Also missing")}`);
    const report = await validateFeatureDeltas(project.store, feature);
    expect(report.valid).toBe(false);
    expect(report.issues.join("\n")).toContain("cannot add existing requirement 'Existing report'");
    expect(report.issues.join("\n")).toContain("cannot modify missing requirement 'Missing report'");
    expect(report.issues.join("\n")).toContain("cannot remove missing requirement 'Also missing'");
  });

  test("capability storage rejects symbolic-link escapes and direct archive is retired", async () => {
    const root = await temporaryProject();
    const outside = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    await symlink(outside, join(root, ".empirical/capabilities/escaped"), "dir");
    await expect(project.store.writeCapability("escaped", "# Must not escape\n"))
      .rejects.toMatchObject({ code: "UNSAFE_CAPABILITY_PATH" });
    expect(await stat(join(outside, "spec.md")).then(() => true, () => false)).toBe(false);
    await expect(project.archive(1)).rejects.toMatchObject({ code: "INTEGRATION_REQUIRED" });
  });
});
