import { chmod, lstat, open, readFile, readdir, rename, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { EmpiricalError } from "./errors.js";
import {
  SCHEMA_VERSION,
  type Profile,
  type ProjectConfig,
  type TransitionEvent,
  type WorkflowState,
} from "./types.js";

const EMPIRICAL_DIR = ".empirical";
const LOCK_STALE_AFTER_MS = 30_000;
const LOCK_WAIT_MS = 5_000;

interface LockSnapshot {
  dev: number;
  ino: number;
  mtimeMs: number;
  token: string | null;
  pid: number | null;
}

export class ProjectStore {
  readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  get directory(): string {
    return join(this.root, EMPIRICAL_DIR);
  }

  get configPath(): string {
    return join(this.directory, "config.json");
  }

  get statePath(): string {
    return join(this.directory, "state.json");
  }

  get eventsDirectory(): string {
    return join(this.directory, "events");
  }

  specDirectory(feature: string): string {
    assertFeatureId(feature);
    return join(this.directory, "specs", feature);
  }

  specPath(feature: string): string {
    return join(this.specDirectory(feature), "spec.md");
  }

  evidencePath(feature: string): string {
    return join(this.specDirectory(feature), "evidence.json");
  }

  async exists(): Promise<boolean> {
    return isFile(this.statePath);
  }

  async ensureLayout(): Promise<void> {
    await mkdir(join(this.directory, "specs"), { recursive: true });
    await mkdir(this.eventsDirectory, { recursive: true });
  }

  async loadConfig(): Promise<ProjectConfig> {
    const config = await readJson<ProjectConfig>(this.configPath, "PROJECT_NOT_INITIALIZED");
    return normalizeConfig(config);
  }

  async loadState(): Promise<WorkflowState> {
    const projected = normalizeState(
      await readJson<WorkflowState>(this.statePath, "PROJECT_NOT_INITIALIZED"),
    );
    const event = await this.latestEvent();
    if (event && event.revision > projected.revision) {
      await writeJsonAtomic(this.statePath, event.state);
      return event.state;
    }
    return projected;
  }

  async writeInitial(config: ProjectConfig, state: WorkflowState): Promise<void> {
    await this.ensureLayout();
    await writeJsonAtomic(this.configPath, config);
    await this.commitInitialState(state, "empirical-init", "Initialized Empirical");
  }

  async transition(
    expectedRevision: number,
    actor: string,
    summary: string,
    mutate: (state: WorkflowState) => WorkflowState,
  ): Promise<WorkflowState> {
    const committed = await this.transaction(async (current) => {
      if (current.revision !== expectedRevision) {
        throw new EmpiricalError(
          "STALE_REVISION",
          `Expected revision ${expectedRevision}, but the project is at ${current.revision}`,
          { expectedRevision, actualRevision: current.revision },
        );
      }
      return {
        actor,
        summary,
        state: mutate(structuredClone(current)),
        value: undefined,
      };
    });
    return committed.state;
  }

  async transaction<T>(
    prepare: (current: WorkflowState) => Promise<{
      actor: string;
      summary: string;
      state: WorkflowState;
      value: T;
      validate?: () => Promise<void>;
    }>,
  ): Promise<{ state: WorkflowState; value: T }> {
    return this.withLock(async () => {
      const current = await this.loadState();
      const prepared = await prepare(structuredClone(current));
      const now = new Date().toISOString();
      const next = prepared.state;
      next.schemaVersion = SCHEMA_VERSION;
      next.revision = current.revision + 1;
      next.updatedAt = now;
      const event: TransitionEvent = {
        schemaVersion: SCHEMA_VERSION,
        revision: next.revision,
        previousRevision: current.revision,
        actor: prepared.actor,
        summary: prepared.summary,
        createdAt: now,
        state: next,
      };
      await this.ensureCurrentConfigSchema();
      await prepared.validate?.();
      await writeJsonAtomic(this.eventPath(event.revision), event);
      await writeJsonAtomic(this.statePath, next);
      return { state: next, value: prepared.value };
    });
  }

  async migrateSchema(): Promise<Record<string, unknown>> {
    return this.withLock(async () => {
      const rawConfig = await readJson<ProjectConfig>(this.configPath, "PROJECT_NOT_INITIALIZED");
      const rawState = await readJson<WorkflowState>(this.statePath, "PROJECT_NOT_INITIALIZED");
      const configVersion = schemaVersion(rawConfig);
      const stateVersion = schemaVersion(rawState);
      const config = normalizeConfig(rawConfig);
      const state = normalizeState(rawState);
      const configChanged = JSON.stringify(rawConfig) !== JSON.stringify(config);
      const stateChanged = JSON.stringify(rawState) !== JSON.stringify(state);
      const changed = configChanged || stateChanged;
      if (configChanged) await writeJsonAtomic(this.configPath, config);
      if (stateChanged) await writeJsonAtomic(this.statePath, state);
      return {
        changed,
        from: { config: configVersion, state: stateVersion },
        to: SCHEMA_VERSION,
      };
    });
  }

  async writeSpec(feature: string, contents: string): Promise<void> {
    const path = this.specPath(feature);
    await mkdir(dirname(path), { recursive: true });
    await writeTextAtomic(path, contents);
  }

  async readSpec(feature: string): Promise<string> {
    try {
      return await readFile(this.specPath(feature), "utf8");
    } catch (error) {
      throw new EmpiricalError("SPEC_NOT_FOUND", `Missing specification for ${feature}`, error);
    }
  }

  async writeEvidence(feature: string, evidence: unknown): Promise<void> {
    await writeJsonAtomic(this.evidencePath(feature), evidence);
  }

  async readEvidence<T>(feature: string): Promise<T[]> {
    if (!(await isFile(this.evidencePath(feature)))) return [];
    return readJson<T[]>(this.evidencePath(feature), "INVALID_EVIDENCE");
  }

  async nextFeatureNumber(): Promise<number> {
    const directory = join(this.directory, "specs");
    await mkdir(directory, { recursive: true });
    const entries = await readdir(directory, { withFileTypes: true });
    const numbers = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => /^([0-9]{3})-/.exec(entry.name)?.[1])
      .filter((value): value is string => value !== undefined)
      .map(Number);
    return (numbers.length === 0 ? 0 : Math.max(...numbers)) + 1;
  }

  private eventPath(revision: number): string {
    return join(this.eventsDirectory, `${String(revision).padStart(8, "0")}.json`);
  }

  private async latestEvent(): Promise<TransitionEvent | null> {
    let names: string[];
    try {
      names = (await readdir(this.eventsDirectory))
        .filter((name) => /^[0-9]{8}\.json$/.test(name))
        .sort();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new EmpiricalError("INVALID_EVENT", `Could not inspect ${this.eventsDirectory}`, error);
    }
    const name = names.at(-1);
    if (!name) return null;
    return normalizeEvent(
      await readJson<TransitionEvent>(join(this.eventsDirectory, name), "INVALID_EVENT"),
    );
  }

  private async commitInitialState(
    state: WorkflowState,
    actor: string,
    summary: string,
  ): Promise<void> {
    const event: TransitionEvent = {
      schemaVersion: SCHEMA_VERSION,
      revision: state.revision,
      previousRevision: -1,
      actor,
      summary,
      createdAt: state.updatedAt,
      state,
    };
    await writeJsonAtomic(this.eventPath(state.revision), event);
    await writeJsonAtomic(this.statePath, state);
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    await mkdir(this.directory, { recursive: true });
    const lockPath = join(this.directory, "state.lock");
    const deadline = Date.now() + LOCK_WAIT_MS;
    const token = randomUUID();
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    let lastError: unknown;
    while (!handle) {
      try {
        handle = await open(lockPath, "wx");
        await handle.writeFile(`${JSON.stringify({ pid: process.pid, token })}\n`, "utf8");
        await handle.sync();
        break;
      } catch (error) {
        lastError = error;
        if (handle) {
          const incomplete = handle;
          handle = undefined;
          const details = await incomplete.stat().catch(() => null);
          const observed = details
            ? await inspectLock(lockPath).catch(() => null)
            : null;
          await incomplete.close().catch(() => undefined);
          if (details && observed && details.dev === observed.dev && details.ino === observed.ino) {
            await removeLockIfUnchanged(lockPath, observed);
          }
          throw error;
        }
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        try {
          const observed = await inspectLock(lockPath);
          if (
            observed
            && Date.now() - observed.mtimeMs > LOCK_STALE_AFTER_MS
            && (observed.pid === null || !processIsAlive(observed.pid))
            && await recoverStaleLock(lockPath, observed)
          ) {
            continue;
          }
        } catch {
          continue;
        }
        if (Date.now() >= deadline) {
          throw new EmpiricalError(
            "PROJECT_BUSY",
            "Another Empirical client is updating this repository; retry shortly",
            lastError,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    const heartbeat = setInterval(() => {
      const now = new Date();
      void handle?.utimes(now, now).catch(() => undefined);
    }, LOCK_STALE_AFTER_MS / 3);
    heartbeat.unref();
    try {
      return await operation();
    } finally {
      clearInterval(heartbeat);
      const owned = await handle.stat().catch(() => null);
      await handle.close();
      if (owned) {
        await removeLockIfUnchanged(lockPath, {
          dev: owned.dev,
          ino: owned.ino,
          mtimeMs: owned.mtimeMs,
          token,
          pid: process.pid,
        });
      }
    }
  }

  private async ensureCurrentConfigSchema(): Promise<void> {
    const raw = await readJson<ProjectConfig>(this.configPath, "PROJECT_NOT_INITIALIZED");
    schemaVersion(raw);
    const normalized = normalizeConfig(raw);
    if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
      await writeJsonAtomic(this.configPath, normalized);
    }
  }
}

async function inspectLock(path: string): Promise<LockSnapshot | null> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(path, "r");
    const details = await handle.stat();
    const raw = await handle.readFile("utf8");
    let token: string | null = null;
    let pid: number | null = null;
    try {
      const owner = JSON.parse(raw) as { token?: unknown; pid?: unknown };
      if (typeof owner.token === "string") token = owner.token;
      if (typeof owner.pid === "number" && Number.isSafeInteger(owner.pid) && owner.pid > 0) {
        pid = owner.pid;
      }
    } catch {
      // Old lock files had no ownership payload and are recoverable only after they become stale.
    }
    return { dev: details.dev, ino: details.ino, mtimeMs: details.mtimeMs, token, pid };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  } finally {
    await handle?.close();
  }
}

async function removeLockIfUnchanged(path: string, expected: LockSnapshot): Promise<boolean> {
  const current = await inspectLock(path);
  if (!current || !sameLock(current, expected)) return false;
  await rm(path, { force: true });
  return true;
}

async function recoverStaleLock(path: string, expected: LockSnapshot): Promise<boolean> {
  const recoveryPath = `${path}.recovery`;
  const recoveryToken = randomUUID();
  let recoveryHandle: Awaited<ReturnType<typeof open>>;
  try {
    recoveryHandle = await open(recoveryPath, "wx");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      const abandoned = await inspectLock(recoveryPath);
      if (
        abandoned
        && Date.now() - abandoned.mtimeMs > LOCK_STALE_AFTER_MS
        && (abandoned.pid === null || !processIsAlive(abandoned.pid))
      ) {
        await removeLockIfUnchanged(recoveryPath, abandoned);
      }
      return false;
    }
    throw error;
  }

  let recoveryOwner: LockSnapshot | null = null;
  try {
    await recoveryHandle.writeFile(
      `${JSON.stringify({ pid: process.pid, token: recoveryToken })}\n`,
      "utf8",
    );
    await recoveryHandle.sync();
    const details = await recoveryHandle.stat();
    recoveryOwner = {
      dev: details.dev,
      ino: details.ino,
      mtimeMs: details.mtimeMs,
      token: recoveryToken,
      pid: process.pid,
    };

    const current = await inspectLock(path);
    if (
      !current
      || !sameLock(current, expected)
      || Date.now() - current.mtimeMs <= LOCK_STALE_AFTER_MS
      || (current.pid !== null && processIsAlive(current.pid))
    ) {
      return false;
    }
    await rm(path, { force: true });
    return true;
  } finally {
    await recoveryHandle.close().catch(() => undefined);
    if (recoveryOwner) await removeLockIfUnchanged(recoveryPath, recoveryOwner);
    else await rm(recoveryPath, { force: true });
  }
}

