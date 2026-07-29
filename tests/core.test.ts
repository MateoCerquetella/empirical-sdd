import { afterEach, describe, expect, test } from "bun:test";
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EmpiricalProject } from "../src/core.js";
import { parseCriteria } from "../src/core.js";
import { EmpiricalError } from "../src/errors.js";
import { isRetryableLockOpenError } from "../src/storage.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryProject(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "empirical-core-"));
  directories.push(directory);
  return directory;
}

async function writeAddedDelta(
  root: string,
  feature: string,
  capability = "example-capability",
  requirement = "Requested behavior is available",
): Promise<void> {
  const directory = join(root, ".empirical", "specs", feature, "deltas");
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, `${capability}.md`),
    `## Purpose\n\nThis capability documents the current observable product behavior.\n\n## ADDED Requirements\n\n### Requirement: ${requirement}\n\nThe requested behavior MUST be available.\n\n#### Scenario: Successful use\n\n- **WHEN** a user invokes the behavior\n- **THEN** the requested result is available\n`,
    "utf8",
  );
}

async function seedLegacyWorkflow(
  root: string,
  persistedProfile: "quick" | "strong",
  request: string,
  feature: string,
): Promise<EmpiricalProject> {
  const { project } = await EmpiricalProject.initialize(root, { integrations: false });
  await project.store.writeSpec(
    feature,
    `# Legacy workflow\n\n## Request\n\n> ${request}\n\n## Acceptance Criteria\n\n<!-- Define observable criteria. -->\n`,
  );
  const initial = await project.status();
  await writeFile(
    project.store.statePath,
    `${JSON.stringify({
      ...initial,
      revision: 1,
      activeFeature: feature,
      request,
      profile: persistedProfile,
      phase: persistedProfile === "quick" ? "shape" : "specify",
      status: "waiting",
      updatedAt: new Date().toISOString(),
    }, null, 2)}\n`,
    "utf8",
  );
  return project;
}

