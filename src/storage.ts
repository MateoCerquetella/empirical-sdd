import { chmod, lstat, open, readFile, readdir, rename, rm, rmdir, stat, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { EmpiricalError } from "./errors.js";
import {
  POLICY_SCHEMA_VERSION,
  SCHEMA_VERSION,
  WORKSTREAM_SCHEMA_VERSION,
  type ProjectPolicy,
  type Phase,
  type Profile,
  type ProjectConfig,
  type TransitionEvent,
  type WorkstreamManifest,
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
  readonly workstream: string;

  constructor(root: string, workstream = "default") {
    this.root = resolve(root);
    assertWorkstreamId(workstream);
    this.workstream = workstream;
  }

  get directory(): string {
    return join(this.root, EMPIRICAL_DIR);
  }

  get configPath(): string {
    return join(this.directory, "config.json");
  }

  get workstreamsPath(): string {
    return join(this.directory, "workstreams.json");
  }

  get policyPath(): string {
    return join(this.directory, "policy.json");
  }

  get stateDirectory(): string {
    return this.workstream === "default"
      ? this.directory
      : join(this.directory, "workstreams", this.workstream);
  }

  get statePath(): string {
    return join(this.stateDirectory, "state.json");
  }

  get eventsDirectory(): string {
    return join(this.stateDirectory, "events");
  }

  get capabilitiesDirectory(): string {
    return join(this.directory, "capabilities");
  }

  forWorkstream(workstream: string): ProjectStore {
    return new ProjectStore(this.root, workstream);
  }

  capabilityDirectory(capability: string): string {
    assertCapabilityId(capability);
    return join(this.capabilitiesDirectory, capability);
  }

  capabilitySpecPath(capability: string): string {
    return join(this.capabilityDirectory(capability), "spec.md");
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

  deltaDirectory(feature: string): string {
    return join(this.specDirectory(feature), "deltas");
  }

  async exists(): Promise<boolean> {
    return isFile(this.statePath);
  }

  async ensureLayout(): Promise<void> {
    await mkdir(join(this.directory, "specs"), { recursive: true });
    await mkdir(this.capabilitiesDirectory, { recursive: true });
    await mkdir(this.eventsDirectory, { recursive: true });
  }

  async loadWorkstreams(): Promise<WorkstreamManifest> {
    if (!(await isFile(this.workstreamsPath))) return defaultWorkstreamManifest();
    const manifest = await readJson<WorkstreamManifest>(this.workstreamsPath, "INVALID_WORKSTREAMS");
    return normalizeWorkstreamManifest(manifest);
  }

  async selectedWorkstream(): Promise<string> {
    return (await this.loadWorkstreams()).selected;
  }

  async loadPolicy(): Promise<ProjectPolicy> {
    if (!(await isFile(this.policyPath))) return defaultPolicy();
    return normalizePolicy(await readJson<ProjectPolicy>(this.policyPath, "INVALID_POLICY"));
  }

  async writePolicy(policy: ProjectPolicy): Promise<void> {
    await this.withResourceLock("policy", async () => {
      await writeJsonAtomic(this.policyPath, normalizePolicy(policy));
    });
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
    await this.ensureProjectMetadata();
  }

  async writeInitialWorkstream(state: WorkflowState): Promise<void> {
    if (await this.exists()) return;
    await this.ensureLayout();
    await this.commitInitialState(state, "empirical-workstream", `Initialized ${this.workstream}`);
  }

  async createWorkstream(workstream: string, state: WorkflowState): Promise<boolean> {
    assertWorkstreamId(workstream);
    return this.withResourceLock("workstreams", async () => {
      const manifest = await this.loadWorkstreams();
      if (manifest.workstreams[workstream]) return false;
      const scoped = this.forWorkstream(workstream);
      await scoped.writeInitialWorkstream(state);
      manifest.workstreams[workstream] = { createdAt: state.updatedAt };
      await writeJsonAtomic(this.workstreamsPath, manifest);
      return true;
    });
  }

  async selectWorkstream(workstream: string): Promise<WorkstreamManifest> {
    assertWorkstreamId(workstream);
    return this.withResourceLock("workstreams", async () => {
      const manifest = await this.loadWorkstreams();
      if (!manifest.workstreams[workstream]) {
        throw new EmpiricalError("WORKSTREAM_NOT_FOUND", `Unknown workstream '${workstream}'`);
      }
      manifest.selected = workstream;
      await writeJsonAtomic(this.workstreamsPath, manifest);
      return manifest;
    });
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
      effect?: () => Promise<() => Promise<void>>;
    }>,
  ): Promise<{ state: WorkflowState; value: T }> {
    await this.ensureProjectMetadata();
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
      let rollback: (() => Promise<void>) | undefined;
      let eventWritten = false;
      try {
        rollback = await prepared.effect?.();
        await writeJsonAtomic(this.eventPath(event.revision), event);
        eventWritten = true;
        await writeJsonAtomic(this.statePath, next);
        return { state: next, value: prepared.value };
      } catch (error) {
        if (eventWritten) {
          try {
            await rm(this.eventPath(event.revision), { force: true });
          } catch (cleanupError) {
            throw new EmpiricalError(
              "TRANSACTION_RECOVERY_REQUIRED",
              "The transition event committed but its state projection failed; the next read will recover it",
              { error: errorMessage(error), cleanupError: errorMessage(cleanupError) },
            );
          }
        }
        if (rollback) {
          try {
            await rollback();
          } catch (rollbackError) {
            throw new EmpiricalError(
              "TRANSACTION_ROLLBACK_FAILED",
              "The state transition failed and its external effect could not be fully rolled back",
              { error: errorMessage(error), rollbackError: errorMessage(rollbackError) },
            );
          }
        }
        throw error;
      }
    });
  }

  async migrateSchema(): Promise<Record<string, unknown>> {
    await this.ensureProjectMetadata();
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

  async listCapabilityNames(): Promise<string[]> {
    await mkdir(this.capabilitiesDirectory, { recursive: true });
    await this.assertCapabilityPathSafe();
    return (await readdir(this.capabilitiesDirectory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && isCapabilityId(entry.name))
      .map((entry) => entry.name)
      .sort();
  }

  async readCapability(capability: string): Promise<string | null> {
    await this.assertCapabilityPathSafe(capability);
    const path = this.capabilitySpecPath(capability);
    return await isFile(path) ? readFile(path, "utf8") : null;
  }

  async writeCapability(capability: string, contents: string): Promise<void> {
    await this.assertCapabilityPathSafe(capability);
    await writeTextAtomic(this.capabilitySpecPath(capability), contents);
  }

  async removeCapability(capability: string): Promise<void> {
    await this.assertCapabilityPathSafe(capability);
    await rm(this.capabilitySpecPath(capability), { force: true });
    await rmdir(this.capabilityDirectory(capability)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY" && error.code !== "EEXIST") throw error;
    });
  }

  async withResourceLock<T>(resource: "workstreams" | "specs" | "capabilities" | "policy", operation: () => Promise<T>): Promise<T> {
    return withFileLock(join(this.directory, `${resource}.lock`), operation);
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
    return withFileLock(join(this.stateDirectory, "state.lock"), operation);
  }

  private async assertCapabilityPathSafe(capability?: string): Promise<void> {
    const paths = [
      this.capabilitiesDirectory,
      ...(capability
        ? [this.capabilityDirectory(capability), this.capabilitySpecPath(capability)]
        : []),
    ];
    for (const path of paths) {
      if (await isSymbolicLink(path)) {
        throw new EmpiricalError(
          "UNSAFE_CAPABILITY_PATH",
          `Capability storage cannot use symbolic links: ${path}`,
        );
      }
    }
  }

  private async ensureProjectMetadata(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    if (!(await isFile(this.workstreamsPath))) {
      await this.withResourceLock("workstreams", async () => {
        if (!(await isFile(this.workstreamsPath))) {
          await writeJsonAtomic(this.workstreamsPath, defaultWorkstreamManifest());
        }
      });
    }
    if (!(await isFile(this.policyPath))) {
      await this.withResourceLock("policy", async () => {
        if (!(await isFile(this.policyPath))) await writeJsonAtomic(this.policyPath, defaultPolicy());
      });
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

async function withFileLock<T>(lockPath: string, operation: () => Promise<T>): Promise<T> {
  await mkdir(dirname(lockPath), { recursive: true });
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
      const code = (error as NodeJS.ErrnoException).code;
      if (!isRetryableLockOpenError(error)) throw error;
      if (code === "EEXIST") {
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
          // The lock changed while it was inspected; retry through the same bounded wait.
        }
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

export function isRetryableLockOpenError(
  error: unknown,
  platform: NodeJS.Platform = process.platform,
): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "EEXIST"
    || (platform === "win32" && (code === "EPERM" || code === "EACCES"));
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

export function assertWorkstreamId(workstream: string): void {
  if (!isPortableId(workstream)) {
    throw new EmpiricalError(
      "INVALID_WORKSTREAM",
      `Invalid workstream '${workstream}'; use lowercase letters, numbers, dots, underscores, or hyphens`,
    );
  }
}

export function assertCapabilityId(capability: string): void {
  if (!isCapabilityId(capability)) {
    throw new EmpiricalError(
      "INVALID_CAPABILITY",
      `Invalid capability '${capability}'; use lowercase kebab-case`,
    );
  }
}

function isCapabilityId(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(value);
}

function isPortableId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/.test(value) && value !== "." && value !== "..";
}

function defaultWorkstreamManifest(): WorkstreamManifest {
  return {
    schemaVersion: WORKSTREAM_SCHEMA_VERSION,
    selected: "default",
    workstreams: { default: { createdAt: new Date(0).toISOString() } },
  };
}

function normalizeWorkstreamManifest(manifest: WorkstreamManifest): WorkstreamManifest {
  if (manifest.schemaVersion !== WORKSTREAM_SCHEMA_VERSION || !isRecord(manifest.workstreams)) {
    throw new EmpiricalError("INVALID_WORKSTREAMS", "Unsupported or malformed workstream manifest");
  }
  const workstreams: WorkstreamManifest["workstreams"] = {};
  for (const [id, entry] of Object.entries(manifest.workstreams)) {
    assertWorkstreamId(id);
    if (!isRecord(entry) || typeof entry.createdAt !== "string") {
      throw new EmpiricalError("INVALID_WORKSTREAMS", `Workstream '${id}' has invalid metadata`);
    }
    workstreams[id] = { createdAt: entry.createdAt };
  }
  if (!workstreams.default) {
    throw new EmpiricalError("INVALID_WORKSTREAMS", "Workstream manifest must retain 'default'");
  }
  assertWorkstreamId(manifest.selected);
  if (!workstreams[manifest.selected]) {
    throw new EmpiricalError("INVALID_WORKSTREAMS", `Selected workstream '${manifest.selected}' does not exist`);
  }
  return { schemaVersion: WORKSTREAM_SCHEMA_VERSION, selected: manifest.selected, workstreams };
}

function defaultPolicy(): ProjectPolicy {
  return { schemaVersion: POLICY_SCHEMA_VERSION, context: [], phases: {} };
}

function normalizePolicy(policy: ProjectPolicy): ProjectPolicy {
  if (
    policy.schemaVersion !== POLICY_SCHEMA_VERSION
    || !Array.isArray(policy.context)
    || !isRecord(policy.phases)
  ) {
    throw new EmpiricalError("INVALID_POLICY", "Unsupported or malformed project policy");
  }
  const context = policy.context.map((item) => requiredPolicyText(item, "context"));
  const phases: Partial<Record<Phase, string[]>> = {};
  const validPhases = new Set<Phase>([
    "idle", "shape", "specify", "design", "plan", "implement", "verify", "review", "archive", "done",
  ]);
  for (const [phase, guidance] of Object.entries(policy.phases)) {
    if (!validPhases.has(phase as Phase) || !Array.isArray(guidance)) {
      throw new EmpiricalError("INVALID_POLICY", `Invalid policy phase '${phase}'`);
    }
    phases[phase as Phase] = guidance.map((item) => requiredPolicyText(item, phase));
  }
  return { schemaVersion: POLICY_SCHEMA_VERSION, context, phases };
}

function requiredPolicyText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new EmpiricalError("INVALID_POLICY", `Policy ${field} entries must be non-empty strings`);
  }
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    capabilityArchiveRequired: typeof state.capabilityArchiveRequired === "boolean"
      ? state.capabilityArchiveRequired
      : false,
    capabilityDeltaDigest: typeof state.capabilityDeltaDigest === "string"
      ? state.capabilityDeltaDigest
      : null,
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
  if (value.schemaVersion !== 1 && value.schemaVersion !== 2 && value.schemaVersion !== SCHEMA_VERSION) {
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