function sameLock(left: LockSnapshot, right: LockSnapshot): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.token === right.token
    && left.pid === right.pid;
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export async function discoverProject(start: string): Promise<ProjectStore> {
  let current = resolve(start);
  while (true) {
    const store = new ProjectStore(current);
    if (await store.exists()) return store;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new EmpiricalError(
    "PROJECT_NOT_INITIALIZED",
    "No .empirical project found; run empirical init or empirical adopt",
  );
}

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await writeTextAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeTextAtomic(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  const existingMode = await stat(path).then(
    (details) => details.mode & 0o7777,
    () => null,
  );
  try {
    await writeFile(temporary, contents, "utf8");
    if (existingMode !== null) await chmod(temporary, existingMode);
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

export async function isSymbolicLink(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isSymbolicLink();
  } catch {
    return false;
  }
}

export async function readJson<T>(path: string, code = "INVALID_JSON"): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    throw new EmpiricalError(code, `Could not read ${path}`, error);
  }
}

function assertFeatureId(feature: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(feature)) {
    throw new EmpiricalError("INVALID_FEATURE", `Invalid feature id: ${feature}`);
  }
}

function normalizeConfig(config: ProjectConfig): ProjectConfig {
  assertSupportedSchema(config);
  return {
    ...config,
    schemaVersion: SCHEMA_VERSION,
    profile: normalizeProfile((config as { profile?: unknown }).profile),
  };
}

