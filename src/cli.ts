#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { EmpiricalProject } from "./core.js";
import { EmpiricalError, asErrorMessage } from "./errors.js";
import { runMcpServer } from "./mcp.js";
import { PRODUCT_VERSION, type CompletionInput, type Evidence, type Workflow } from "./types.js";

interface CliContext {
  args: string[];
  root: string;
  json: boolean;
}

async function main(): Promise<void> {
  const context = parseGlobals(process.argv.slice(2));
  const command = context.args.shift();

  if (!command) {
    try {
      const project = await EmpiricalProject.open(context.root);
      emit(await project.next(), context.json, renderAction);
    } catch (error) {
      if (error instanceof EmpiricalError && error.code === "PROJECT_NOT_INITIALIZED") {
        printHelp();
        return;
      }
      throw error;
    }
    return;
  }

  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }
  if (command === "version" || command === "--version" || command === "-v") {
    console.log(PRODUCT_VERSION);
    return;
  }
  if (command === "mcp") {
    await runMcpServer(context.root);
    return;
  }

  switch (command) {
    case "init": {
      const profile = readProfile(context.args);
      const result = await EmpiricalProject.initialize(context.root, {
        ...(profile ? { profile } : {}),
        integrations: !takeFlag(context.args, "--no-integrations"),
      });
      emit(
        { state: result.state, integrations: result.integrations, next: await result.project.next() },
        context.json,
        () => `Empirical is ready in ${result.project.store.root}. Reopen your agent once, then ask for the change normally.`,
      );
      return;
    }
    case "adopt": {
      const profile = readProfile(context.args);
      const result = await EmpiricalProject.adopt(context.root, {
        ...(profile ? { profile } : {}),
        integrations: !takeFlag(context.args, "--no-integrations"),
      });
      emit(
        { state: result.state, integrations: result.integrations, next: await result.project.next() },
        context.json,
        () => "Empirical v1 was adopted without deleting ai/. The new source of truth is .empirical/.",
      );
      return;
    }
    case "fast": {
      const id = takeOption(context.args, "--id");
      const requestOption = takeOption(context.args, "--request");
      const request = requestOption ?? context.args.join(" ");
      const project = await EmpiricalProject.open(context.root);
      emit(
        await project.fast(request, { ...(id ? { id } : {}) }),
        context.json,
        renderAction,
      );
      return;
    }
    case "complex": {
      const id = takeOption(context.args, "--id");
      const requestOption = takeOption(context.args, "--request");
      const request = requestOption ?? context.args.join(" ");
      const project = await EmpiricalProject.open(context.root);
      emit(
        await project.complex(request, { ...(id ? { id } : {}) }),
        context.json,
        renderAction,
      );
      return;
    }
    case "start": {
      const profile = readProfile(context.args);
      const id = takeOption(context.args, "--id");
      const requestOption = takeOption(context.args, "--request");
      const request = requestOption ?? context.args.join(" ");
      const project = await EmpiricalProject.open(context.root);
      const action = await project.start(request, {
        ...(profile ? { profile } : {}),
        ...(id ? { id } : {}),
      });
      emit(action, context.json, renderAction);
      return;
    }
    case "loop": {
      if (context.args.length > 0) {
        throw new EmpiricalError(
          "INVALID_ARGUMENT",
          "empirical loop takes no request or profile; use empirical fast or empirical complex to start work",
        );
      }
      const project = await EmpiricalProject.open(context.root);
      const action = await project.loop();
      emit(action, context.json, renderLoopAction);
      return;
    }
    case "status": {
      const project = await EmpiricalProject.open(context.root);
      const state = await project.status();
      emit(state, context.json, (value) => {
        const item = value as typeof state;
        return `feature=${item.activeFeature ?? "none"} phase=${item.phase} status=${item.status} revision=${item.revision} profile=${item.profile}`;
      });
      return;
    }
    case "next": {
      const project = await EmpiricalProject.open(context.root);
      emit(await project.next(), context.json, renderAction);
      return;
    }
    case "complete": {
      if (takeFlag(context.args, "--help") || takeFlag(context.args, "-h")) {
        printCompleteHelp();
        return;
      }
      const project = await EmpiricalProject.open(context.root);
      const input = await completionInput(context.args);
      emit(await project.complete(input), context.json, renderAction);
      return;
    }
    case "verify": {
      const project = await EmpiricalProject.open(context.root);
      const report = await project.verify();
      emit(report, context.json, () => report.valid
        ? `Evidence is complete for ${report.criteria} acceptance criteria.`
        : `Evidence is incomplete: ${report.missing.join("; ")}`);
      if (!report.valid) process.exitCode = 2;
      return;
    }
    case "retry": {
      const revision = requiredInteger(context.args, "--revision");
      const actor = takeOption(context.args, "--actor") ?? "human";
      const project = await EmpiricalProject.open(context.root);
      emit(await project.retry(revision, actor), context.json, renderAction);
      return;
    }
    case "integrate": {
      const project = await EmpiricalProject.open(context.root);
      const report = await project.integrations();
      emit(report, context.json, () => `Agent discovery refreshed (${report.created.length} created, ${report.updated.length} updated, ${report.preserved.length} preserved).`);
      return;
    }
    case "doctor": {
      const project = await EmpiricalProject.open(context.root);
      emit(await project.doctor(), context.json, () => "Empirical is healthy: npm CLI, MCP, and filesystem state are available.");
      return;
    }
    case "migrate": {
      const project = await EmpiricalProject.open(context.root);
      const migration = await project.migrate();
      emit(migration, context.json, () => `Project schema is current (${String(migration.schemaVersion)}).`);
      return;
    }
    case "update": {
      if (takeFlag(context.args, "--check")) {
        console.log(`Installed ${PRODUCT_VERSION}. Check npm with: npm view empirical-sdd version`);
        return;
      }
      const npm = process.platform === "win32" ? "npm.cmd" : "npm";
      const result = spawnSync(npm, ["install", "-g", "empirical-sdd@latest"], { stdio: "inherit" });
      if (result.error || result.status !== 0) {
        throw new EmpiricalError("UPDATE_FAILED", result.error?.message ?? `npm exited with ${String(result.status)}`);
      }
      console.log("Empirical was updated. Run empirical migrate inside repositories only when prompted.");
      return;
    }
    default:
      throw new EmpiricalError("UNKNOWN_COMMAND", `Unknown command '${command}'. Run empirical help.`);
  }
}

