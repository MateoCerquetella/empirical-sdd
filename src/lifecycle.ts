import { spawnSync } from "node:child_process";
import { EmpiricalError } from "./errors.js";

export interface LifecycleProcessResult {
  status: number | null;
  error?: Error;
}

export type LifecycleRunner = (command: string, args: string[]) => LifecycleProcessResult;

export interface UpdateReport {
  package: "updated";
  integrations: "refreshed";
}

export interface PackageUninstallReport {
  package: "removed";
}

export function updateEmpirical(runner: LifecycleRunner = runInherited): UpdateReport {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const empirical = process.platform === "win32" ? "empirical.cmd" : "empirical";
  const packageResult = runner(npm, ["install", "-g", "empirical-sdd@latest"]);
  assertStage(packageResult, "UPDATE_PACKAGE_FAILED", "npm package update");
  const integrationResult = runner(empirical, ["install", "--yes"]);
  assertStage(integrationResult, "UPDATE_INTEGRATIONS_FAILED", "agent integration refresh");
  return { package: "updated", integrations: "refreshed" };
}

export function uninstallEmpirical(runner: LifecycleRunner = runInherited): PackageUninstallReport {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = runner(npm, ["uninstall", "-g", "empirical-sdd"]);
  assertStage(
    result,
    "UNINSTALL_PACKAGE_FAILED",
    "npm package uninstall",
    "Managed agent skills may already have been removed; retry the command or run npm uninstall -g empirical-sdd manually.",
  );
  return { package: "removed" };
}

export function isUninstallConfirmed(answer: string): boolean {
  return /^(?:y|yes)$/i.test(answer.trim());
}

function runInherited(command: string, args: string[]): LifecycleProcessResult {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  return { status: result.status, ...(result.error ? { error: result.error } : {}) };
}

function assertStage(
  result: LifecycleProcessResult,
  code: string,
  stage: string,
  remediation?: string,
): void {
  if (!result.error && result.status === 0) return;
  throw new EmpiricalError(
    code,
    `${stage} failed${result.error ? `: ${result.error.message}` : ` with exit status ${String(result.status)}`}${remediation ? `. ${remediation}` : ""}`,
  );
}
