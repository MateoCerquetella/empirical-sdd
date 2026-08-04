import { randomUUID } from "node:crypto";
import {
  mkdir,
  lstat,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { dirname, join } from "node:path";

import { canonicalJson, digestJson, type JsonValue } from "./protocol.js";

export interface JournalEvent<TState extends JsonValue = JsonValue> {
  schemaVersion: 1;
  sequence: number;
  previousDigest: string;
  actor: string;
  type: "transition" | "compaction-boundary" | "migration";
  summary: string;
  createdAt: string;
  stateBeforeDigest: string;
  stateAfterDigest: string;
  state: TState;
  digest: string;
}

export interface JournalSnapshot<TState extends JsonValue = JsonValue> {
  schemaVersion: 1;
  feature: string;
  lastSequence: number;
  lastEventDigest: string;
  stateDigest: string;
  state: TState;
  compactedAt: string;
  digest: string;
}

export interface JournalReadResult<TState extends JsonValue = JsonValue> {
  snapshot: JournalSnapshot<TState> | null;
  events: JournalEvent<TState>[];
  state: TState | null;
  lastSequence: number;
  lastEventDigest: string;
}

interface CompactionTransaction<TState extends JsonValue = JsonValue> {
  schemaVersion: 1;
  id: string;
  phase: "prepared" | "snapshot-promoted" | "boundary-written";
  snapshot: JournalSnapshot<TState>;
  boundary: JournalEvent<TState>;
  oldSnapshotPresent: boolean;
  digest: string;
}

const EVENT_NAME = /^(\d{8})\.json$/;
const GENESIS_PREFIX = "empirical-journal-genesis:";

function assertDigest(value: string, label: string): void {
  if (!/^sha256:[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} is not a canonical SHA-256 digest.`);
  }
}

function assertTimestamp(value: string, label: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} is not a valid timestamp.`);
  }
}

export function journalGenesisDigest(feature: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(feature)) {
    throw new Error(`Invalid journal feature id: ${feature}`);
  }
  return digestJson({ genesis: `${GENESIS_PREFIX}${feature}` });
}

export function createJournalEvent<TState extends JsonValue>(input: {
  sequence: number;
  previousDigest: string;
  actor: string;
  type?: JournalEvent["type"];
  summary: string;
  createdAt: string;
  stateBefore: TState | null;
  stateAfter: TState;
}): JournalEvent<TState> {
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1) {
    throw new Error("Journal sequence must be a positive safe integer.");
  }
  assertDigest(input.previousDigest, "Previous journal digest");
  assertTimestamp(input.createdAt, "Journal event timestamp");
  if (!input.actor.trim() || !input.summary.trim()) {
    throw new Error("Journal actor and summary must be non-empty.");
  }
  const body = {
    schemaVersion: 1 as const,
    sequence: input.sequence,
    previousDigest: input.previousDigest,
    actor: input.actor.trim(),
    type: input.type ?? "transition",
    summary: input.summary.trim(),
    createdAt: input.createdAt,
    stateBeforeDigest: digestJson(input.stateBefore),
    stateAfterDigest: digestJson(input.stateAfter),
    state: input.stateAfter,
  };
  return { ...body, digest: digestJson(body) };
}

export function verifyJournalEvent<TState extends JsonValue>(
  value: JournalEvent<TState>,
  expected: {
    sequence: number;
    previousDigest: string;
    stateBefore: TState | null;
  },
): void {
  if (value.schemaVersion !== 1) {
    throw new Error(`Unsupported journal event schema: ${String(value.schemaVersion)}`);
  }
  if (value.sequence !== expected.sequence) {
    throw new Error(`Journal sequence gap: expected ${expected.sequence}, got ${value.sequence}.`);
  }
  if (value.previousDigest !== expected.previousDigest) {
    throw new Error(`Journal event ${value.sequence} has a broken previous digest.`);
  }
  if (
    !["transition", "compaction-boundary", "migration"].includes(value.type)
    || typeof value.actor !== "string"
    || !value.actor.trim()
    || typeof value.summary !== "string"
    || !value.summary.trim()
  ) {
    throw new Error(`Journal event ${value.sequence} has invalid semantic metadata.`);
  }
  assertDigest(value.previousDigest, `Journal event ${value.sequence} previous digest`);
  assertDigest(value.stateBeforeDigest, `Journal event ${value.sequence} state-before digest`);
  assertDigest(value.stateAfterDigest, `Journal event ${value.sequence} state-after digest`);
  assertDigest(value.digest, `Journal event ${value.sequence} digest`);
  assertTimestamp(value.createdAt, `Journal event ${value.sequence} timestamp`);
  if (value.stateBeforeDigest !== digestJson(expected.stateBefore)) {
    throw new Error(`Journal event ${value.sequence} has a stale state-before digest.`);
  }
  if (value.stateAfterDigest !== digestJson(value.state)) {
    throw new Error(`Journal event ${value.sequence} has a stale state-after digest.`);
  }
  const { digest, ...body } = value;
  if (digestJson(body) !== digest) {
    throw new Error(`Journal event ${value.sequence} failed its body digest.`);
  }
}