function parseGlobals(argv: string[]): CliContext {
  const args = [...argv];
  const root = takeOption(args, "--root") ?? process.cwd();
  const json = takeFlag(args, "--json");
  return { args, root, json };
}

async function completionInput(args: string[]): Promise<CompletionInput> {
  const inputPath = takeOption(args, "--input");
  if (inputPath) {
    if (args.length > 0) {
      throw new EmpiricalError(
        "INVALID_ARGUMENT",
        `--input cannot be combined with other completion arguments: ${args.join(" ")}`,
      );
    }
    const text = inputPath === "-" ? await readStdin() : await readFile(inputPath, "utf8");
    return JSON.parse(text) as CompletionInput;
  }
  const revision = requiredInteger(args, "--revision");
  const outcome = takeOption(args, "--outcome") ?? "passed";
  if (!(["passed", "failed", "awaiting_human", "blocked"] as const).includes(
    outcome as CompletionInput["outcome"],
  )) {
    throw new EmpiricalError("INVALID_OUTCOME", `Invalid outcome '${outcome}'`);
  }
  const summary = takeOption(args, "--summary");
  if (!summary) throw new EmpiricalError("SUMMARY_REQUIRED", "Use --summary \"<what happened>\"");
  const actor = takeOption(args, "--actor");
  const evidencePath = takeOption(args, "--evidence");
  const testSummary = takeOption(args, "--test");
  const reviewSummary = takeOption(args, "--review");
  if (evidencePath && (testSummary || reviewSummary)) {
    throw new EmpiricalError(
      "INVALID_ARGUMENT",
      "Use either --evidence or the Fast --test/--review shortcuts, not both",
    );
  }
  const shortcutEvidence: Evidence[] = [
    ...(testSummary
      ? [{ criterionId: "AC-1", kind: "test" as const, passed: true, summary: testSummary }]
      : []),
    ...(reviewSummary
      ? [{ criterionId: "all", kind: "review" as const, passed: true, summary: reviewSummary }]
      : []),
  ];
  const evidence = evidencePath
    ? JSON.parse(await readFile(evidencePath, "utf8")) as Evidence[]
    : shortcutEvidence.length > 0
      ? shortcutEvidence
      : undefined;
  if (args.length > 0) {
    throw new EmpiricalError("INVALID_ARGUMENT", `Unknown completion arguments: ${args.join(" ")}`);
  }
  return {
    revision,
    outcome: outcome as CompletionInput["outcome"],
    summary,
    ...(actor ? { actor } : {}),
    ...(evidence ? { evidence } : {}),
  };
}

