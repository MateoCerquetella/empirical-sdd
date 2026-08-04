import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";

import {
  createImpactManifest,
  deriveCompletion,
  digestJson,
  sha256,
  verifyImpactManifest,
  type ImpactManifest,
  type JsonValue,
} from "./protocol.js";
import { compactJournal, createJournalEvent, journalGenesisDigest, readJournal } from "./journal.js";
import { migratePolicyV1, parsePolicy } from "./policy.js";
import { parseCapabilityDelta } from "./specifications.js";
import {
  MIGRATION_BACKUP_PREFIX,
  MIGRATION_MARKER_NAME,
  MIGRATION_STAGE_PREFIX,
} from "./migration-scratch.js";

const EMPIRICAL = ".empirical";

export type MigrationFaultPoint =
  | "after-prepare"
  | "after-backup"
  | "after-promote";

interface MigrationMarker {
  schemaVersion: 1;
  id: string;
  root: string;
  source: string;
  stage: string;
  backup: string;
  phase: "prepared" | "source-moved" | "promoted";
  sourceDigest: string;
  stagedDigest: string;
  startedAt: string;
  digest: string;
}

export interface MigrationReport {
  from: 4 | 5;
  to: 5;
  changed: boolean;
  recovered: boolean;
  features: number;
  sourceDigest: string;
  resultDigest: string;
  receipt: string | null;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`Could not read migration JSON ${path}: ${String(error)}`);
  }
}

async function exists(path: string): Promise<boolean> {
  return lstat(path).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return false;
      throw error;
    },
  );
}

async function writeExclusive(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory(dirname(path));
}

async function writeReplace(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeExclusive(temporary, value);
  await rename(temporary, path);
  await syncDirectory(dirname(path));
}

async function syncDirectory(path: string): Promise<void> {
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(path, "r");
  } catch (error) {
    if (process.platform === "win32" && ["EISDIR", "EPERM", "EACCES"].includes(String((error as NodeJS.ErrnoException).code))) return;
    throw error;
  }
  try {
    await handle.sync().catch((error: NodeJS.ErrnoException) => {
      if (process.platform === "win32" && ["EINVAL", "ENOTSUP", "EBADF", "EPERM"].includes(String(error.code))) return;
      throw error;
    });
  } finally {
    await handle.close();
  }
}

async function removeOwnedUnmarkedStage(root: string, stage: string): Promise<void> {
  if (dirname(stage) !== root || !basename(stage).startsWith(MIGRATION_STAGE_PREFIX)) {
    throw new Error(`Refusing to remove an unowned migration stage: ${stage}`);
  }
  await rm(stage, { recursive: true, force: true });
  await syncDirectory(root);
}

async function filesUnder(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(current, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Schema migration refuses symbolic links: ${path}`);
    }
    if (entry.isDirectory()) {
      result.push(...(await filesUnder(root, path)));
    } else if (entry.isFile()) {
      result.push(relative(root, path));
    } else {
      throw new Error(`Schema migration refuses non-regular paths: ${path}`);
    }
  }
  return result;
}

async function directoryDigest(root: string, excluded: ReadonlySet<string> = new Set()): Promise<string> {
  const files = (await filesUnder(root)).filter(
    (path) => !excluded.has(path.replaceAll("\\", "/")),
  );
  const inventory = [];
  for (const path of files) {
    const absolute = join(root, path);
    const [bytes, metadata] = await Promise.all([readFile(absolute), stat(absolute)]);
    inventory.push({
      path: path.replaceAll("\\", "/"),
      bytes: bytes.byteLength,
      mode: metadata.mode & 0o777,
      digest: sha256(bytes),
    });
  }
  return digestJson(inventory);
}

async function assertPlainDirectory(path: string, label: string): Promise<void> {
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error(`${label} must be a real directory, not a symbolic or special path: ${path}`);
  }
}

async function copyDirectoryStrict(source: string, target: string): Promise<void> {
  await mkdir(target, { recursive: false });
  for (const entry of (await readdir(source, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Schema migration refuses symbolic links: ${from}`);
    }
    if (entry.isDirectory()) {
      await copyDirectoryStrict(from, to);
    } else if (entry.isFile()) {
      const sourceHandle = await open(from, "r");
      const targetHandle = await open(to, "wx", (await sourceHandle.stat()).mode & 0o777);
      try {
        await targetHandle.writeFile(await sourceHandle.readFile());
        await targetHandle.sync();
      } finally {
        await sourceHandle.close();
        await targetHandle.close();
      }
    } else {
      throw new Error(`Schema migration refuses non-regular paths: ${from}`);
    }
  }
  await syncDirectory(target);
}

