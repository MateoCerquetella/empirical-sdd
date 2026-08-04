import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  captureCapabilityBases,
  claimCapabilities,
  commonCoordinationPath,
  inspectCapabilityClaims,
  integrateCapabilities,
  resolveGitRepositoryIdentity,
  verifyIntegrationReceipt,
} from "../src/coordination.js";
import { sha256 } from "../src/protocol.js";
import { parseCapabilityDelta } from "../src/specifications.js";

const parents: string[] = [];
afterEach(async () => {
  await Promise.all(parents.splice(0).map((parent) => rm(parent, { recursive: true, force: true })));
});

function git(root: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", shell: false });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

const baseCapability = `# Example Specification

## Purpose

Describe stable example behavior for coordination tests.

## Requirements

### Requirement: Touched behavior

The product MUST return the original value.

#### Scenario: Original

- **WHEN** it runs
- **THEN** the original value is returned

### Requirement: Unrelated behavior

The product MUST preserve unrelated behavior.

#### Scenario: Unrelated

- **WHEN** another feature runs
- **THEN** its value is retained
`;

const modifiedDelta = `## Purpose

Describe stable example behavior for coordination tests.

## MODIFIED Requirements

### Requirement: Touched behavior

The product MUST return the revised value.

#### Scenario: Revised

- **WHEN** it runs
- **THEN** the revised value is returned
`;

async function repository(): Promise<{
  parent: string;
  root: string;
  target: string;
  delta: ReturnType<typeof parseCapabilityDelta>;
}> {
  const parent = await mkdtemp(join(tmpdir(), "empirical-coordination-"));
  parents.push(parent);
  const root = join(parent, "source");
  const target = join(parent, "target");
  await mkdir(root);
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Empirical Test"]);
  const capabilityPath = join(root, ".empirical", "capabilities", "example", "spec.md");
  const deltaPath = join(
    root,
    ".empirical",
    "specs",
    "feature-one",
    "deltas",
    "example.md",
  );
  await mkdir(dirname(capabilityPath), { recursive: true });
  await mkdir(dirname(deltaPath), { recursive: true });
  await writeFile(capabilityPath, baseCapability, "utf8");
  await writeFile(deltaPath, modifiedDelta, "utf8");
  await writeFile(join(root, "README.md"), "fixture\n", "utf8");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "base"]);
  git(root, ["worktree", "add", "-b", "target", target, "HEAD"]);
  return {
    parent,
    root,
    target,
    delta: parseCapabilityDelta("example", modifiedDelta, "example.md"),
  };
}

async function claimFor(
  root: string,
  feature: string,
  delta: ReturnType<typeof parseCapabilityDelta>,
) {
  const bases = await captureCapabilityBases({ root, feature, deltas: [delta] });
  return claimCapabilities({
    root,
    feature,
    bases,
    now: () => new Date("2026-08-03T10:00:00Z"),
  });
}