function normalizeState(state: WorkflowState): WorkflowState {
  assertSupportedSchema(state);
  return {
    ...state,
    schemaVersion: SCHEMA_VERSION,
    profile: normalizeProfile((state as { profile?: unknown }).profile),
    specDigest: typeof state.specDigest === "string" ? state.specDigest : null,
  };
}

function normalizeProfile(profile: unknown): Profile {
  if (profile === "strong") return "complex";
  if (profile === "fast" || profile === "complex" || profile === "quick") return profile;
  throw new EmpiricalError("INVALID_PROFILE", `Unknown persisted workflow '${String(profile)}'`);
}

function normalizeEvent(event: TransitionEvent): TransitionEvent {
  assertSupportedSchema(event);
  return {
    ...event,
    schemaVersion: SCHEMA_VERSION,
    state: normalizeState(event.state),
  };
}

function assertSupportedSchema(value: { schemaVersion: number }): void {
  if (value.schemaVersion !== 1 && value.schemaVersion !== SCHEMA_VERSION) {
    throw new EmpiricalError(
      "MIGRATION_REQUIRED",
      `Project schema ${String(value.schemaVersion)} is not supported; run empirical migrate`,
    );
  }
}

function schemaVersion(value: { schemaVersion: number }): number {
  assertSupportedSchema(value);
  return value.schemaVersion;
}
