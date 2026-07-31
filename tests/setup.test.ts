import { describe, expect, test } from "bun:test";
import {
  recommendedSetupSettings,
  renderSetupSummary,
  setupConfigurationInput,
  validateSetupSettings,
} from "../src/setup.js";

describe("setup settings", () => {
  test("renders every safe default before persistence", () => {
    const settings = recommendedSetupSettings();
    const summary = renderSetupSummary(settings, { current: false, resolvedBase: "main" });
    expect(summary).toContain("Recommended settings");
    expect(summary).toContain("Acceptance-test evidence for every criterion  on · recommended");
    expect(summary).toContain("Real-browser evidence for [UI] criteria  on");
    expect(summary).toContain("Screenshot artifact for [UI] criteria  on");
    expect(summary).toContain("Independent code-review evidence  on");
    expect(summary).toContain("Base: auto (currently main)");
    expect(summary).toContain("Path: ../{repo}-{feature}");
    expect(summary).toContain("Branch: {type}/{feature}");
    expect(summary).toContain("Require reviewable decision records for Complex work");
    expect(setupConfigurationInput(settings)).toMatchObject({ setupComplete: true, evidence: { required: true } });
  });

  test("explains inactive UI sub-policies without erasing them", () => {
    const settings = recommendedSetupSettings();
    settings.evidence.required = false;
    const summary = renderSetupSummary(settings, { current: true });
    expect(summary).toContain("Current settings");
    expect(summary).toContain("Real-browser evidence for [UI] criteria  on · inactive");
    expect(summary).toContain("values stay saved");
    expect(summary).toContain("Code review remains independent");
    expect(settings.evidence.browserForUi).toBe(true);
    expect(settings.evidence.screenshotForUi).toBe(true);
    expect(renderSetupSummary(settings, { current: false, effective: true })).toContain("Effective settings");
  });

  test("validates path and branch templates before save", () => {
    const settings = recommendedSetupSettings();
    expect(() => validateSetupSettings(settings)).not.toThrow();
    settings.isolation.worktreePath = "../fixed";
    expect(() => validateSetupSettings(settings)).toThrow("Worktree path template must contain {feature}");
    settings.isolation.worktreePath = "../{feature}";
    settings.isolation.branchPattern = "feature/{feature}";
    expect(() => validateSetupSettings(settings)).toThrow("Branch pattern must contain {type} and {feature}");
  });
});