describe("Git common-directory capability coordination", () => {
  test("resolves shared identity and atomically rejects a live overlap", async () => {
    const fixture = await repository();
    const source = await resolveGitRepositoryIdentity(fixture.root);
    const target = await resolveGitRepositoryIdentity(fixture.target);
    expect(source.repositoryId).toBe(target.repositoryId);
    expect(source.worktreeId).not.toBe(target.worktreeId);
    expect(await commonCoordinationPath(fixture.root)).toBe(".git/empirical");

    const first = await claimFor(fixture.root, "feature-one", fixture.delta);
    expect(first.converged).toBe(false);
    expect(first.claim.capabilities).toEqual(["example"]);
    await expect(
      claimFor(fixture.target, "feature-two", fixture.delta),
    ).rejects.toThrow("Live capability claim conflict");
    const converged = await claimFor(fixture.root, "feature-one", fixture.delta);
    expect(converged.converged).toBe(true);
    expect((await inspectCapabilityClaims(fixture.root)).active).toHaveLength(1);
  });

  test("serializes concurrent overlapping claim attempts", async () => {
    const fixture = await repository();
    const results = await Promise.allSettled([
      claimFor(fixture.root, "feature-one", fixture.delta),
      claimFor(fixture.target, "feature-two", fixture.delta),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await inspectCapabilityClaims(fixture.root)).active).toHaveLength(1);
  });

  test("diagnoses stale owners without deleting their claim or registration", async () => {
    const fixture = await repository();
    const claimed = await claimFor(fixture.target, "feature-two", fixture.delta);
    await rm(fixture.target, { recursive: true, force: true });
    const inspected = await inspectCapabilityClaims(fixture.root);
    expect(inspected.stale.map((claim) => claim.id)).toContain(claimed.claim.id);
    expect(
      git(fixture.root, ["worktree", "list", "--porcelain"]),
    ).toContain(fixture.target);
  });

  test("replays touched requirements onto an independently advanced target", async () => {
    const fixture = await repository();
    const claimed = await claimFor(fixture.root, "feature-one", fixture.delta);
    const targetCapability = join(
      fixture.target,
      ".empirical",
      "capabilities",
      "example",
      "spec.md",
    );
    const targetChange = baseCapability.replace(
      "The product MUST preserve unrelated behavior.",
      "The product MUST preserve independently advanced unrelated behavior.",
    );
    await writeFile(targetCapability, targetChange, "utf8");
    git(fixture.target, ["add", "."]);
    git(fixture.target, ["commit", "-m", "advance unrelated behavior"]);

    let validatedRoot = "";
    const receipt = await integrateCapabilities({
      root: fixture.root,
      targetRoot: fixture.target,
      feature: "feature-one",
      claimId: claimed.claim.id,
      validator: async (targetRoot, candidates) => {
        validatedRoot = targetRoot;
        expect(candidates).toHaveLength(1);
        expect(candidates[0]?.next).toContain("revised value");
        expect(candidates[0]?.next).toContain("independently advanced unrelated behavior");
        return {
          featureTree: sha256("validated feature tree"),
          verificationReceiptDigests: [sha256("integration ci")],
        };
      },
      now: () => new Date("2026-08-03T11:00:00Z"),
    });
    expect(validatedRoot).toBe(fixture.target);
    expect(() => verifyIntegrationReceipt(receipt)).not.toThrow();
    expect(receipt.targetCommit).not.toBe(receipt.baseCommit);
    const projected = await readFile(
      join(fixture.root, ".empirical", "capabilities", "example", "spec.md"),
      "utf8",
    );
    expect(projected).toContain("revised value");
    expect(projected).toContain("independently advanced unrelated behavior");
    const inspection = await inspectCapabilityClaims(fixture.root);
    expect(inspection.active).toHaveLength(0);
    expect(inspection.integrated[0]?.integrationReceiptDigest).toBe(receipt.digest);
  });

  test("preserves projections and active claim on a semantic replay conflict", async () => {
    const fixture = await repository();
    const claimed = await claimFor(fixture.root, "feature-one", fixture.delta);
    const targetCapability = join(
      fixture.target,
      ".empirical",
      "capabilities",
      "example",
      "spec.md",
    );
    await writeFile(
      targetCapability,
      baseCapability.replace("original value", "concurrent value"),
      "utf8",
    );
    git(fixture.target, ["add", "."]);
    git(fixture.target, ["commit", "-m", "conflict"]);
    const sourceBefore = await readFile(
      join(fixture.root, ".empirical", "capabilities", "example", "spec.md"),
      "utf8",
    );
    await expect(
      integrateCapabilities({
        root: fixture.root,
        targetRoot: fixture.target,
        feature: "feature-one",
        claimId: claimed.claim.id,
        validator: async () => ({
          featureTree: sha256("unused"),
          verificationReceiptDigests: [sha256("unused")],
        }),
      }),
    ).rejects.toThrow("changed since the feature base");
    expect(
      await readFile(
        join(fixture.root, ".empirical", "capabilities", "example", "spec.md"),
        "utf8",
      ),
    ).toBe(sourceBefore);
    expect((await inspectCapabilityClaims(fixture.root)).active[0]?.id).toBe(
      claimed.claim.id,
    );
  });

  test("requires an independent worktree and valid integration receipts", async () => {
    const fixture = await repository();
    const claimed = await claimFor(fixture.root, "feature-one", fixture.delta);
    await expect(
      integrateCapabilities({
        root: fixture.root,
        targetRoot: fixture.root,
        feature: "feature-one",
        claimId: claimed.claim.id,
        validator: async () => ({
          featureTree: sha256("tree"),
          verificationReceiptDigests: [sha256("ci")],
        }),
      }),
    ).rejects.toThrow("independent target worktree");
    await expect(
      integrateCapabilities({
        root: fixture.root,
        targetRoot: fixture.target,
        feature: "feature-one",
        claimId: claimed.claim.id,
        validator: async () => ({
          featureTree: sha256("tree"),
          verificationReceiptDigests: [],
        }),
      }),
    ).rejects.toThrow("at least one valid receipt");
    expect((await inspectCapabilityClaims(fixture.root)).active).toHaveLength(1);
  });

  test("rejects a target that moves during independent validation", async () => {
    const fixture = await repository();
    const claimed = await claimFor(fixture.root, "feature-one", fixture.delta);
    const sourceCapability = join(
      fixture.root,
      ".empirical",
      "capabilities",
      "example",
      "spec.md",
    );
    const before = await readFile(sourceCapability, "utf8");
    await expect(
      integrateCapabilities({
        root: fixture.root,
        targetRoot: fixture.target,
        feature: "feature-one",
        claimId: claimed.claim.id,
        validator: async () => {
          await writeFile(join(fixture.target, "README.md"), "target moved\n", "utf8");
          git(fixture.target, ["add", "README.md"]);
          git(fixture.target, ["commit", "-m", "move during validation"]);
          return {
            featureTree: sha256("tree before target moved"),
            verificationReceiptDigests: [sha256("ci before target moved")],
          };
        },
      }),
    ).rejects.toThrow("changed during independent validation");
    expect(await readFile(sourceCapability, "utf8")).toBe(before);
    expect((await inspectCapabilityClaims(fixture.root)).active[0]?.id).toBe(claimed.claim.id);
  });

  test("rolls source projections back to their own bytes when receipt promotion fails", async () => {
    const fixture = await repository();
    const claimed = await claimFor(fixture.root, "feature-one", fixture.delta);
    const sourceCapability = join(
      fixture.root,
      ".empirical",
      "capabilities",
      "example",
      "spec.md",
    );
    const sourceBefore = baseCapability.replace(
      "The product MUST preserve unrelated behavior.",
      "The source checkout has a distinct unrelated working-tree value.",
    );
    await writeFile(sourceCapability, sourceBefore, "utf8");
    await expect(
      integrateCapabilities({
        root: fixture.root,
        targetRoot: fixture.target,
        feature: "feature-one",
        claimId: claimed.claim.id,
        validator: async () => {
          await writeFile(
            join(fixture.root, ".empirical/specs/feature-one/integration-receipt.json"),
            "{}\n",
            "utf8",
          );
          return {
            featureTree: sha256("validated tree"),
            verificationReceiptDigests: [sha256("validated command")],
          };
        },
      }),
    ).rejects.toMatchObject({ code: "EEXIST" });
    expect(await readFile(sourceCapability, "utf8")).toBe(sourceBefore);
    expect((await inspectCapabilityClaims(fixture.root)).active[0]?.id).toBe(claimed.claim.id);
  });
});
