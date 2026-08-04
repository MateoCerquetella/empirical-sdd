import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { EmpiricalProject } from "../src/core.js";
import {
  createDiscoveryRecord,
  materialFollowUp,
  recommendWorkflow,
  saveDiscovery,
  socraticQuestions,
  type DiscoveryRecord,
  type SocraticAnswer,
} from "../src/discovery.js";
import { EmpiricalError } from "../src/errors.js";

const directories: string[] = [];
const cliPath = resolve(import.meta.dir, "../src/cli.ts");

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryProject(): Promise<{ root: string; project: EmpiricalProject }> {
  const root = await mkdtemp(join(tmpdir(), "empirical-discovery-"));
  directories.push(root);
  const { project } = await EmpiricalProject.initialize(root, { integrations: false });
  return { root, project };
}

async function runInteractive(
  root: string,
  problem: string,
  input: string,
  options: { agent?: "codex" | "none"; env?: Record<string, string | undefined> } = {},
) {
  const process = Bun.spawn([
    Bun.argv[0]!,
    "run",
    cliPath,
    "__internal",
    "explore",
    problem,
    "--interactive",
    "--agent",
    options.agent ?? "none",
    "--root",
    root,
  ], {
    stdin: Buffer.from(`${input}\n`),
    stdout: "pipe",
    stderr: "pipe",
    ...(options.env ? { env: options.env } : {}),
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  return { stdout, stderr, exitCode };
}

async function onlyDiscovery(root: string): Promise<DiscoveryRecord> {
  const names = await readdir(join(root, ".empirical", "discoveries"));
  expect(names).toHaveLength(1);
  return JSON.parse(await readFile(
    join(root, ".empirical", "discoveries", names[0]!, "interview.json"),
    "utf8",
  )) as DiscoveryRecord;
}

function completeAnswers(problem: string): SocraticAnswer[] {
  const questions = socraticQuestions(problem);
  const responses = [
    "Repository developers need a reliable way to turn vague feature ideas into reviewable contracts.",
    "The developer approves one complete contract and sees a Complex Specify action created from it.",
    "Include durable discovery and exact handoff only; no UI, hosted service, or automatic external-agent launch.",
    "Invalid or interrupted answers must fail safely and preserve the last valid draft without creating workflow state.",
    "Integration tests assert every saved pass, the exact refined request, rejection behavior, and the created specification.",
  ];
  return questions.map((question, index) => ({
    ...question,
    answer: responses[index]!,
    followUp: null,
  }));
}

describe("Socratic discovery", () => {
  test("restores five domain-aware passes and only material follow-ups", () => {
    const problem = "Build a browser game with cursor time loops";
    const questions = socraticQuestions(problem);

    expect(questions.map((question) => question.pass)).toEqual([
      "problem",
      "outcome",
      "boundaries",
      "risks",
      "verification",
    ]);
    expect(questions[1]!.question).toContain("playable loop");
    expect(questions[4]!.question).toContain("real browser");
    expect(socraticQuestions("Improve onboarding", "The user completes a browser screen")[4]!.question)
      .toContain("real browser");
    expect(materialFollowUp(problem, questions[1]!, "Record a cursor loop")).toContain("wins or completes");
    expect(materialFollowUp(
      problem,
      questions[1]!,
      "The player records a cursor loop, wins at the exit, and fails when time expires.",
    )).toBeNull();
    expect(recommendWorkflow(problem, [])).toBe("complex");
  });

  test("agent-native discovery saves progressive answers and binds the approved brief exactly to Complex", async () => {
    const { root, project } = await temporaryProject();
    const problem = "Design a durable Socratic specification workflow";
    const answers = completeAnswers(problem);
    const opened = await project.discovery({ problem, answers: [] });
    let id: string | undefined = opened.record.id;
    expect(opened.nextQuestion).toMatchObject({ pass: "problem", kind: "pass" });

    for (let index = 1; index <= answers.length; index += 1) {
      const saved = await project.discovery({
        ...(id ? { id } : {}),
        problem,
        answers: answers.slice(0, index),
      });
      id = saved.record.id;
      expect(saved.record).toMatchObject({ status: "draft", answers: { length: index } });
      expect(saved.start).toBeNull();
      expect(saved.nextQuestion?.pass ?? null)
        .toBe(index === answers.length ? null : answers[index]!.pass);
      expect(await readFile(join(root, saved.paths.markdown), "utf8")).toContain(`Pass ${String(index)}`);
    }

    const approved = await project.discovery({ id: id!, problem, answers, approved: true });
    expect(approved.record).toMatchObject({
      status: "started",
      workflow: "complex",
      handoff: { revision: 1 },
    });
    expect(approved.start).toMatchObject({ kind: "action", phase: "specify", revision: 1 });
    expect(approved.refinedRequest).toContain("Approved Socratic discovery");
    expect(await project.status()).toMatchObject({ request: approved.refinedRequest });
    expect(await project.store.readSpec(approved.record.handoff!.feature))
      .toContain("Approved Socratic discovery:");

    const repeated = await project.discovery({ id: id!, problem, answers, approved: true });
    expect(repeated.record).toEqual(approved.record);
    expect(repeated.start).toMatchObject({
      kind: "action",
      feature: approved.record.handoff!.feature,
      phase: "specify",
      revision: 1,
    });
  });

  test("agent-native discovery rejects incomplete, reordered, changed, and unknown submissions without starting work", async () => {
    const { project } = await temporaryProject();
    const problem = "Clarify a reporting workflow";
    const answers = completeAnswers(problem);

    await expect(project.discovery({ problem, answers: [answers[1]!] }))
      .rejects.toMatchObject({ code: "INVALID_DISCOVERY" });
    await expect(project.discovery({ problem, answers: answers.slice(0, 4), approved: true }))
      .rejects.toMatchObject({ code: "INVALID_DISCOVERY" });

    const draft = await project.discovery({ problem, answers: answers.slice(0, 2) });
    await expect(project.discovery({
      id: draft.record.id,
      problem,
      answers: [{ ...answers[0]!, answer: "Repository developers changed this persisted answer." }, answers[1]!],
    })).rejects.toMatchObject({ code: "DISCOVERY_MISMATCH" });
    await expect(project.discovery({ id: "missing-discovery", problem, answers: [] }))
      .rejects.toMatchObject({ code: "DISCOVERY_NOT_FOUND" });
    expect(await project.status()).toMatchObject({ phase: "idle", revision: 0, activeFeature: null });
  });

  test("agent-native discovery returns and enforces only material follow-ups", async () => {
    const { project } = await temporaryProject();
    const problem = "Clarify a repository feature";
    const answers = completeAnswers(problem);
    const first = await project.discovery({ problem, answers: answers.slice(0, 1) });
    const vagueOutcome = { ...answers[1]!, answer: "Simple", followUp: null };
    const needsFollowUp = await project.discovery({
      id: first.record.id,
      problem,
      answers: [answers[0]!, vagueOutcome],
    });
    expect(needsFollowUp.nextQuestion).toMatchObject({ pass: "outcome", kind: "follow_up" });

    await expect(project.discovery({
      id: first.record.id,
      problem,
      answers: [answers[0]!, vagueOutcome, answers[2]!],
    })).rejects.toMatchObject({ code: "INVALID_DISCOVERY" });

    const resolved = await project.discovery({
      id: first.record.id,
      problem,
      answers: [answers[0]!, {
        ...vagueOutcome,
        followUp: {
          question: needsFollowUp.nextQuestion!.question,
          answer: "The developer sees one complete observable specification ready for review.",
        },
      }],
    });
    expect(resolved.nextQuestion).toMatchObject({ pass: "boundaries", kind: "pass" });
  });

  test("private discovery CLI accepts structured input while the public command stays unavailable", async () => {
    const { root } = await temporaryProject();
    const problem = "Clarify a CLI-backed specification";
    const inputPath = join(root, "discovery-input.json");
    await writeFile(inputPath, JSON.stringify({
      problem,
      answers: completeAnswers(problem),
      approved: true,
    }), "utf8");
    const child = Bun.spawn([
      Bun.argv[0]!, "run", cliPath, "__internal", "discovery",
      "--input", inputPath, "--json", "--root", root,
    ], { stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toMatchObject({
      record: { status: "started", workflow: "complex" },
      start: { kind: "action", phase: "specify", revision: 1 },
    });
  });

  test("interactive Explore saves every pass, refines the request, and starts Complex after approval", async () => {
    const { root, project } = await temporaryProject();
    const result = await runInteractive(
      root,
      "Build a browser game with cooperative cursor time loops",
      [
        "Players who enjoy short cooperative puzzle games need a solo-friendly way to coordinate actions.",
        "The player records a cursor loop that replays beside the current cursor.",
        "The player wins by reaching the exit with all switches active and fails when the timer expires.",
        "Include three desktop levels and local progress; no backend, multiplayer, mobile, or level editor.",
        "Replay drift can make a level impossible, so invalid recordings must reset clearly and safely.",
        "Use Playwright browser interactions for each level and screenshot the loop, failure, and win states.",
        "a",
        "",
      ].join("\n"),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Pass 1/5 · Problem and user");
    expect(result.stdout).toContain("Pass 5/5 · Verification");
    expect(result.stdout).toContain("Do not enter secrets or credentials");
    expect(result.stdout).toContain("One material follow-up:");
    expect(result.stdout).toContain("Refined request");
    expect(result.stdout).toContain("step 1/10");

    const record = await onlyDiscovery(root);
    expect(record.status).toBe("started");
    expect(record.workflow).toBe("complex");
    expect(record.answers).toHaveLength(5);
    expect(record.answers[1]!.followUp?.answer).toContain("wins by reaching the exit");
    expect(record.refinedRequest).toContain("Approved Socratic discovery");
    expect(record.handoff).toMatchObject({ revision: 1 });
    expect(await readFile(
      join(root, ".empirical", "discoveries", record.id, "brief.md"),
      "utf8",
    )).toContain("## Workflow handoff");
    expect(await project.status()).toMatchObject({
      profile: "complex",
      phase: "specify",
      status: "waiting",
      revision: 1,
    });
    expect(await project.store.readSpec(record.handoff!.feature)).toContain("Approved Socratic discovery");
  });

  test("an approved interview can be saved without creating workflow state", async () => {
    const { root, project } = await temporaryProject();
    const result = await runInteractive(
      root,
      "Improve report sharing",
      [
        "Report authors need to share immutable published reports without manual copying.",
        "A user creates one stable share link and a recipient opens the same published report.",
        "Include link creation and revocation only; no editing, analytics, or public discovery.",
        "Invalid or revoked links must fail safely with a clear error and no report disclosure.",
        "Run integration tests that assert creation, opening, revocation, and invalid-link denial.",
        "a",
        "s",
      ].join("\n"),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("approved brief was saved without starting workflow state");
    expect(await onlyDiscovery(root)).toMatchObject({ status: "approved", workflow: null, handoff: null });
    expect(await project.status()).toMatchObject({ phase: "idle", revision: 0 });
  });

  test("packet mode remains read-only and explicit about how to enter the interview", async () => {
    const { root, project } = await temporaryProject();
    const configBefore = await readFile(project.store.configPath, "utf8");
    const specsBefore = await readdir(join(root, ".empirical", "specs"));
    const child = Bun.spawn([
      Bun.argv[0]!,
      "run",
      cliPath,
      "__internal",
      "explore",
      "Investigate a vague reporting idea",
      "--no-interview",
      "--root",
      root,
    ], { stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("packet mode (read-only)");
    expect(stdout).toContain("add --interactive");
    expect(await readFile(project.store.configPath, "utf8")).toBe(configBefore);
    expect(await readdir(join(root, ".empirical", "specs"))).toEqual(specsBefore);
    expect(await readdir(join(root, ".empirical", "discoveries")).then(
      () => true,
      () => false,
    )).toBe(false);
  });

  test(":quit preserves the latest draft without starting a workflow", async () => {
    const { root, project } = await temporaryProject();
    const result = await runInteractive(root, "Explore an uncertain feature", ":quit");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("stopped safely");
    expect(await onlyDiscovery(root)).toMatchObject({ status: "draft", answers: [], handoff: null });
    expect(await project.status()).toMatchObject({ phase: "idle", revision: 0 });
  });

  test("an explicit Codex launch keeps the approved workflow resumable when Codex is unavailable", async () => {
    const { root, project } = await temporaryProject();
    const result = await runInteractive(
      root,
      "Fix one dashboard label typo",
      [
        "Dashboard users see a misspelled heading that makes the report harder to scan.",
        "The dashboard heading displays the corrected text after the page loads.",
        "Change only one heading label; no layout, styling, or other copy changes.",
        "A wrong selector risks changing another label, so failure must leave unrelated text untouched.",
        "A focused unit test asserts the exact corrected heading and unchanged neighboring labels.",
        "a",
        "",
      ].join("\n"),
      { agent: "codex", env: { ...process.env, PATH: "" } },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Launching Codex");
    expect(result.stderr).toContain("Codex could not be launched");
    expect(await project.status()).toMatchObject({ profile: "fast", phase: "implement", revision: 1 });
    expect(await onlyDiscovery(root)).toMatchObject({ status: "started", workflow: "fast" });
  });

  test("discovery persistence rejects a symbolic-link root", async () => {
    const { root } = await temporaryProject();
    const outside = await mkdtemp(join(tmpdir(), "empirical-discovery-outside-"));
    directories.push(outside);
    await symlink(outside, join(root, ".empirical", "discoveries"), "dir");

    try {
      await saveDiscovery(root, createDiscoveryRecord("Explore safe storage"));
      throw new Error("Expected discovery storage to reject a symbolic link");
    } catch (error) {
      expect(error).toBeInstanceOf(EmpiricalError);
      expect((error as EmpiricalError).code).toBe("UNSAFE_DISCOVERY_PATH");
    }
  });

  test("discovery persistence rejects traversal identifiers", async () => {
    const { root } = await temporaryProject();
    const record = { ...createDiscoveryRecord("Explore safe identifiers"), id: "../escaped" };

    try {
      await saveDiscovery(root, record);
      throw new Error("Expected discovery storage to reject traversal");
    } catch (error) {
      expect(error).toBeInstanceOf(EmpiricalError);
      expect((error as EmpiricalError).code).toBe("INVALID_DISCOVERY");
    }
  });
});
