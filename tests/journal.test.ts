import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  appendJournalEvent,
  compactJournal,
  journalGenesisDigest,
  readJournal,
  recoverCompaction,
  type CompactionFaultPoint,
  type JournalEvent,
} from "../src/journal.js";
import { digestJson, type JsonValue } from "../src/protocol.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function journalRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "empirical-journal-"));
  roots.push(root);
  return join(root, "events");
}

async function seed(directory: string): Promise<void> {
  const times = [
    new Date("2026-08-03T10:00:00Z"),
    new Date("2026-08-03T10:00:01Z"),
    new Date("2026-08-03T10:00:02Z"),
  ];
  await appendJournalEvent({
    directory,
    feature: "journal-feature",
    actor: "tester",
    summary: "Started",
    state: { revision: 1, phase: "implement" },
    now: () => times.shift()!,
  });
  await appendJournalEvent({
    directory,
    feature: "journal-feature",
    actor: "tester",
    summary: "Verified",
    state: { revision: 2, phase: "verify" },
    now: () => times.shift()!,
  });
  await appendJournalEvent({
    directory,
    feature: "journal-feature",
    actor: "tester",
    summary: "Integrated",
    state: { revision: 3, phase: "integrate" },
    now: () => times.shift()!,
  });
}

describe("hash-chained journal", () => {
  test("appends a linked deterministic chain and reduces current state", async () => {
    const directory = await journalRoot();
    await seed(directory);
    const journal = await readJournal(directory, "journal-feature");
    expect(journal.events).toHaveLength(3);
    expect(journal.events[0]?.previousDigest).toBe(journalGenesisDigest("journal-feature"));
    expect(journal.events[1]?.previousDigest).toBe(journal.events[0]?.digest);
    expect(journal.events[2]?.previousDigest).toBe(journal.events[1]?.digest);
    expect(journal.state).toEqual({ revision: 3, phase: "integrate" });
    expect(journal.lastSequence).toBe(3);
  });

  test("rejects filename, link, body, and state tampering", async () => {
    for (const tamper of ["filename", "link", "body", "state"] as const) {
      const directory = await journalRoot();
      await seed(directory);
      const path = join(directory, "00000002.json");
      const event = JSON.parse(await readFile(path, "utf8")) as JournalEvent;
      if (tamper === "filename") {
        await writeFile(join(directory, "00000004.json"), JSON.stringify(event), "utf8");
        await rm(path);
      } else if (tamper === "link") {
        event.previousDigest = journalGenesisDigest("journal-feature");
        await writeFile(path, JSON.stringify(event), "utf8");
      } else if (tamper === "body") {
        event.summary = "Edited";
        await writeFile(path, JSON.stringify(event), "utf8");
      } else {
        event.state = { revision: 99 } as JsonValue;
        await writeFile(path, JSON.stringify(event), "utf8");
      }
      await expect(readJournal(directory, "journal-feature")).rejects.toThrow();
    }
  });

  test("rejects semantically invalid re-digested events and symbolic event files", async () => {
    const semanticDirectory = await journalRoot();
    await seed(semanticDirectory);
    const semanticPath = join(semanticDirectory, "00000002.json");
    const event = JSON.parse(await readFile(semanticPath, "utf8")) as JournalEvent;
    const { digest: _digest, ...body } = { ...event, actor: "" };
    await writeFile(semanticPath, JSON.stringify({ ...body, digest: digestJson(body) }), "utf8");
    await expect(readJournal(semanticDirectory, "journal-feature")).rejects.toThrow("semantic metadata");

    const linkedDirectory = await journalRoot();
    await seed(linkedDirectory);
    const linkedPath = join(linkedDirectory, "00000002.json");
    const externalPath = join(linkedDirectory, "..", "external-event.json");
    await writeFile(externalPath, await readFile(linkedPath));
    await rm(linkedPath);
    await symlink(externalPath, linkedPath);
    await expect(readJournal(linkedDirectory, "journal-feature")).rejects.toThrow("non-symbolic");
  });

  test("compacts around a verified snapshot boundary and remains appendable", async () => {
    const directory = await journalRoot();
    await seed(directory);
    const snapshot = await compactJournal({
      directory,
      feature: "journal-feature",
      now: () => new Date("2026-08-03T11:00:00Z"),
    });
    expect(snapshot.lastSequence).toBe(3);
    expect((await readdir(directory)).sort()).toEqual([
      "00000004.json",
      "snapshot.json",
    ]);
    const compacted = await readJournal(directory, "journal-feature");
    expect(compacted.snapshot?.digest).toBe(snapshot.digest);
    expect(compacted.events[0]?.type).toBe("compaction-boundary");
    expect(compacted.state).toEqual({ revision: 3, phase: "integrate" });

    await appendJournalEvent({
      directory,
      feature: "journal-feature",
      actor: "tester",
      summary: "Done",
      state: { revision: 4, phase: "done" },
      now: () => new Date("2026-08-03T12:00:00Z"),
    });
    expect((await readJournal(directory, "journal-feature")).lastSequence).toBe(5);
  });

  test("recovers transactionally from every compaction interruption", async () => {
    for (const faultAt of [
      "after-prepare",
      "after-snapshot",
      "after-boundary",
    ] satisfies CompactionFaultPoint[]) {
      const directory = await journalRoot();
      await seed(directory);
      await expect(
        compactJournal({
          directory,
          feature: "journal-feature",
          faultAt,
          now: () => new Date("2026-08-03T11:00:00Z"),
        }),
      ).rejects.toThrow(`Injected compaction fault: ${faultAt}`);
      const recovered = await recoverCompaction(directory);
      expect(recovered?.lastSequence).toBe(3);
      const journal = await readJournal(directory, "journal-feature");
      expect(journal.state).toEqual({ revision: 3, phase: "integrate" });
      expect(journal.events).toHaveLength(1);
      expect(journal.events[0]?.type).toBe("compaction-boundary");
      expect(await readdir(directory)).not.toContain("compaction.json");
    }
  });

  test("repeated compaction preserves the latest chain boundary", async () => {
    const directory = await journalRoot();
    await seed(directory);
    await compactJournal({
      directory,
      feature: "journal-feature",
      now: () => new Date("2026-08-03T11:00:00Z"),
    });
    await appendJournalEvent({
      directory,
      feature: "journal-feature",
      actor: "tester",
      summary: "Reviewed",
      state: { revision: 4, phase: "review" },
      now: () => new Date("2026-08-03T11:30:00Z"),
    });
    const snapshot = await compactJournal({
      directory,
      feature: "journal-feature",
      now: () => new Date("2026-08-03T12:00:00Z"),
    });
    expect(snapshot.lastSequence).toBe(5);
    const journal = await readJournal(directory, "journal-feature");
    expect(journal.lastSequence).toBe(6);
    expect(journal.state).toEqual({ revision: 4, phase: "review" });
  });

  test("recovers every interrupted compaction when a previous snapshot exists", async () => {
    for (const faultAt of [
      "after-prepare",
      "after-snapshot",
      "after-boundary",
    ] satisfies CompactionFaultPoint[]) {
      const directory = await journalRoot();
      await seed(directory);
      await compactJournal({
        directory,
        feature: "journal-feature",
        now: () => new Date("2026-08-03T11:00:00Z"),
      });
      await appendJournalEvent({
        directory,
        feature: "journal-feature",
        actor: "tester",
        summary: "Reviewed",
        state: { revision: 4, phase: "review" },
        now: () => new Date("2026-08-03T11:30:00Z"),
      });
      await expect(compactJournal({
        directory,
        feature: "journal-feature",
        faultAt,
        now: () => new Date("2026-08-03T12:00:00Z"),
      })).rejects.toThrow(`Injected compaction fault: ${faultAt}`);
      await recoverCompaction(directory);
      const recovered = await readJournal(directory, "journal-feature");
      expect(recovered.snapshot?.state).toEqual({ revision: 4, phase: "review" });
      expect(recovered.events.map((event) => event.type)).toEqual(["compaction-boundary"]);
      expect(recovered.lastSequence).toBe(6);
    }
  });
});
