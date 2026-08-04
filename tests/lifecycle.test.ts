import { describe, expect, test } from "bun:test";
import {
  isUninstallConfirmed,
  uninstallEmpirical,
  updateEmpirical,
  type LifecycleRunner,
} from "../src/lifecycle.js";

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

  test("uninstall removes the exact global package through the platform npm executable", () => {
    const calls: Array<[string, string[]]> = [];
    const report = uninstallEmpirical((command, args) => {
      calls.push([command, args]);
      return { status: 0 };
    });
    expect(report).toEqual({ package: "removed" });
    expect(calls).toEqual([[
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["uninstall", "-g", "empirical-sdd"],
    ]]);
  });

  test("uninstall reports package-stage failure after managed cleanup may have occurred", () => {
    expect(() => uninstallEmpirical(() => ({ status: 9 })))
      .toThrow("npm package uninstall failed with exit status 9. Managed agent skills may already have been removed");
  });

  test("uninstall confirmation defaults closed and accepts only an explicit yes", () => {
    for (const answer of ["", "n", "no", "cancel", "true", "1"]) {
      expect(isUninstallConfirmed(answer)).toBe(false);
    }
    for (const answer of ["y", "Y", "yes", "YES", "  yes  "]) {
      expect(isUninstallConfirmed(answer)).toBe(true);
    }
  });
});