function assertCanonicalDigest(value: unknown, label: string, nullable = false): void {
  if (nullable && value === null) return;
  if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} is not a canonical SHA-256 digest.`);
  }
}

function validateManifestV2(value: unknown): void {
  const manifest = record(value, "Manifest v2");
  if (
    manifest.schemaVersion !== 2
    || typeof manifest.generator !== "string"
    || typeof manifest.truncated !== "boolean"
    || !Array.isArray(manifest.files)
    || !Array.isArray(manifest.pages)
  ) {
    throw new Error("Schema-5 validation found a malformed Manifest v2.");
  }
  assertCanonicalDigest(manifest.sourceDigest, "Manifest source digest");
  assertCanonicalDigest(manifest.digest, "Manifest digest");
  for (const entry of manifest.files) {
    const file = record(entry, "Manifest file");
    if (
      typeof file.path !== "string"
      || !file.path
      || !Number.isSafeInteger(file.size)
      || Number(file.size) < 0
    ) {
      throw new Error("Manifest v2 contains an invalid source file record.");
    }
    assertCanonicalDigest(file.digest, `Manifest file ${file.path} digest`);
  }
  for (const entry of manifest.pages) {
    const page = record(entry, "Manifest page");
    if (
      typeof page.path !== "string"
      || !page.path.startsWith(".empirical/context/")
      || typeof page.generator !== "string"
      || typeof page.managed !== "boolean"
      || !Array.isArray(page.dependencies)
      || page.dependencies.some((dependency) => typeof dependency !== "string")
      || !["fresh", "stale", "missing"].includes(String(page.freshness))
    ) {
      throw new Error("Manifest v2 contains an invalid context page record.");
    }
    assertCanonicalDigest(page.sourceDigest, `Manifest page ${page.path} source digest`);
    assertCanonicalDigest(page.digest, `Manifest page ${page.path} digest`, true);
  }
  const { digest, ...body } = manifest;
  if (digestJson(body) !== digest) {
    throw new Error("Manifest v2 failed its body digest check.");
  }
}

function prefixedDigest(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return /^sha256:[a-f0-9]{64}$/.test(value) ? value : `sha256:${value}`;
}

function completionForState(state: Record<string, unknown>): JsonValue {
  const phase = typeof state.phase === "string" ? state.phase : "idle";
  const implemented = ["verify", "review", "archive", "done"].includes(phase);
  const verified = ["review", "archive", "done"].includes(phase);
  const integrated =
    phase === "done" && state.profile === "complex" && state.capabilityArchiveRequired === true;
  return deriveCompletion({
    implemented,
    verified,
    integrated,
    delivered: false,
    published: false,
  }) as unknown as JsonValue;
}

function transformState(
  value: unknown,
  acceptedSchemas: readonly number[] = [4],
): Record<string, JsonValue> {
  const legacy = record(value, "Legacy workflow state");
  if (
    !Number.isSafeInteger(legacy.schemaVersion)
    || !acceptedSchemas.includes(Number(legacy.schemaVersion))
  ) {
    throw new Error(
      `Expected Schema-${acceptedSchemas.join(" or Schema-")} workflow state, got ${String(legacy.schemaVersion)}.`,
    );
  }
  const profile = legacy.profile === "complex" ? "complex" : "fast";
  const evidence = Array.isArray(legacy.evidence) ? legacy.evidence : [];
  const phase = legacy.phase === "archive" ? "integrate" : legacy.phase;
  const transformed: Record<string, JsonValue> = {
    ...Object.fromEntries(
      Object.entries(legacy).filter(([key]) => !["schemaVersion", "evidence"].includes(key)),
    ) as Record<string, JsonValue>,
    schemaVersion: 5,
    workflow: profile,
    profile,
    mode: "normal",
    phase: phase as JsonValue,
    specDigest: prefixedDigest(legacy.specDigest),
    approvedSpecRevision: Number.isSafeInteger(legacy.revision)
      ? Number(legacy.revision)
      : null,
    capabilityDeltaDigest: prefixedDigest(legacy.capabilityDeltaDigest),
    impactDigest: null,
    capabilityClaimId: null,
    authorizationDigest: null,
    evidenceReceiptIds: [],
    legacyEvidenceCount: evidence.length,
    completion: completionForState(legacy),
  };
  return transformed;
}

async function deltaCapabilities(featureDirectory: string): Promise<string[]> {
  const directory = join(featureDirectory, "deltas");
  if (!(await exists(directory))) return [];
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /^[a-z0-9][a-z0-9-]*\.md$/.test(entry.name))
    .map((entry) => entry.name.slice(0, -3))
    .sort();
}

async function writeImpactAndLegacyEvidence(
  featureDirectory: string,
  state: Record<string, JsonValue>,
): Promise<void> {
  const capabilities = await deltaCapabilities(featureDirectory);
  const behavioral = state.profile === "complex" && capabilities.length > 0;
  const deltaDirectory = join(featureDirectory, "deltas");
  const feature = basename(featureDirectory);
  const parsedDeltas = [];
  if (await exists(deltaDirectory)) {
    for (const entry of (await readdir(deltaDirectory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const capability = entry.name.slice(0, -3);
      parsedDeltas.push(parseCapabilityDelta(
        capability,
        await readFile(join(deltaDirectory, entry.name), "utf8"),
        `.empirical/specs/${feature}/deltas/${entry.name}`,
      ));
    }
  }
  state.capabilityArchiveRequired = behavioral;
  state.capabilityDeltaDigest = parsedDeltas.length > 0
    ? sha256(JSON.stringify(parsedDeltas))
    : null;
  const impact = createImpactManifest(
    behavioral
      ? {
          schemaVersion: 1,
          classification: "behavioral",
          capabilities,
          surfaces: ["legacy-schema-4-workflow"],
          regressionRationale: null,
        }
      : {
          schemaVersion: 1,
          classification: "non-behavioral",
          capabilities: [],
          surfaces: ["legacy-schema-4-workflow"],
          regressionRationale:
            "Migrated history did not retain reviewable unarchived capability deltas; existing regression artifacts remain historical only.",
        },
  );
  await writeReplace(join(featureDirectory, "impact.json"), impact);
  state.impactDigest = impact.digest;

  const legacyNames = [
    "evidence.json",
    "verification-evidence.json",
    "review-evidence.json",
    "verification-result.json",
    "review-result.json",
  ];
  const artifacts = [];
  for (const name of legacyNames) {
    const path = join(featureDirectory, name);
    if (await exists(path)) {
      const bytes = await readFile(path);
      artifacts.push({ path: name, bytes: bytes.byteLength, digest: sha256(bytes) });
    }
  }
  if (artifacts.length > 0 || Number(state.legacyEvidenceCount) > 0) {
    const body = {
      schemaVersion: 1,
      kind: "collected-legacy",
      satisfiesVerification: false,
      artifacts,
      importedAssertions: Number(state.legacyEvidenceCount),
      summary:
        "Schema-4 evidence lacked executable provenance and is retained for history only.",
    };
    await writeReplace(join(featureDirectory, "evidence", "legacy-import.json"), {
      ...body,
      digest: digestJson(body),
    });
  }
}

async function transformFeature(featureDirectory: string, feature: string): Promise<boolean> {
  const statePath = join(featureDirectory, "state.json");
  if (!(await exists(statePath))) return false;
  const state = transformState(await readJson(statePath));
  await writeImpactAndLegacyEvidence(featureDirectory, state);
  const specPath = join(featureDirectory, "spec.md");
  if (await exists(specPath)) {
    state.specDigest = sha256(await readFile(specPath));
  }

  const eventsDirectory = join(featureDirectory, "events");
  const legacyEvents = (await exists(eventsDirectory))
    ? (await readdir(eventsDirectory, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && /^\d{8}\.json$/.test(entry.name))
        .map((entry) => entry.name)
        .sort()
    : [];
  const transformedEvents = [];
  let previousState: Record<string, JsonValue> | null = null;
  let previousDigest = journalGenesisDigest(feature);
  let sequence = 1;
  for (const name of legacyEvents) {
    const legacyEvent = record(await readJson(join(eventsDirectory, name)), "Legacy event");
    if (legacyEvent.schemaVersion !== 3 && legacyEvent.schemaVersion !== 4) {
      throw new Error(`Feature ${feature} contains an unsupported historical event schema.`);
    }
    const eventStateRecord = record(legacyEvent.state, "Legacy event state");
    if (eventStateRecord.schemaVersion !== legacyEvent.schemaVersion) {
      throw new Error(`Feature ${feature} contains a mixed-version historical event.`);
    }
    const eventState = transformState(eventStateRecord, [Number(legacyEvent.schemaVersion)]);
    if (eventState.revision === state.revision) {
      eventState.impactDigest = state.impactDigest ?? null;
      eventState.specDigest = state.specDigest ?? null;
      eventState.capabilityArchiveRequired = state.capabilityArchiveRequired ?? false;
      eventState.capabilityDeltaDigest = state.capabilityDeltaDigest ?? null;
    }
    const event = createJournalEvent({
      sequence,
      previousDigest,
      actor: typeof legacyEvent.actor === "string" ? legacyEvent.actor : "schema-4-migration",
      type: "migration",
      summary:
        typeof legacyEvent.summary === "string"
          ? legacyEvent.summary
          : `Imported Schema-4 revision ${String(eventState.revision)}`,
      createdAt:
        typeof legacyEvent.createdAt === "string"
          ? legacyEvent.createdAt
          : "1970-01-01T00:00:00.000Z",
      stateBefore: previousState,
      stateAfter: eventState,
    });
    transformedEvents.push(event);
    previousState = eventState;
    previousDigest = event.digest;
    sequence += 1;
  }
  if (transformedEvents.length === 0 || previousState?.revision !== state.revision) {
    const event = createJournalEvent({
      sequence,
      previousDigest,
      actor: "schema-4-migration",
      type: "migration",
      summary: `Imported Schema-4 projected revision ${String(state.revision)}`,
      createdAt:
        typeof state.updatedAt === "string"
          ? state.updatedAt
          : "1970-01-01T00:00:00.000Z",
      stateBefore: previousState,
      stateAfter: state,
    });
    transformedEvents.push(event);
  }
  await mkdir(eventsDirectory, { recursive: true });
  for (const entry of await readdir(eventsDirectory, { withFileTypes: true })) {
    if (entry.isFile() && /^\d{8}\.json$/.test(entry.name)) {
      await rm(join(eventsDirectory, entry.name));
    }
  }
  for (const event of transformedEvents) {
    await writeExclusive(
      join(eventsDirectory, `${String(event.sequence).padStart(8, "0")}.json`),
      event,
    );
  }
  await writeReplace(statePath, state);
  if (state.phase === "done" && state.status === "done") {
    await compactJournal<JsonValue>({
      directory: eventsDirectory,
      feature,
      actor: "schema-4-migration",
      now: () => new Date(
        typeof state.updatedAt === "string"
          ? state.updatedAt
          : "1970-01-01T00:00:00.000Z",
      ),
    });
  }
  return true;
}

async function transformManifest(stage: string): Promise<void> {
  const context = join(stage, "context");
  const manifestPath = join(context, "manifest.json");
  const old = (await exists(manifestPath))
    ? record(await readJson(manifestPath), "Repository knowledge manifest")
    : { files: [], truncated: false, digest: "" };
  const oldFiles = Array.isArray(old.files) ? old.files : [];
  const files = oldFiles.map((entry) => {
    const item = record(entry, "Manifest file");
    return {
      path: String(item.path),
      size: Number(item.size),
      digest: prefixedDigest(item.digest) ?? sha256(""),
    };
  });
  const sourceDigest = digestJson(files);
  const pages = [];
  for (const name of ["overview.md", "architecture.md", "commands.md", "conventions.md"]) {
    const path = join(context, name);
    const present = await exists(path);
    const dependencies = files
      .filter((file) => {
        if (name === "overview.md") return /(^|\/)(README|PROJECT|VISION|PRODUCT|package\.json)/i.test(file.path);
        if (name === "architecture.md") return /^(src|lib|app|packages)\//.test(file.path) || /ARCHITECTURE|DESIGN|package\.json|Cargo\.toml|go\.mod|pyproject\.toml/i.test(file.path);
        if (name === "commands.md") return /(^|\/)(package\.json|Makefile|justfile|Taskfile\.ya?ml)|^(\.github\/workflows|scripts)\//.test(file.path);
        return /AGENTS|CONTRIBUTING|STYLE|CONVENTIONS|eslint|prettier|biome|tsconfig|ruff|clippy/i.test(file.path);
      })
      .map((file) => file.path);
    const pageSourceDigest = digestJson(
      files.filter((file) => dependencies.includes(file.path)),
    );
    const contents = present ? await readFile(path, "utf8") : null;
    pages.push({
      path: `.empirical/context/${name}`,
      generator: "empirical-0.22.0",
      managed: contents?.startsWith("<!-- empirical-sdd:managed-context-v2 -->") ?? true,
      dependencies,
      sourceDigest: pageSourceDigest,
      digest: contents === null ? null : sha256(contents),
      freshness: present ? "fresh" : "missing",
    });
  }
  const indexPath = join(context, "index.md");
  const indexContents = (await exists(indexPath)) ? await readFile(indexPath, "utf8") : null;
  pages.unshift({
    path: ".empirical/context/index.md",
    generator: "empirical-0.22.0",
    managed: indexContents?.startsWith("<!-- empirical-sdd:managed-context-v2 -->") ?? true,
    dependencies: files.map((file) => file.path),
    sourceDigest,
    digest: indexContents === null ? null : sha256(indexContents),
    freshness: indexContents === null ? "missing" : "fresh",
  });
  const body = {
    schemaVersion: 2,
    generator: "empirical-0.22.0",
    sourceDigest,
    files,
    pages,
    truncated: old.truncated === true,
  };
  await writeReplace(manifestPath, { ...body, digest: digestJson(body) });
}

async function transformStage(stage: string, startedAt: string): Promise<number> {
  const configPath = join(stage, "config.json");
  const legacyConfig = record(await readJson(configPath), "Project configuration");
  if (legacyConfig.schemaVersion !== 4) {
    throw new Error(`Expected Schema-4 config, got ${String(legacyConfig.schemaVersion)}.`);
  }
  const policyPath = join(stage, "policy.json");
  const policy = migratePolicyV1(await readJson(policyPath));
  const legacyEvidence = record(legacyConfig.evidence ?? {}, "Legacy evidence configuration");
  const migratedPolicy = {
    ...policy,
    verification: {
      evidence: {
        required: legacyEvidence.required !== false,
        browserForUi: legacyEvidence.browserForUi !== false,
        screenshotForUi: legacyEvidence.screenshotForUi !== false,
        codeReview: legacyEvidence.codeReview !== false,
      },
      commands: [],
    },
  };
  await writeReplace(policyPath, migratedPolicy);

  const specs = join(stage, "specs");
  let features = 0;
  if (await exists(specs)) {
    for (const entry of (await readdir(specs, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.isDirectory() && /^[a-z0-9][a-z0-9-]*$/.test(entry.name)) {
        if (await transformFeature(join(specs, entry.name), entry.name)) features += 1;
      }
    }
  }
  await transformManifest(stage);
  const config = {
    ...legacyConfig,
    schemaVersion: 5,
    profile: legacyConfig.profile === "complex" ? "complex" : "fast",
    migratedFrom: {
      schemaVersion: 4,
      migratedAt: startedAt,
    },
  };
  await writeReplace(configPath, config);
  return features;
}

async function validateSchema5(directory: string): Promise<{ features: number }> {
  await assertPlainDirectory(directory, "Schema-5 candidate");
  const config = record(await readJson(join(directory, "config.json")), "Schema-5 config");
  if (config.schemaVersion !== 5) throw new Error("Schema-5 validation found the wrong config version.");
  parsePolicy(await readJson(join(directory, "policy.json")), dirname(directory));
  validateManifestV2(await readJson(join(directory, "context", "manifest.json")));
  let features = 0;
  const specs = join(directory, "specs");
  if (await exists(specs)) {
    for (const entry of await readdir(specs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const statePath = join(specs, entry.name, "state.json");
      if (!(await exists(statePath))) continue;
      const state = record(await readJson(statePath), `Feature ${entry.name} state`);
      if (state.schemaVersion !== 5) throw new Error(`Feature ${entry.name} was not migrated.`);
      const impactPath = join(specs, entry.name, "impact.json");
      if (!(await exists(impactPath))) {
        throw new Error(`Feature ${entry.name} is missing its impact manifest.`);
      }
      verifyImpactManifest(await readJson(impactPath) as ImpactManifest);
      const journal = await readJournal<JsonValue>(
        join(specs, entry.name, "events"),
        entry.name,
      );
      if (digestJson(journal.state) !== digestJson(state)) {
        throw new Error(`Feature ${entry.name} state does not match its journal.`);
      }
      if (
        state.phase === "done"
        && state.status === "done"
        && (
          journal.snapshot === null
          || journal.events.length !== 1
          || journal.events[0]?.type !== "compaction-boundary"
        )
      ) {
        throw new Error(`Feature ${entry.name} terminal journal is not compacted.`);
      }
      features += 1;
    }
  }
  return { features };
}

function markerBody(marker: Omit<MigrationMarker, "digest">): MigrationMarker {
  return { ...marker, digest: digestJson(marker) };
}

function advanceMarker(
  marker: MigrationMarker,
  phase: MigrationMarker["phase"],
): MigrationMarker {
  const { digest: _digest, ...body } = marker;
  return markerBody({ ...body, phase });
}

function verifyMarker(marker: MigrationMarker, repositoryRoot: string): void {
  const { digest, ...body } = marker;
  if (digestJson(body) !== digest) throw new Error("Migration marker failed its digest check.");
  const expectedRoot = resolve(repositoryRoot);
  if (resolve(marker.root) !== expectedRoot || resolve(marker.source) !== join(expectedRoot, EMPIRICAL)) {
    throw new Error("Migration marker does not belong to this repository.");
  }
  for (const [path, prefix] of [
    [marker.stage, MIGRATION_STAGE_PREFIX],
    [marker.backup, MIGRATION_BACKUP_PREFIX],
  ] as const) {
    if (dirname(resolve(path)) !== expectedRoot || !basename(path).startsWith(prefix)) {
      throw new Error(`Migration marker has an unsafe managed path: ${path}`);
    }
  }
}

async function writeMarker(path: string, marker: MigrationMarker): Promise<void> {
  if (await exists(path)) await writeReplace(path, marker);
  else await writeExclusive(path, marker);
}

async function finalizeMigration(
  repositoryRoot: string,
  marker: MigrationMarker,
  recovered: boolean,
): Promise<MigrationReport> {
  const source = join(repositoryRoot, EMPIRICAL);
  const validation = await validateSchema5(source);
  const resultDigest = await directoryDigest(
    source,
    new Set(["migrations/schema-4-to-5.json"]),
  );
  if (resultDigest !== marker.stagedDigest) {
    throw new Error("Promoted Schema-5 directory differs from the staged migration digest.");
  }
  const receiptDirectory = join(source, "migrations");
  await mkdir(receiptDirectory, { recursive: true });
  await syncDirectory(source);
  const receiptPath = join(receiptDirectory, "schema-4-to-5.json");
  const body = {
    schemaVersion: 1,
    from: 4,
    to: 5,
    transactionId: marker.id,
    sourceDigest: marker.sourceDigest,
    resultDigest,
    startedAt: marker.startedAt,
    completedAt: new Date().toISOString(),
    recovered,
    features: validation.features,
  };
  if (!(await exists(receiptPath))) {
    await writeExclusive(receiptPath, { ...body, digest: digestJson(body) });
  }
  const failed = join(repositoryRoot, `.empirical.schema5-failed-${marker.id}`);
  await rm(marker.backup, { recursive: true, force: true });
  await rm(marker.stage, { recursive: true, force: true });
  await rm(failed, { recursive: true, force: true });
  await rm(join(repositoryRoot, MIGRATION_MARKER_NAME), { force: true });
  await syncDirectory(repositoryRoot);
  return {
    from: 4,
    to: 5,
    changed: true,
    recovered,
    features: validation.features,
    sourceDigest: marker.sourceDigest,
    resultDigest,
    receipt: relative(repositoryRoot, receiptPath).replaceAll("\\", "/"),
  };
}

export async function recoverSchema5Migration(
  repositoryRoot: string,
): Promise<MigrationReport | null> {
  const root = resolve(repositoryRoot);
  const markerPath = join(root, MIGRATION_MARKER_NAME);
  if (!(await exists(markerPath))) return null;
  const marker = record(await readJson(markerPath), "Migration marker") as unknown as MigrationMarker;
  verifyMarker(marker, root);
  const source = join(root, EMPIRICAL);
  try {
    if (await exists(source)) {
      await assertPlainDirectory(source, "Migration source");
      const config = record(await readJson(join(source, "config.json")), "Migration source config");
      if (config.schemaVersion === 5) {
        return await finalizeMigration(root, marker, true);
      }
      if (config.schemaVersion !== 4) {
        throw new Error("Migration recovery found an unsupported source version.");
      }
      if (await exists(marker.backup)) {
        await assertPlainDirectory(marker.backup, "Migration backup");
        throw new Error("Migration recovery found both a Schema-4 source and backup.");
      }
      await rename(source, marker.backup);
      await syncDirectory(root);
    }
    if (!(await exists(marker.stage))) {
      throw new Error("Migration recovery is missing the staged Schema-5 directory.");
    }
    await assertPlainDirectory(marker.stage, "Migration stage");
    await rename(marker.stage, source);
    await syncDirectory(root);
    return await finalizeMigration(root, marker, true);
  } catch (error) {
    if (await exists(marker.backup)) {
      if (await exists(source)) {
        if (!(await exists(marker.stage))) {
          await rename(source, marker.stage);
          await syncDirectory(root);
        } else {
          const failed = join(root, `.empirical.schema5-failed-${marker.id}`);
          if (!(await exists(failed))) {
            await rename(source, failed);
            await syncDirectory(root);
          }
        }
      }
      if (!(await exists(source))) {
        await rename(marker.backup, source);
        await syncDirectory(root);
      }
    }
    throw error;
  }
}

async function maybeFault(
  point: MigrationFaultPoint,
  requested: MigrationFaultPoint | undefined,
): Promise<void> {
  if (point === requested) throw new Error(`Injected migration fault: ${point}`);
}

export async function migrateSchema4To5(
  repositoryRoot: string,
  options: { faultAt?: MigrationFaultPoint; now?: () => Date } = {},
): Promise<MigrationReport> {
  const root = resolve(repositoryRoot);
  const recovered = await recoverSchema5Migration(root);
  if (recovered) return recovered;
  const source = join(root, EMPIRICAL);
  if (!(await exists(source))) throw new Error("No .empirical directory exists to migrate.");
  await assertPlainDirectory(source, "Migration source");
  const config = record(await readJson(join(source, "config.json")), "Project config");
  if (config.schemaVersion === 5) {
    const validation = await validateSchema5(source);
    const digest = await directoryDigest(source, new Set(["migrations/schema-4-to-5.json"]));
    return {
      from: 5,
      to: 5,
      changed: false,
      recovered: false,
      features: validation.features,
      sourceDigest: digest,
      resultDigest: digest,
      receipt: (await exists(join(source, "migrations", "schema-4-to-5.json")))
        ? ".empirical/migrations/schema-4-to-5.json"
        : null,
    };
  }
  if (config.schemaVersion !== 4) {
    throw new Error(`Only Schema 4 can migrate to Schema 5, got ${String(config.schemaVersion)}.`);
  }
  const sourceDigest = await directoryDigest(source);
  const id = randomUUID();
  const stage = join(root, `${MIGRATION_STAGE_PREFIX}${id}`);
  const backup = join(root, `${MIGRATION_BACKUP_PREFIX}${id}`);
  const markerPath = join(root, MIGRATION_MARKER_NAME);
  const startedAt = (options.now ?? (() => new Date()))().toISOString();
  await copyDirectoryStrict(source, stage);
  await syncDirectory(root);
  if (await directoryDigest(stage) !== sourceDigest) {
    await removeOwnedUnmarkedStage(root, stage);
    throw new Error("Schema-4 source changed while the migration candidate was copied.");
  }
  let features: number;
  let stagedDigest: string;
  try {
    features = await transformStage(stage, startedAt);
    await validateSchema5(stage);
    stagedDigest = await directoryDigest(stage);
  } catch (error) {
    try {
      await removeOwnedUnmarkedStage(root, stage);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        `Schema-5 candidate failed and its owned stage could not be removed: ${stage}`,
      );
    }
    throw error;
  }
  let marker = markerBody({
    schemaVersion: 1,
    id,
    root,
    source,
    stage,
    backup,
    phase: "prepared",
    sourceDigest,
    stagedDigest,
    startedAt,
  });
  try {
    await writeExclusive(markerPath, marker);
  } catch (error) {
    await removeOwnedUnmarkedStage(root, stage);
    throw error;
  }
  await maybeFault("after-prepare", options.faultAt);
  if (await directoryDigest(source) !== sourceDigest) {
    await rm(stage, { recursive: true, force: true });
    await rm(markerPath, { force: true });
    throw new Error("Schema-4 source changed before atomic migration promotion.");
  }
  await rename(source, backup);
  await syncDirectory(root);
  marker = advanceMarker(marker, "source-moved");
  await writeMarker(markerPath, marker);
  await maybeFault("after-backup", options.faultAt);
  await rename(stage, source);
  await syncDirectory(root);
  marker = advanceMarker(marker, "promoted");
  await writeMarker(markerPath, marker);
  await maybeFault("after-promote", options.faultAt);
  const report = await finalizeMigration(root, marker, false);
  return { ...report, features };
}
