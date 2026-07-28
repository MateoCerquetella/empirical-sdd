import { open, readFile, readdir, rename, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { EmpiricalError } from "./errors.js";
import {
  SCHEMA_VERSION,
  type ProjectConfig,
  type TransitionEvent,
  type WorkflowState,
} from "./types.js";

const EMPIRICAL_DIR = ".empirical";

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
    if (config.schemaVersion !== SCHEMA_VERSION) {
      throw new EmpiricalError(
        "MIGRATION_REQUIRED",
        `Project schema ${String(config.schemaVersion)} is not supported; run empirical migrate`,
      );
    }
    return config;
  }

  async loadState(): Promise<WorkflowState> {
    const projected = await readJson<WorkflowState>(this.statePath, "PROJECT_NOT_INITIALIZED");
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
    return this.withLock(async () => {
      const current = await this.loadState();
      if (current.revision !== expectedRevision) {
        throw new EmpiricalError(
          "STALE_REVISION",
          `Expected revision ${expectedRevision}, but the project is at ${current.revision}`,
          { expectedRevision, actualRevision: current.revision },
        );
      }
      const now = new Date().toISOString();
      const next = mutate(structuredClone(current));
      next.schemaVersion = SCHEMA_VERSION;
      next.revision = current.revision + 1;
      next.updatedAt = now;
      const event: TransitionEvent = {
        schemaVersion: SCHEMA_VERSION,
        revision: next.revision,
        previousRevision: current.revision,
        actor,
        summary,
        createdAt: now,
        state: next,
      };
      await writeJsonAtomic(this.eventPath(event.revision), event);
      await writeJsonAtomic(this.statePath, next);
      return next;
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
    try {
      const names = (await readdir(this.eventsDirectory))
        .filter((name) => /^[0-9]{8}\.json$/.test(name))
        .sort();
      const name = names.at(-1);
      return name ? readJson<TransitionEvent>(join(this.eventsDirectory, name), "INVALID_EVENT") : null;
    } catch {
      return null;
    }
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
    let handle;
    try {
      handle = await open(lockPath, "wx");
    } catch (error) {
      try {
        const details = await stat(lockPath);
        if (Date.now() - details.mtimeMs > 30_000) {
          await rm(lockPath, { force: true });
          handle = await open(lockPath, "wx");
        }
      } catch {
        // The lock changed between checks; report a stable busy error below.
      }
      if (!handle) {
        throw new EmpiricalError(
          "PROJECT_BUSY",
          "Another Empirical client is updating this repository; retry shortly",
          error,
        );
      }
    }
    try {
      return await operation();
    } finally {
      await handle.close();
      await rm(lockPath, { force: true });
    }
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
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, contents, "utf8");
  await rename(temporary, path);
}

export async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
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
