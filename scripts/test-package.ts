import { mkdtemp, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cache = await mkdtemp(join(tmpdir(), "empirical-npm-cache-"));
try {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["pack", "--dry-run"], {
    cwd: process.cwd(),
    env: { ...process.env, npm_config_cache: cache },
    stdio: "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
} finally {
  await rm(cache, { recursive: true, force: true });
}