function verifySnapshot<TState extends JsonValue>(
  snapshot: JournalSnapshot<TState>,
  feature?: string,
): void {
  if (snapshot.schemaVersion !== 1) {
    throw new Error(`Unsupported journal snapshot schema: ${String(snapshot.schemaVersion)}`);
  }
  if (feature !== undefined && snapshot.feature !== feature) {
    throw new Error(`Journal snapshot belongs to ${snapshot.feature}, not ${feature}.`);
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(snapshot.feature)) {
    throw new Error("Journal snapshot has an invalid feature id.");
  }
  if (!Number.isSafeInteger(snapshot.lastSequence) || snapshot.lastSequence < 1) {
    throw new Error("Journal snapshot has an invalid sequence.");
  }
  assertDigest(snapshot.lastEventDigest, "Snapshot event digest");
  assertDigest(snapshot.stateDigest, "Snapshot state digest");
  assertDigest(snapshot.digest, "Snapshot digest");
  assertTimestamp(snapshot.compactedAt, "Snapshot compaction timestamp");
  if (snapshot.stateDigest !== digestJson(snapshot.state)) {
    throw new Error("Journal snapshot has a stale state digest.");
  }
  const { digest, ...body } = snapshot;
  if (digestJson(body) !== digest) {
    throw new Error("Journal snapshot failed its body digest.");
  }
}

async function readJson<T>(path: string): Promise<T> {
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`Journal storage must be a regular non-symbolic file: ${path}`);
  }
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return false;
      throw error;
    },
  );
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

async function writeAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, path);
    await syncDirectory(dirname(path));
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function eventPath(directory: string, sequence: number): string {
  return join(directory, `${String(sequence).padStart(8, "0")}.json`);
}