function readProfile(args: string[]): Workflow | undefined {
  const profile = takeOption(args, "--profile");
  if (!profile) return undefined;
  if (profile !== "fast" && profile !== "complex") {
    throw new EmpiricalError("INVALID_PROFILE", `Workflow must be fast or complex, not '${profile}'`);
  }
  return profile;
}

function requiredInteger(args: string[], name: string): number {
  const value = takeOption(args, name);
  if (!value || !/^\d+$/.test(value)) {
    throw new EmpiricalError("INVALID_ARGUMENT", `${name} requires a non-negative integer`);
  }
  return Number(value);
}

function takeOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new EmpiricalError("INVALID_ARGUMENT", `${name} requires a value`);
  }
  args.splice(index, 2);
  return value;
}

function takeFlag(args: string[], name: string): boolean {
  const index = args.indexOf(name);
  if (index < 0) return false;
  args.splice(index, 1);
  return true;
}

function emit(value: unknown, json: boolean, human: (value: unknown) => string): void {
  console.log(json ? JSON.stringify(value, null, 2) : human(value));
}

function renderAction(value: unknown): string {
  const action = value as Awaited<ReturnType<EmpiricalProject["next"]>>;
  const header = action.feature
    ? `${action.feature}: ${action.phase} (${action.profile}, ${action.status}, revision ${action.revision})`
    : `Empirical: ${action.phase}`;
  const sections = [header, action.instructions];
  if (action.acceptanceCriteria.length > 0) {
    sections.push(
      `Acceptance criteria:\n${action.acceptanceCriteria
        .map((criterion) => `- ${criterion.id}: ${criterion.text}`)
        .join("\n")}`,
    );
  }
  if (action.artifacts.length > 0) {
    sections.push(`Required artifacts:\n${action.artifacts.map((artifact) => `- ${artifact}`).join("\n")}`);
  }
  if (action.requiredEvidence.length > 0) {
    sections.push(`Required evidence: ${action.requiredEvidence.join(", ")}`);
  }
  if (action.completion.available) sections.push(`Complete with: ${action.completion.cli}`);
  return sections.join("\n\n");
}

function renderLoopAction(value: unknown): string {
  const action = value as Awaited<ReturnType<EmpiricalProject["loop"]>>;
  const rendered = renderAction(action);
  if (["idle", "done", "blocked", "awaiting_human"].includes(action.status)) return rendered;
  return `${rendered}\nThe calling agent executes this action, completes revision ${action.revision}, and continues from the returned packet.`;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function printHelp(): void {
  console.log(`Empirical v${PRODUCT_VERSION}

Install once: npm install -g empirical-sdd

Usage:
  empirical init
  empirical adopt
  empirical fast "<feature request>"
  empirical complex "<feature request>"
  empirical loop
  empirical next
  empirical complete --revision N --outcome passed --summary "..." [--evidence file.json]
  empirical status
  empirical verify
  empirical retry --revision N
  empirical integrate
  empirical doctor
  empirical migrate
  empirical mcp
  empirical update [--check]

Fast and Complex are the SDD workflows. Loop only resumes current state; it never
chooses a workflow, starts work, or launches an AI runtime.
`);
}

function printCompleteHelp(): void {
  console.log(`Complete the current action at its exact revision.

Fast:
  empirical complete --revision N --outcome passed --summary "<what changed>" \\
    --test "<focused check and result>" --review "<diff review>"

Complex evidence phases:
  empirical complete --revision N --outcome passed --summary "<what happened>" \\
    --evidence <evidence.json>

The Fast shortcuts create passing AC-1 test evidence and passing review evidence.
Use --input <file|-> for a complete programmatic result document.`);
}

main().catch((error: unknown) => {
  const payload = error instanceof EmpiricalError
    ? { error: error.code, message: error.message, details: error.details }
    : { error: "UNEXPECTED", message: asErrorMessage(error) };
  console.error(JSON.stringify(payload));
  process.exitCode = 1;
});
