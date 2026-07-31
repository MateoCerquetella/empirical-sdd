import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  AGENT_CATALOG_SOURCE,
  AGENT_SKILL_TARGETS,
  agentSkillTarget,
  agentSkillTargetPath,
  detectAgentSkillTargets,
  globalAgentSkillTargets,
  resolveAgentSkillTargetId,
  validateAgentSkillCatalog,
} from "../src/agent-catalog.js";

describe("agent skill catalog", () => {
  test("pins the audited upstream catalog with safe global coverage", () => {
    expect(AGENT_CATALOG_SOURCE).toEqual({
      repository: "https://github.com/vercel-labs/skills",
      version: "1.5.21",
      commit: "7cb7db64dc1201052dea305e508a2fc490f7e5e2",
    });
    expect(AGENT_SKILL_TARGETS).toHaveLength(75);
    expect(globalAgentSkillTargets()).toHaveLength(73);
    expect(validateAgentSkillCatalog()).toEqual([]);
    expect(createHash("sha256").update(AGENT_SKILL_TARGETS
      .map((target) => `${target.id}\t${target.globalSkillPath ?? "-"}`)
      .join("\n")).digest("hex"))
      .toBe("d4bbdfafa2d9fa016b44f39b1b6315ea26bd89977142872e6e2b59364a1fef28");
    expect(agentSkillTarget("eve").exclusionReason).toContain("project-local");
    expect(agentSkillTarget("promptscript").exclusionReason).toContain("project-local");
  });

  test("keeps legacy ids as aliases while reports use canonical upstream ids", () => {
    expect(resolveAgentSkillTargetId("claude")).toBe("claude-code");
    expect(resolveAgentSkillTargetId("CLAUDE-CODE")).toBe("claude-code");
    expect(resolveAgentSkillTargetId("gemini")).toBe("gemini-cli");
    expect(resolveAgentSkillTargetId("codex")).toBe("codex");
    expect(resolveAgentSkillTargetId("unknown-agent")).toBeNull();
  });

  test("models shared destinations without broadening handoff capability", () => {
    const shared = globalAgentSkillTargets()
      .filter((target) => target.globalSkillPath === ".agents/skills")
      .map((target) => target.id);
    expect(shared).toEqual(["cline", "dexto", "kimi-code-cli", "loaf", "warp", "zed"]);
    expect(agentSkillTarget("cline").handoff).not.toBe(true);
    expect(agentSkillTarget("codex").handoff).toBe(true);
    expect(agentSkillTarget("codex").projectMcp).toBe(true);
  });

  test("resolves destinations inside the supplied home and detects conservatively", async () => {
    const home = await mkdtemp(join(tmpdir(), "empirical-agent-catalog-"));
    try {
      await mkdir(join(home, ".codebuddy"), { recursive: true });
      const detected = await detectAgentSkillTargets({ homeRoot: home, pathValue: "" });
      expect(detected).toEqual(["codebuddy"]);
      expect(agentSkillTargetPath(home, agentSkillTarget("codebuddy") as ReturnType<typeof globalAgentSkillTargets>[number]))
        .toBe(join(home, ".codebuddy", "skills"));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