export async function readJournal<TState extends JsonValue>(
  directory: string,
  feature?: string,
): Promise<JournalReadResult<TState>> {
  const snapshotPath = join(directory, "snapshot.json");
  const snapshot = (await exists(snapshotPath))
    ? await readJson<JournalSnapshot<TState>>(snapshotPath)
    : null;
  if (snapshot) verifySnapshot(snapshot, feature);

  let names: string[] = [];
  try {
    names = (await readdir(directory))
      .filter((name) => EVENT_NAME.test(name))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  let state: TState | null = snapshot?.state ?? null;
  let lastSequence = snapshot?.lastSequence ?? 0;
  let lastEventDigest = snapshot?.lastEventDigest ?? (feature ? journalGenesisDigest(feature) : "");
  if (!snapshot && !feature && names.length > 0) {
    throw new Error("Reading an uncompacted journal requires its feature id.");
  }
  const events: JournalEvent<TState>[] = [];
  for (const name of names) {
    const match = EVENT_NAME.exec(name);
    const fileSequence = Number(match?.[1]);
    if (fileSequence <= lastSequence) {
      throw new Error(`Journal event ${name} overlaps the compacted snapshot.`);
    }
    const event = await readJson<JournalEvent<TState>>(join(directory, name));
    verifyJournalEvent(event, {
      sequence: lastSequence + 1,
      previousDigest: lastEventDigest,
      stateBefore: state,
    });
    if (event.sequence !== fileSequence) {
      throw new Error(`Journal filename ${name} does not match its sequence.`);
    }
    events.push(event);
    state = event.state;
    lastSequence = event.sequence;
    lastEventDigest = event.digest;
  }
  return { snapshot, events, state, lastSequence, lastEventDigest };
}

export async function appendJournalEvent<TState extends JsonValue>(input: {
  directory: string;
  feature: string;
  actor: string;
  summary: string;
  state: TState;
  type?: JournalEvent["type"];
  now?: () => Date;
}): Promise<JournalEvent<TState>> {
  await mkdir(input.directory, { recursive: true });
  const journal = await readJournal<TState>(input.directory, input.feature);
  const event = createJournalEvent({
    sequence: journal.lastSequence + 1,
    previousDigest: journal.lastEventDigest,
    actor: input.actor,
    ...(input.type === undefined ? {} : { type: input.type }),
    summary: input.summary,
    createdAt: (input.now ?? (() => new Date()))().toISOString(),
    stateBefore: journal.state,
    stateAfter: input.state,
  });
  await writeExclusive(eventPath(input.directory, event.sequence), event);
  return event;
}

function transactionDigest<TState extends JsonValue>(
  transaction: Omit<CompactionTransaction<TState>, "digest">,
): string {
  return digestJson(transaction);
}

function verifyTransaction<TState extends JsonValue>(
  transaction: CompactionTransaction<TState>,
): void {
  if (
    transaction.schemaVersion !== 1
    || typeof transaction.id !== "string"
    || !transaction.id
    || !["prepared", "snapshot-promoted", "boundary-written"].includes(transaction.phase)
    || typeof transaction.oldSnapshotPresent !== "boolean"
  ) {
    throw new Error("Compaction transaction has invalid lifecycle metadata.");
  }
  const { digest, ...body } = transaction;
  if (transactionDigest(body) !== digest) {
    throw new Error("Compaction transaction failed its digest check.");
  }
  verifySnapshot(transaction.snapshot);
  const boundary = transaction.boundary;
  if (
    boundary.type !== "compaction-boundary"
    || boundary.sequence !== transaction.snapshot.lastSequence + 1
    || boundary.previousDigest !== transaction.snapshot.lastEventDigest
    || boundary.stateBeforeDigest !== transaction.snapshot.stateDigest
    || boundary.stateAfterDigest !== transaction.snapshot.stateDigest
    || digestJson(boundary.state) !== transaction.snapshot.stateDigest
  ) {
    throw new Error("Compaction boundary does not match its snapshot.");
  }
  verifyJournalEvent(boundary, {
    sequence: transaction.snapshot.lastSequence + 1,
    previousDigest: transaction.snapshot.lastEventDigest,
    stateBefore: transaction.snapshot.state,
  });
}

export type CompactionFaultPoint =
  | "after-prepare"
  | "after-snapshot"
  | "after-boundary";

async function maybeFault(
  point: CompactionFaultPoint,
  requested: CompactionFaultPoint | undefined,
): Promise<void> {
  if (point === requested) {
    throw new Error(`Injected compaction fault: ${point}`);
  }
}

async function finishCompaction<TState extends JsonValue>(
  directory: string,
  transaction: CompactionTransaction<TState>,
): Promise<JournalSnapshot<TState>> {
  const markerPath = join(directory, "compaction.json");
  const snapshotPath = join(directory, "snapshot.json");
  const candidatePath = join(directory, "snapshot.candidate.json");
  const previousPath = join(directory, "snapshot.previous.json");
  const boundaryPath = eventPath(directory, transaction.boundary.sequence);

  if (await exists(candidatePath)) {
    if (await exists(snapshotPath)) {
      const current = await readJson<JournalSnapshot<TState>>(snapshotPath);
      if (current.digest !== transaction.snapshot.digest) {
        if (await exists(previousPath)) {
          throw new Error("Compaction recovery found conflicting current and previous snapshots.");
        }
        await rename(snapshotPath, previousPath);
        await rename(candidatePath, snapshotPath);
      } else {
        await rm(candidatePath, { force: true });
      }
    } else {
      await rename(candidatePath, snapshotPath);
    }
    await syncDirectory(directory);
  } else if (!(await exists(snapshotPath))) {
    throw new Error("Compaction recovery is missing both its candidate and promoted snapshot.");
  }
  const promoted = await readJson<JournalSnapshot<TState>>(snapshotPath);
  verifySnapshot(promoted, transaction.snapshot.feature);
  if (promoted.digest !== transaction.snapshot.digest) {
    throw new Error("Promoted compaction snapshot does not match its transaction.");
  }

  if (!(await exists(boundaryPath))) {
    await writeExclusive(boundaryPath, transaction.boundary);
  } else {
    const existingBoundary = await readJson<JournalEvent<TState>>(boundaryPath);
    if (canonicalJson(existingBoundary) !== canonicalJson(transaction.boundary)) {
      throw new Error("Compaction boundary conflicts with the transaction.");
    }
  }

  for (const name of await readdir(directory)) {
    const match = EVENT_NAME.exec(name);
    if (match && Number(match[1]) <= transaction.snapshot.lastSequence) {
      await rm(join(directory, name), { force: true });
    }
  }
  await rm(candidatePath, { force: true });
  await syncDirectory(directory);
  await readJournal<TState>(directory, transaction.snapshot.feature);
  await rm(previousPath, { force: true });
  await rm(markerPath, { force: true });
  await syncDirectory(directory);
  return promoted;
}

export async function recoverCompaction<TState extends JsonValue>(
  directory: string,
): Promise<JournalSnapshot<TState> | null> {
  const markerPath = join(directory, "compaction.json");
  if (!(await exists(markerPath))) return null;
  const transaction = await readJson<CompactionTransaction<TState>>(markerPath);
  verifyTransaction(transaction);
  try {
    return await finishCompaction(directory, transaction);
  } catch (error) {
    // The marker, candidate/previous snapshot, and boundary are intentionally
    // retained. A later recovery can safely roll forward even if compacted
    // event deletion was only partially completed.
    throw error;
  }
}

export async function compactJournal<TState extends JsonValue>(input: {
  directory: string;
  feature: string;
  actor?: string;
  now?: () => Date;
  faultAt?: CompactionFaultPoint;
}): Promise<JournalSnapshot<TState>> {
  await mkdir(input.directory, { recursive: true });
  await recoverCompaction<TState>(input.directory);
  const journal = await readJournal<TState>(input.directory, input.feature);
  if (!journal.state || journal.lastSequence < 1) {
    throw new Error("Cannot compact an empty journal.");
  }
  const compactedAt = (input.now ?? (() => new Date()))().toISOString();
  const snapshotBody = {
    schemaVersion: 1 as const,
    feature: input.feature,
    lastSequence: journal.lastSequence,
    lastEventDigest: journal.lastEventDigest,
    stateDigest: digestJson(journal.state),
    state: journal.state,
    compactedAt,
  };
  const snapshot: JournalSnapshot<TState> = {
    ...snapshotBody,
    digest: digestJson(snapshotBody),
  };
  const boundary = createJournalEvent({
    sequence: journal.lastSequence + 1,
    previousDigest: journal.lastEventDigest,
    actor: input.actor ?? "empirical-compaction",
    type: "compaction-boundary",
    summary: `Compacted through journal event ${journal.lastSequence}`,
    createdAt: compactedAt,
    stateBefore: journal.state,
    stateAfter: journal.state,
  });
  const body: Omit<CompactionTransaction<TState>, "digest"> = {
    schemaVersion: 1,
    id: randomUUID(),
    phase: "prepared",
    snapshot,
    boundary,
    oldSnapshotPresent: journal.snapshot !== null,
  };
  let transaction: CompactionTransaction<TState> = {
    ...body,
    digest: transactionDigest(body),
  };
  const markerPath = join(input.directory, "compaction.json");
  const candidatePath = join(input.directory, "snapshot.candidate.json");
  const snapshotPath = join(input.directory, "snapshot.json");
  const previousPath = join(input.directory, "snapshot.previous.json");
  await writeExclusive(candidatePath, snapshot);
  await writeExclusive(markerPath, transaction);
  await maybeFault("after-prepare", input.faultAt);
  if (await exists(snapshotPath)) {
    await rename(snapshotPath, previousPath);
  }
  await rename(candidatePath, snapshotPath);
  transaction = {
    ...transaction,
    phase: "snapshot-promoted",
    digest: "",
  };
  transaction.digest = transactionDigest(
    Object.fromEntries(
      Object.entries(transaction).filter(([key]) => key !== "digest"),
    ) as unknown as Omit<CompactionTransaction<TState>, "digest">,
  );
  await writeAtomic(markerPath, transaction);
  await maybeFault("after-snapshot", input.faultAt);
  await writeExclusive(eventPath(input.directory, boundary.sequence), boundary);
  transaction = { ...transaction, phase: "boundary-written", digest: "" };
  transaction.digest = transactionDigest(
    Object.fromEntries(
      Object.entries(transaction).filter(([key]) => key !== "digest"),
    ) as unknown as Omit<CompactionTransaction<TState>, "digest">,
  );
  await writeAtomic(markerPath, transaction);
  await maybeFault("after-boundary", input.faultAt);
  return finishCompaction(input.directory, transaction);
}
