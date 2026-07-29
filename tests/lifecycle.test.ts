import { describe, expect, test } from "bun:test";
import { updateEmpirical, type LifecycleRunner } from "../src/lifecycle.js";

describe("package lifecycle", () => {
  test("update upgrades the package before refreshing installed agent entrypoints", () => {
    const calls: Array<[string, string[]]> = [];
    const runner: LifecycleRunner = (command, args) => {
      calls.push([command, args]);
      return { status: 0 };
    };
    expect(updateEmpirical(runner)).toEqual({ package: "updated", integrations: "refreshed" });
    expect(calls).toEqual([
      [process.platform === "win32" ? "npm.cmd" : "npm", ["install", "-g", "empirical-sdd@latest"]],
      [process.platform === "win32" ? "empirical.cmd" : "empirical", ["install", "--yes"]],
    ]);
  });

  test("update stops with a stage-specific error when package update fails", () => {
    expect(() => updateEmpirical(() => ({ status: 1 })))
      .toThrow("npm package update failed with exit status 1");
  });

  test("update reports integration refresh failures separately", () => {
    let call = 0;
    expect(() => updateEmpirical(() => ({ status: call++ === 0 ? 0 : 7 })))
      .toThrow("agent integration refresh failed with exit status 7");
  });
});