describe("Empirical core", () => {
  test("install scripts remove the legacy binary owner before installing the current package", async () => {
    const shell = await readFile(join(import.meta.dir, "../scripts/install.sh"), "utf8");
    const powershell = await readFile(join(import.meta.dir, "../scripts/install.ps1"), "utf8");

    expect(shell).toContain("npm list -g --depth=0 --parseable @empirical/cli");
    expect(shell.indexOf("npm uninstall -g @empirical/cli"))
      .toBeLessThan(shell.indexOf("npm install -g empirical-sdd@latest"));
    expect(powershell).toContain('npm list -g --depth=0 --parseable "@empirical/cli"');
    expect(powershell.indexOf('npm uninstall -g "@empirical/cli"'))
      .toBeLessThan(powershell.indexOf("npm install -g empirical-sdd@latest"));
  });

  test("template examples inside HTML comments are not acceptance criteria", () => {
    expect(parseCriteria("<!--\n- [ ] [AC-1] Example only.\n-->\n")).toEqual([]);
  });

  test("wrapped acceptance criteria remain complete in human action packets", () => {
    expect(parseCriteria(
      "- [ ] [AC-1] The CLI, MCP, and API return the same packet\n"
      + "  without creating a feature, event, or revision.\n",
    )).toEqual([{
      id: "AC-1",
      text: "The CLI, MCP, and API return the same packet without creating a feature, event, or revision.",
      ui: false,
      checked: false,
    }]);
  });

  test("idle packets do not advertise an available completion", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });

    expect((await project.next()).completion).toEqual({
      available: false,
      mcpTool: "empirical_complete",
      cli: "",
      requiredFields: [],
    });
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
    expect(await readFile(join(root, "AGENTS.md"), "utf8")).toContain("empirical_loop");
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

  test("init installs repeatable agent skills and commands without overwriting unmanaged files", async () => {
    const root = await temporaryProject();
    const managedPaths = [
      ".agents/skills/empirical/SKILL.md",
      ".claude/skills/empirical/SKILL.md",
      ".cursor/commands/empirical.md",
      ".gemini/commands/empirical.toml",
      ".windsurf/workflows/empirical.md",
    ];

    const first = await EmpiricalProject.initialize(root);
    for (const path of managedPaths) expect(first.integrations.created).toContain(path);

    const agentsSkill = await readFile(join(root, managedPaths[0]!), "utf8");
    const claudeSkill = await readFile(join(root, managedPaths[1]!), "utf8");
    expect(claudeSkill).toBe(agentsSkill);
    expect(agentsSkill).toContain("empirical_fast");
    expect(agentsSkill).toContain("empirical_complex");
    expect(agentsSkill).toContain("empirical_explore");
    expect(agentsSkill).toContain("original five Socratic passes");
    expect(agentsSkill).toContain("Ask one question at a time");
    expect(agentsSkill).toContain("wait for explicit human approval");
    expect(agentsSkill).toContain("empirical_loop");
    expect(agentsSkill).toContain("explicit packet workstream");
    expect(agentsSkill).toContain("archive validated deltas");
    expect(agentsSkill).toContain("Choose Complex otherwise");
    expect(agentsSkill).not.toContain("--profile");
    expect(agentsSkill).not.toContain("--json");
    const instructionPaths = ["AGENTS.md", "CLAUDE.md", "GEMINI.md", ...managedPaths];
    for (const path of instructionPaths) {
      const instruction = await readFile(join(root, path), "utf8");
      expect(instruction).toContain('empirical explore "<idea>"');
      expect(instruction).toContain('empirical explore "<idea>" --agent codex');
      expect(instruction).toContain('empirical fast "<request>"');
      expect(instruction).toContain('empirical complex "<request>"');
      expect(instruction).toContain("empirical workstream create <name>");
      expect(instruction).toContain("empirical loop [--workstream <name>]");
    }
    for (const path of managedPaths.slice(2)) {
      expect(await readFile(join(root, path), "utf8")).toContain("empirical-sdd:managed-file");
    }

    const original = await Promise.all(
      managedPaths.map((path) => readFile(join(root, path), "utf8")),
    );
    await EmpiricalProject.initialize(root);
    const repeated = await Promise.all(
      managedPaths.map((path) => readFile(join(root, path), "utf8")),
    );
    expect(repeated).toEqual(original);

    const stalePath = ".cursor/commands/empirical.md";
    const conflictPath = ".windsurf/workflows/empirical.md";
    await writeFile(
      join(root, stalePath),
      "<!-- empirical-sdd:managed-file -->\nStale managed command.\n",
      "utf8",
    );
    await writeFile(join(root, conflictPath), "# Keep my custom workflow\n", "utf8");

    const refreshed = await EmpiricalProject.initialize(root);
    expect(refreshed.integrations.updated).toContain(stalePath);
    expect(await readFile(join(root, stalePath), "utf8")).toBe(original[2]);
    expect(refreshed.integrations.preserved).toContain(
      `${conflictPath} (existing unmanaged file)`,
    );
    expect(await readFile(join(root, conflictPath), "utf8")).toBe("# Keep my custom workflow\n");
  });

  test("integration refresh preserves files with unmatched managed markers", async () => {
    const root = await temporaryProject();
    const markdown = "<!-- empirical-sdd:start -->\n# Keep all of this user text\n";
    const codex = "# empirical-sdd:mcp:end\n# Keep this Codex configuration\n";
    await writeFile(join(root, "AGENTS.md"), markdown, "utf8");
    await mkdir(join(root, ".codex"), { recursive: true });
    await writeFile(join(root, ".codex/config.toml"), codex, "utf8");

    const first = await EmpiricalProject.initialize(root);
    const second = await EmpiricalProject.initialize(root);

    for (const result of [first, second]) {
      expect(result.integrations.preserved).toContain("AGENTS.md (unmatched Empirical marker)");
      expect(result.integrations.preserved).toContain(
        ".codex/config.toml (unmatched Empirical marker)",
      );
    }
    expect(await readFile(join(root, "AGENTS.md"), "utf8")).toBe(markdown);
    expect(await readFile(join(root, ".codex/config.toml"), "utf8")).toBe(codex);
  });

  test("integration refresh preserves files with duplicate managed markers", async () => {
    const root = await temporaryProject();
    const markdown = [
      "<!-- empirical-sdd:start -->",
      "# Keep text before the duplicate",
      "<!-- empirical-sdd:start -->",
      "# Keep text after the duplicate",
      "<!-- empirical-sdd:end -->",
      "",
    ].join("\n");
    const codex = [
      "# empirical-sdd:mcp:start",
      "# Keep text before the duplicate",
      "# empirical-sdd:mcp:start",
      "# Keep text after the duplicate",
      "# empirical-sdd:mcp:end",
      "",
    ].join("\n");
    await writeFile(join(root, "AGENTS.md"), markdown, "utf8");
    await mkdir(join(root, ".codex"), { recursive: true });
    await writeFile(join(root, ".codex/config.toml"), codex, "utf8");

    const first = await EmpiricalProject.initialize(root);
    const second = await EmpiricalProject.initialize(root);

    for (const result of [first, second]) {
      expect(result.integrations.preserved).toContain("AGENTS.md (unmatched Empirical marker)");
      expect(result.integrations.preserved).toContain(
        ".codex/config.toml (unmatched Empirical marker)",
      );
    }
    expect(await readFile(join(root, "AGENTS.md"), "utf8")).toBe(markdown);
    expect(await readFile(join(root, ".codex/config.toml"), "utf8")).toBe(codex);
  });

  test("integration refresh preserves restrictive modes and symbolic links", async () => {
    const root = await temporaryProject();
    const agentsPath = join(root, "AGENTS.md");
    await writeFile(agentsPath, "# Private instructions\n", "utf8");
    await chmod(agentsPath, 0o600);

    if (process.platform !== "win32") {
      await writeFile(join(root, "shared-claude.md"), "# Shared instructions\n", "utf8");
      await symlink("shared-claude.md", join(root, "CLAUDE.md"));
    }

    const result = await EmpiricalProject.initialize(root);

    if (process.platform !== "win32") {
      expect((await stat(agentsPath)).mode & 0o777).toBe(0o600);
      expect((await lstat(join(root, "CLAUDE.md"))).isSymbolicLink()).toBe(true);
      expect(await readFile(join(root, "shared-claude.md"), "utf8")).toBe("# Shared instructions\n");
      expect(result.integrations.preserved).toContain("CLAUDE.md (symbolic link)");
    }
  });

  test("Fast starts at implementation and finishes with test and review evidence", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, {
      profile: "fast",
      integrations: false,
    });
    const request = "Add a hello command that prints Hello from Empirical";
    const action = await project.start(request);

    expect(action).toMatchObject({
      profile: "fast",
      phase: "implement",
      status: "waiting",
      revision: 1,
      acceptanceCriteria: [{ id: "AC-1", text: request, ui: false, checked: false }],
      requiredEvidence: ["test", "review"],
    });
    expect(action.completion.requiredFields).toContain("evidence");
    expect(action.completion.cli).toContain('--test "<test result>" --review "<diff review>"');
    expect(action.completion.cli).not.toContain("evidence.json");

    await expect(project.complete({
      revision: 1,
      outcome: "passed",
      summary: "Reviewed only",
      evidence: [
        { criterionId: "all", kind: "review", passed: true, summary: "Diff is focused" },
      ],
    })).rejects.toThrow("AC-1 has no passing test evidence");

    await expect(project.complete({
      revision: 1,
      outcome: "passed",
      summary: "Tested only",
      evidence: [
        { criterionId: "AC-1", kind: "test", passed: true, summary: "Focused test passed" },
      ],
    })).rejects.toThrow("No passing code review evidence");

    const done = await project.complete({
      revision: 1,
      outcome: "passed",
      summary: "Implemented, tested, and reviewed",
      evidence: [
        { criterionId: "AC-1", kind: "test", passed: true, summary: "Focused test passed" },
        { criterionId: "all", kind: "review", passed: true, summary: "Diff is focused" },
      ],
    });
    expect(done).toMatchObject({ phase: "done", status: "done", revision: 2 });
    expect(await project.verify()).toEqual({ valid: true, phase: "done", criteria: 1, missing: [] });
  });

  test("Fast preserves AC-1 when the request contains an unclosed HTML comment opener", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, {
      profile: "fast",
      integrations: false,
    });
    const request = "Print the literal <!-- without closing it";

    const action = await project.start(request);
    expect(action.request).toBe(request);
    expect(action.acceptanceCriteria).toHaveLength(1);
    expect(action.acceptanceCriteria[0]).toMatchObject({
      id: "AC-1",
      text: "Print the literal &lt;!-- without closing it",
    });
  });

  test("verification invalidates evidence when the completed specification changes", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, {
      profile: "fast",
      integrations: false,
    });
    const action = await project.start("Add one stable output");
    await project.complete({
      revision: action.revision,
      outcome: "passed",
      summary: "Implemented, tested, and reviewed",
      evidence: [
        { criterionId: "AC-1", kind: "test", passed: true, summary: "Focused test passed" },
        { criterionId: "all", kind: "review", passed: true, summary: "Diff reviewed" },
      ],
    });

    const specPath = join(root, ".empirical/specs", action.feature!, "spec.md");
    await writeFile(
      specPath,
      `${await readFile(specPath, "utf8")}\n- [ ] [AC-2] A second behavior appears.\n`,
      "utf8",
    );

    expect(await project.verify()).toMatchObject({
      valid: false,
      missing: expect.arrayContaining([
        "AC-2 has no passing test evidence",
        "Specification changed after the last completed revision",
      ]),
    });
  });

  test("Quick rejects specification edits at implement, verify, and review completion", async () => {
    for (const target of ["implement", "verify", "review"] as const) {
      const root = await temporaryProject();
      const request = `Exercise the ${target} specification guard`;
      const feature = `001-exercise-the-${target}-specification-guard`;
      const project = await seedLegacyWorkflow(root, "quick", request, feature);
      let action = await project.loop();
      const specPath = join(root, ".empirical/specs", action.feature!, "spec.md");
      await writeFile(
        specPath,
        `# Guard\n\n## Acceptance Criteria\n\n- [ ] [AC-1] The guarded behavior works.\n`,
        "utf8",
      );
      action = await project.complete({
        revision: action.revision,
        outcome: "passed",
        summary: "Shaped the stable specification",
      });

      if (target !== "implement") {
        action = await project.complete({
          revision: action.revision,
          outcome: "passed",
          summary: "Implemented the stable specification",
        });
      }
      if (target === "review") {
        action = await project.complete({
          revision: action.revision,
          outcome: "passed",
          summary: "Verified the stable specification",
          evidence: [
            { criterionId: "AC-1", kind: "test", passed: true, summary: "Focused test passed" },
          ],
        });
      }
      expect(action.phase).toBe(target);

      await writeFile(
        specPath,
        `${await readFile(specPath, "utf8")}\nThe specification was edited after shaping.\n`,
        "utf8",
      );
      const evidence = target === "verify"
        ? [{ criterionId: "AC-1", kind: "test" as const, passed: true, summary: "Focused test passed" }]
        : target === "review"
          ? [{ criterionId: "all", kind: "review" as const, passed: true, summary: "Diff reviewed" }]
          : undefined;

      await expect(project.complete({
        revision: action.revision,
        outcome: "passed",
        summary: `Attempted ${target} completion against an edited specification`,
        evidence,
      })).rejects.toMatchObject({ code: "SPEC_CHANGED" });
      expect((await project.status()).revision).toBe(action.revision);
    }
  });

  test("legacy Strong state normalizes to Complex and rejects later specification edits", async () => {
    const root = await temporaryProject();
    const request = "Exercise the legacy specification guard";
    const project = await seedLegacyWorkflow(
      root,
      "strong",
      request,
      "001-exercise-the-legacy-specification-guard",
    );
    let action = await project.loop();
    expect(action.profile).toBe("complex");
    expect(await project.loop()).toEqual(action);
    expect(await project.complex(action.request!)).toEqual(action);
    const featureDirectory = join(root, ".empirical/specs", action.feature!);
    const specPath = join(featureDirectory, "spec.md");
    await writeFile(
      specPath,
      "# Guard\n\n## Acceptance Criteria\n\n- [ ] [AC-1] The guarded behavior works.\n",
      "utf8",
    );
    action = await project.complete({
      revision: action.revision,
      outcome: "passed",
      summary: "Specified the stable behavior",
    });
    await writeFile(join(featureDirectory, "design.md"), "# Design\n\nKeep the change local.\n", "utf8");
    action = await project.complete({
      revision: action.revision,
      outcome: "passed",
      summary: "Designed the stable behavior",
    });
    await writeFile(join(featureDirectory, "plan.md"), "# Plan\n\n1. Implement it.\n", "utf8");
    action = await project.complete({
      revision: action.revision,
      outcome: "passed",
      summary: "Planned the stable behavior",
    });
    expect(action.phase).toBe("implement");

    await writeFile(
      specPath,
      `${await readFile(specPath, "utf8")}\nThe specification was edited after specify.\n`,
      "utf8",
    );
    await expect(project.complete({
      revision: action.revision,
      outcome: "passed",
      summary: "Attempted implementation completion against an edited specification",
    })).rejects.toMatchObject({ code: "SPEC_CHANGED" });
    expect((await project.status()).revision).toBe(action.revision);
  });

  test("Fast UI criteria require browser and screenshot evidence with a real artifact", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, {
      profile: "fast",
      integrations: false,
    });
    const action = await project.start("Add a [UI] welcome banner");
    expect(action.requiredEvidence).toEqual(["test", "browser", "screenshot", "review"]);

    await expect(project.complete({
      revision: 1,
      outcome: "passed",
      summary: "Missing UI proof",
      evidence: [
        { criterionId: "AC-1", kind: "test", passed: true, summary: "Component test passed" },
        { criterionId: "all", kind: "review", passed: true, summary: "Diff reviewed" },
      ],
    })).rejects.toThrow("AC-1 has no browser evidence");

    await expect(project.complete({
      revision: 1,
      outcome: "passed",
      summary: "Screenshot has no artifact",
      evidence: [
        { criterionId: "AC-1", kind: "test", passed: true, summary: "Component test passed" },
        { criterionId: "AC-1", kind: "browser", passed: true, summary: "Browser flow passed" },
        { criterionId: "AC-1", kind: "screenshot", passed: true, summary: "Banner shown" },
        { criterionId: "all", kind: "review", passed: true, summary: "Diff reviewed" },
      ],
    })).rejects.toThrow("AC-1 has no screenshot artifact");

    const artifact = `.empirical/specs/${action.feature}/welcome.png`;
    const evidence = [
      { criterionId: "AC-1", kind: "test" as const, passed: true, summary: "Component test passed" },
      { criterionId: "AC-1", kind: "browser" as const, passed: true, summary: "Browser flow passed" },
      {
        criterionId: "AC-1",
        kind: "screenshot" as const,
        passed: true,
        summary: "Banner shown",
        artifact,
      },
      { criterionId: "all", kind: "review" as const, passed: true, summary: "Diff reviewed" },
    ];
    await expect(project.complete({
      revision: 1,
      outcome: "passed",
      summary: "Artifact path does not exist",
      evidence,
    })).rejects.toThrow(`Screenshot artifact does not exist: ${artifact}`);

    await writeFile(join(root, artifact), "screenshot fixture", "utf8");
    const done = await project.complete({
      revision: 1,
      outcome: "passed",
      summary: "UI behavior tested and reviewed",
      evidence,
    });
    expect(done).toMatchObject({ phase: "done", status: "done", revision: 2 });
  });

  test("a reported Fast failure escalates in place to Complex specification", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, {
      profile: "fast",
      integrations: false,
    });
    const started = await project.start("Update one configuration value");
    const escalated = await project.complete({
      revision: started.revision,
      outcome: "failed",
      summary: "The change is broader than Fast allows",
    });

    expect(escalated).toMatchObject({
      feature: started.feature,
      request: started.request,
      profile: "complex",
      phase: "specify",
      status: "waiting",
      revision: 2,
      requiredEvidence: [],
    });
    expect((await project.status()).repairAttempts).toBe(0);
  });

  test("Fast and Complex start SDD workflows while loop only resumes current state", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const fastRequest = "Add a repository-local hello command";

    const idle = await project.loop();
    expect(idle).toMatchObject({ request: null, profile: "complex", phase: "idle", revision: 0 });
    expect(await project.next()).toEqual(idle);
    expect(await project.status()).toMatchObject({ activeFeature: null, revision: 0 });

    const unsafeLoop = project.loop.bind(project) as (...args: unknown[]) => Promise<unknown>;
    await expect(unsafeLoop(fastRequest)).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    expect((await project.status()).revision).toBe(0);
    const unsafeStart = project.start.bind(project) as (
      request: string,
      options: { profile: string },
    ) => Promise<unknown>;
    await expect(unsafeStart("Do not start legacy Quick", { profile: "quick" }))
      .rejects.toMatchObject({ code: "INVALID_PROFILE" });
    expect((await project.status()).revision).toBe(0);

    const started = await project.fast(fastRequest);
    expect(started).toMatchObject({
      request: fastRequest,
      profile: "fast",
      phase: "implement",
      revision: 1,
    });
    expect(await project.fast(fastRequest)).toEqual(started);
    expect(await project.loop()).toEqual(started);
    await expect(project.complex(fastRequest)).rejects.toMatchObject({ code: "PROFILE_CONFLICT" });
    await expect(project.fast("Replace the active request"))
      .rejects.toMatchObject({ code: "FEATURE_ACTIVE" });

    const done = await project.complete({
      revision: started.revision,
      outcome: "passed",
      summary: "Implemented, tested, and reviewed",
      evidence: [
        { criterionId: "AC-1", kind: "test", passed: true, summary: "Focused test passed" },
        { criterionId: "all", kind: "review", passed: true, summary: "Diff reviewed" },
      ],
    });
    expect(await project.loop()).toEqual(done);
    expect(await project.fast(fastRequest)).toEqual(done);

    const complexRequest = "Replace the project authentication architecture";
    const next = await project.complex(complexRequest);
    expect(next).toMatchObject({
      request: complexRequest,
      profile: "complex",
      phase: "specify",
      status: "waiting",
      revision: 3,
    });
    expect(next.feature).not.toBe(done.feature);
    expect(await project.complex(complexRequest)).toEqual(next);
    expect(await project.loop()).toEqual(next);
  });

  test("concurrent identical Fast starters converge on one action and one specification", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const request = "Add one deterministic output command";

    const actions = await Promise.all(
      Array.from({ length: 8 }, () => project.fast(request)),
    );
    for (const action of actions) expect(action).toEqual(actions[0]);

    const feature = actions[0]!.feature!;
    expect(await readdir(join(root, ".empirical/specs"))).toEqual([feature]);
    expect(await readFile(join(root, ".empirical/specs", feature, "spec.md"), "utf8"))
      .toContain(`- [ ] [AC-1] ${request}`);
    expect(await project.status()).toMatchObject({
      revision: 1,
      activeFeature: feature,
      request,
    });
  });

  test("concurrent different requests sharing an id cannot split state from its specification", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const id = "shared-explicit-id";
    const requests = ["Create the alpha output", "Remove the beta cache"] as const;

    const results = await Promise.allSettled(
      requests.map((request) => project.fast(request, { id })),
    );
    const fulfilled = results.find((result) => result.status === "fulfilled");
    const rejected = results.find((result) => result.status === "rejected");
    if (!fulfilled || fulfilled.status !== "fulfilled") throw new Error("Expected one Fast starter winner");
    if (!rejected || rejected.status !== "rejected") throw new Error("Expected one Fast starter conflict");

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(rejected.reason).toMatchObject({ code: "FEATURE_ACTIVE" });

    const winningRequest = fulfilled.value.request!;
    const losingRequest = requests.find((request) => request !== winningRequest)!;
    expect(fulfilled.value.feature).toBe(id);
    expect(await project.status()).toMatchObject({
      revision: 1,
      activeFeature: id,
      request: winningRequest,
    });
    expect(await readdir(join(root, ".empirical/specs"))).toEqual([id]);
    const specification = await readFile(
      join(root, ".empirical/specs", id, "spec.md"),
      "utf8",
    );
    expect(specification).toContain(`- [ ] [AC-1] ${winningRequest}`);
    expect(specification).not.toContain(losingRequest);
  });

  test("a superseded stale lock owner cannot remove the current owner's lock", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const peer = await EmpiricalProject.open(root);
    const lockPath = join(root, ".empirical/state.lock");

    let enterFirst!: () => void;
    let releaseFirst!: () => void;
    let enterSecond!: () => void;
    let releaseSecond!: () => void;
    const firstEntered = new Promise<void>((resolve) => { enterFirst = resolve; });
    const firstReleased = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const secondEntered = new Promise<void>((resolve) => { enterSecond = resolve; });
    const secondReleased = new Promise<void>((resolve) => { releaseSecond = resolve; });

    const first = project.store.transaction(async (state) => {
      enterFirst();
      await firstReleased;
      return { actor: "first", summary: "First owner", state, value: undefined };
    });
    await firstEntered;
    await writeFile(
      lockPath,
      `${JSON.stringify({ pid: 2_147_483_647, token: "orphaned-owner" })}\n`,
      "utf8",
    );
    const staleTime = new Date(Date.now() - 31_000);
    await utimes(lockPath, staleTime, staleTime);

    const second = peer.store.transaction(async (state) => {
      enterSecond();
      await secondReleased;
      return { actor: "second", summary: "Second owner", state, value: undefined };
    });
    await secondEntered;

    releaseFirst();
    await first;
    const currentOwnerStillLocked = await stat(lockPath).then(() => true, () => false);
    releaseSecond();
    await second;

    expect(currentOwnerStillLocked).toBe(true);
  });

  test("lock acquisition retries only expected contention and Windows sharing violations", () => {
    expect(isRetryableLockOpenError({ code: "EEXIST" }, "linux")).toBe(true);
    expect(isRetryableLockOpenError({ code: "EPERM" }, "win32")).toBe(true);
    expect(isRetryableLockOpenError({ code: "EACCES" }, "win32")).toBe(true);
    expect(isRetryableLockOpenError({ code: "EPERM" }, "linux")).toBe(false);
    expect(isRetryableLockOpenError({ code: "EACCES" }, "darwin")).toBe(false);
    expect(isRetryableLockOpenError({ code: "ENOENT" }, "win32")).toBe(false);
  });

  test("concurrent clients recover one abandoned stale lock without splitting state", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const lockPath = join(root, ".empirical/state.lock");
    await writeFile(
      lockPath,
      `${JSON.stringify({ pid: 2_147_483_647, token: "abandoned-owner" })}\n`,
      "utf8",
    );
    const staleTime = new Date(Date.now() - 31_000);
    await utimes(lockPath, staleTime, staleTime);

    const request = "Add one command after stale-lock recovery";
    const clients = await Promise.all(
      Array.from({ length: 8 }, async () => {
        const peer = await EmpiricalProject.open(root);
        return peer.fast(request);
      }),
    );

    for (const action of clients) expect(action).toEqual(clients[0]);
    expect(await project.status()).toMatchObject({ revision: 1, request });
    expect(await stat(lockPath).then(() => true, () => false)).toBe(false);
    expect(await stat(`${lockPath}.recovery`).then(() => true, () => false)).toBe(false);
  });

  test("an abandoned stale recovery lock cannot permanently wedge the project", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const lockPath = join(root, ".empirical/state.lock");
    const staleTime = new Date(Date.now() - 31_000);
    for (const [path, token] of [
      [lockPath, "abandoned-owner"],
      [`${lockPath}.recovery`, "abandoned-recovery"],
    ] as const) {
      await writeFile(
        path,
        `${JSON.stringify({ pid: 2_147_483_647, token })}\n`,
        "utf8",
      );
      await utimes(path, staleTime, staleTime);
    }

    const action = await project.fast("Recover after an interrupted lock cleanup");

    expect(action).toMatchObject({ revision: 1, phase: "implement", profile: "fast" });
    expect(await stat(lockPath).then(() => true, () => false)).toBe(false);
    expect(await stat(`${lockPath}.recovery`).then(() => true, () => false)).toBe(false);
  });

  test("schema 1 projects are readable and migrate explicitly or during a normal mutation", async () => {
    const downgradeToSchemaOne = async (root: string) => {
      for (const name of ["config.json", "state.json"]) {
        const path = join(root, ".empirical", name);
        const document = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
        document.schemaVersion = 1;
        if (name === "state.json") {
          delete document.capabilityArchiveRequired;
          delete document.capabilityDeltaDigest;
        }
        await writeFile(path, `${JSON.stringify(document, null, 2)}\n`, "utf8");
      }
    };

    const migrateRoot = await temporaryProject();
    const { project: migrateProject } = await EmpiricalProject.initialize(migrateRoot, {
      integrations: false,
    });
    await downgradeToSchemaOne(migrateRoot);

    expect((await migrateProject.config()).schemaVersion).toBe(3);
    expect((await migrateProject.status()).schemaVersion).toBe(3);
    expect(await migrateProject.status()).toMatchObject({
      capabilityArchiveRequired: false,
      capabilityDeltaDigest: null,
    });
    expect(await migrateProject.migrate()).toMatchObject({
      changed: true,
      migrations: [{
        workstream: "default",
        from: { config: 1, state: 1 },
        to: 3,
      }],
      schemaVersion: 3,
    });
    expect(JSON.parse(await readFile(join(migrateRoot, ".empirical/config.json"), "utf8")).schemaVersion)
      .toBe(3);
    expect(JSON.parse(await readFile(join(migrateRoot, ".empirical/state.json"), "utf8")).schemaVersion)
      .toBe(3);
    expect(JSON.parse(await readFile(join(migrateRoot, ".empirical/workstreams.json"), "utf8")))
      .toMatchObject({ selected: "default", workstreams: { default: {} } });
    expect(JSON.parse(await readFile(join(migrateRoot, ".empirical/policy.json"), "utf8")))
      .toMatchObject({ schemaVersion: 1, context: [], phases: {} });

    const mutateRoot = await temporaryProject();
    const { project: mutateProject } = await EmpiricalProject.initialize(mutateRoot, {
      integrations: false,
    });
    await downgradeToSchemaOne(mutateRoot);
    await mutateProject.fast("Add a small schema-upgrade check");

    expect(JSON.parse(await readFile(join(mutateRoot, ".empirical/config.json"), "utf8")).schemaVersion)
      .toBe(3);
    expect(JSON.parse(await readFile(join(mutateRoot, ".empirical/state.json"), "utf8")).schemaVersion)
      .toBe(3);
  });

  test("a newer event schema requires migration instead of being ignored", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    const initialEvent = JSON.parse(
      await readFile(join(root, ".empirical/events/00000000.json"), "utf8"),
    ) as Record<string, unknown>;
    await writeFile(
      join(root, ".empirical/events/00000001.json"),
      `${JSON.stringify({
        ...initialEvent,
        schemaVersion: 999,
        revision: 1,
        previousRevision: 0,
      }, null, 2)}\n`,
      "utf8",
    );

    await expect(project.status()).rejects.toMatchObject({ code: "MIGRATION_REQUIRED" });
  });

  test("Quick runs shape through evidenced verification and review", async () => {
    const root = await temporaryProject();
    const project = await seedLegacyWorkflow(
      root,
      "quick",
      "Add a dark mode toggle",
      "001-add-a-dark-mode-toggle",
    );
    let action = await project.loop();
    expect(action.phase).toBe("shape");
    expect(action.revision).toBe(1);
    expect(await project.loop()).toEqual(action);
    await expect(project.fast(action.request!)).rejects.toMatchObject({ code: "PROFILE_CONFLICT" });
    await expect(project.complex(action.request!)).rejects.toMatchObject({ code: "PROFILE_CONFLICT" });

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
        { criterionId: "AC-UI-1", kind: "test", passed: true, summary: "Theme toggle test passed" },
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

  test("Complex requires design and plan artifacts", async () => {
    const root = await temporaryProject();
    const { project } = await EmpiricalProject.initialize(root, { integrations: false });
    let action = await project.complex("Replace authentication");
    expect(action.profile).toBe("complex");
    const directory = join(root, ".empirical/specs", action.feature!);
    await writeFile(
      join(directory, "spec.md"),
      "# Auth\n\n## Acceptance Criteria\n- [ ] [AC-1] Existing users can sign in.\n",
      "utf8",
    );
    await writeAddedDelta(root, action.feature!, "authentication", "Existing users can sign in");
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
    await writeAddedDelta(root, action.feature!, "report-export", "A report can be exported");
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
