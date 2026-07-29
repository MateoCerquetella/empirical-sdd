#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { EmpiricalProject } from "./core.js";
import {
  buildRefinedRequest,
  createDiscoveryRecord,
  materialFollowUp,
  recommendWorkflow,
  saveDiscovery,
  socraticQuestions,
  type DiscoveryRecord,
  type DiscoveryWorkflow,
  type SocraticAnswer,
} from "./discovery.js";
import { EmpiricalError, asErrorMessage } from "./errors.js";
import { installGlobalAgentSkills } from "./integrations.js";
import { updateEmpirical } from "./lifecycle.js";
import { runMcpServer } from "./mcp.js";
import { detectBase } from "./worktrees.js";
import {
  PRODUCT_VERSION,
  type ActionPacket,
  type AgentHandoffOffer,
  type AgentIntegrationId,
  type AuthorizedAgentHandoff,
  type CompletionInput,
  type Evidence,
  type ExplorationPacket,
  type FeatureStartResult,
  type IntegrationReport,
  type ProjectConfigurationInput,
  type WorktreeHandoff,
  type WorktreeProposal,
  type Workflow,
} from "./types.js";

interface CliContext {
  args: string[];
  root: string;
  json: boolean;
}

async function main(): Promise<void> {
  const context = parseGlobals(process.argv.slice(2));
  const command = context.args.shift();
  if (!command) return printHelp();
  if (["help", "--help", "-h"].includes(command)) return printHelp();
  if (["version", "--version", "-v"].includes(command)) return void console.log(PRODUCT_VERSION);
  if (command === "mcp") return runMcpServer(context.root);

  switch (command) {
    case "install": {
      const all = takeFlag(context.args, "--all");
      assertNoArgs(context.args, "install");
      const report = await installGlobalAgentSkills(homedir(), { all });
      emit(report, context.json, () => renderIntegrationReport(
        `Empirical installed one entrypoint per agent (${report.created.length} created, ${report.updated.length} updated, ${report.removed.length} obsolete removed, ${report.preserved.length} preserved).`,
        report,
      ));
      return;
    }
    case "init": {
      const profile = readProfile(context.args);
      const integrations = !takeFlag(context.args, "--no-integrations");
      const defaults = takeFlag(context.args, "--defaults");
      const forceInteractive = takeFlag(context.args, "--interactive");
      if (forceInteractive && (defaults || context.json)) {
        throw new EmpiricalError("INVALID_ARGUMENT", "--interactive cannot be combined with --defaults or --json");
      }
      const configuration = readConfigurationFlags(context.args);
      assertNoArgs(context.args, "init");
      const initialized = await EmpiricalProject.initialize(context.root, {
        ...(profile ? { profile } : {}),
        integrations,
        ...configuration.input,
        setupComplete: !forceInteractive && (
          defaults || configuration.explicit || context.json
          || !(process.stdin.isTTY && process.stdout.isTTY)
        ),
      });
      let config = await initialized.project.config();
      if (
        !config.setupComplete
        && !context.json
        && (forceInteractive || Boolean(process.stdin.isTTY && process.stdout.isTTY))
      ) {
        config = await initialized.project.configure(await interactiveConfiguration(initialized.project, config));
      }
      emit(
        { state: initialized.state, config, integrations: initialized.integrations, next: await initialized.project.next() },
        context.json,
        () => renderIntegrationReport(`Empirical ${PRODUCT_VERSION} is ready in ${initialized.project.store.root}.`, initialized.integrations)
          + `\n\nIsolation: ${config.isolation.mode}; base: ${config.isolation.baseBranch}; path: ${config.isolation.worktreePath}; branch: ${config.isolation.branchPattern}; Complex decisions: ${config.decisions.complexRecords}.`,
      );
      return;
    }
    case "config": {
      const defaults = takeFlag(context.args, "--defaults");
      const forceInteractive = takeFlag(context.args, "--interactive");
      if (forceInteractive && (defaults || context.json)) {
        throw new EmpiricalError("INVALID_ARGUMENT", "--interactive cannot be combined with --defaults or --json");
      }
      const configuration = readConfigurationFlags(context.args);
      assertNoArgs(context.args, "config");
      const project = await EmpiricalProject.open(context.root);
      const current = await project.config();
      const input = defaults
        ? defaultConfiguration()
        : configuration.explicit
          ? { ...configuration.input, setupComplete: true }
          : (forceInteractive || Boolean(process.stdin.isTTY && process.stdout.isTTY)) && !context.json
            ? await interactiveConfiguration(project, current)
            : (() => { throw new EmpiricalError("CONFIG_REQUIRED", "Use configuration flags, --defaults, or an interactive terminal"); })();
      const config = await project.configure(input);
      emit(config, context.json, renderConfig);
      return;
    }
    case "adopt": {
      const profile = readProfile(context.args);
      const integrations = !takeFlag(context.args, "--no-integrations");
      const defaults = takeFlag(context.args, "--defaults");
      const configuration = readConfigurationFlags(context.args);
      assertNoArgs(context.args, "adopt");
      const result = await EmpiricalProject.adopt(context.root, {
        ...(profile ? { profile } : {}),
        integrations,
        ...configuration.input,
        setupComplete: defaults || configuration.explicit,
      });
      emit(
        { state: result.state, integrations: result.integrations, next: await result.project.next() },
        context.json,
        () => renderIntegrationReport("Empirical v1 was adopted without deleting ai/. The source of truth is now .empirical/.", result.integrations),
      );
      return;
    }
    case "explore": {
      if (takeFlag(context.args, "--help") || takeFlag(context.args, "-h")) return printExploreHelp();
      const forceInteractive = takeFlag(context.args, "--interactive");
      const noInterview = takeFlag(context.args, "--no-interview");
      const agentOption = takeOption(context.args, "--agent");
      if (forceInteractive && (context.json || noInterview)) {
        throw new EmpiricalError("INVALID_ARGUMENT", "--interactive cannot be combined with --json or --no-interview");
      }
      if (agentOption && agentOption !== "codex" && agentOption !== "none") {
        throw new EmpiricalError("INVALID_ARGUMENT", "--agent must be codex or none");
      }
      if (agentOption && (context.json || noInterview)) {
        throw new EmpiricalError("INVALID_ARGUMENT", "--agent is available only with the Socratic interview");
      }
      const request = takeOption(context.args, "--request") ?? context.args.join(" ");
      const project = await EmpiricalProject.openReadOnly(context.root);
      const packet = await project.explore(request);
      const interactive = forceInteractive || Boolean(agentOption)
        || (!context.json && !noInterview && Boolean(process.stdin.isTTY && process.stdout.isTTY));
      if (interactive) return runSocraticInterview(project, packet, agentOption as "codex" | "none" | undefined);
      emit(packet, context.json, renderExplore);
      return;
    }
    case "fast":
    case "complex": {
      const id = takeOption(context.args, "--id");
      const request = takeOption(context.args, "--request") ?? context.args.join(" ");
      const project = await EmpiricalProject.open(context.root);
      const result = command === "fast"
        ? await project.fast(request, { ...(id ? { id } : {}) })
        : await project.complex(request, { ...(id ? { id } : {}) });
      await emitStart(project, result, context.json);
      return;
    }
    case "start": {
      const profile = readProfile(context.args);
      const id = takeOption(context.args, "--id");
      const request = takeOption(context.args, "--request") ?? context.args.join(" ");
      const project = await EmpiricalProject.open(context.root);
      await emitStart(project, await project.start(request, {
        ...(profile ? { profile } : {}),
        ...(id ? { id } : {}),
      }), context.json);
      return;
    }
    case "worktree": {
      const operation = context.args.shift();
      if (operation !== "create") {
        throw new EmpiricalError("INVALID_ARGUMENT", "Use empirical worktree create \"<request>\"");
      }
      const yes = takeFlag(context.args, "--yes");
      const workflow = (takeOption(context.args, "--workflow") ?? "complex") as Workflow;
      if (workflow !== "fast" && workflow !== "complex") throw new EmpiricalError("INVALID_PROFILE", "--workflow must be fast or complex");
      const changeType = takeOption(context.args, "--type") as "feature" | "fix" | "chore" | undefined;
      if (changeType && !["feature", "fix", "chore"].includes(changeType)) throw new EmpiricalError("INVALID_ARGUMENT", "--type must be feature, fix, or chore");
      const feature = takeOption(context.args, "--id");
      const branch = takeOption(context.args, "--branch");
      const path = takeOption(context.args, "--path");
      const base = takeOption(context.args, "--base");
      const request = takeOption(context.args, "--request") ?? context.args.join(" ");
      const project = await EmpiricalProject.openReadOnly(context.root);
      const proposal = await project.proposeWorktree(request, workflow, {
        ...(changeType ? { changeType } : {}),
        ...(feature ? { feature } : {}),
        ...(branch ? { branch } : {}),
        ...(path ? { path } : {}),
        ...(base ? { base } : {}),
      });
      if (!yes) {
        if (context.json || !(process.stdin.isTTY && process.stdout.isTTY)) {
          emit(proposal, context.json, renderProposal);
          if (!context.json) process.exitCode = 2;
          return;
        }
        if (!(await approveProposal(proposal))) {
          console.log("No worktree was created.");
          return;
        }
      }
      const handoff = await project.createWorktree({
        request: proposal.request,
        workflow: proposal.workflow,
        changeType: proposal.changeType,
        feature: proposal.feature,
        branch: proposal.branch,
        path: proposal.path,
        base: proposal.base,
        baseCommit: proposal.baseCommit,
        activeFeature: proposal.activeFeature,
        approvalToken: proposal.approvalToken,
        approved: true,
      });
      emit(handoff, context.json, renderHandoff);
      return;
    }
    case "loop": {
      assertNoArgs(context.args, "loop");
      const project = await EmpiricalProject.openReadOnly(context.root);
      emit(await project.loop(), context.json, renderLoopAction);
      return;
    }
    case "status": {
      assertNoArgs(context.args, "status");
      const project = await EmpiricalProject.openReadOnly(context.root);
      const state = await project.status();
      emit(state, context.json, () => `feature=${state.activeFeature ?? "none"} phase=${state.phase} status=${state.status} revision=${state.revision} profile=${state.profile}`);
      return;
    }
    case "next": {
      assertNoArgs(context.args, "next");
      const project = await EmpiricalProject.openReadOnly(context.root);
      emit(await project.next(), context.json, renderAction);
      return;
    }
    case "explain": {
      assertNoArgs(context.args, "explain");
      const project = await EmpiricalProject.openReadOnly(context.root);
      emit(await project.explain(), context.json, renderExplain);
      return;
    }
    case "complete": {
      if (takeFlag(context.args, "--help") || takeFlag(context.args, "-h")) return printCompleteHelp();
      const project = await EmpiricalProject.open(context.root);
      emit(await project.complete(await completionInput(context.args)), context.json, renderAction);
      return;
    }
    case "archive": {
      const revision = requiredInteger(context.args, "--revision");
      const actor = takeOption(context.args, "--actor") ?? "agent";
      assertNoArgs(context.args, "archive");
      const project = await EmpiricalProject.open(context.root);
      const result = await project.archive(revision, actor);
      emit(result, context.json, () => result.report.converged
        ? `${result.report.feature} was already archived.`
        : `Archived ${result.report.feature}: ${result.report.added} added, ${result.report.modified} modified, ${result.report.removed} removed.`);
      return;
    }
    case "verify": {
      assertNoArgs(context.args, "verify");
      const project = await EmpiricalProject.openReadOnly(context.root);
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
      assertNoArgs(context.args, "retry");
      const project = await EmpiricalProject.open(context.root);
      emit(await project.retry(revision, actor), context.json, renderAction);
      return;
    }
    case "integrate": {
      const global = takeFlag(context.args, "--global");
      const all = takeFlag(context.args, "--all");
      assertNoArgs(context.args, "integrate");
      if (global) {
        const report = await installGlobalAgentSkills(homedir(), { all });
        emit(report, context.json, () => renderIntegrationReport(
          `Empirical install compatibility alias completed (${report.created.length} created, ${report.updated.length} updated, ${report.removed.length} obsolete removed, ${report.preserved.length} preserved).`, report));
      } else {
        if (all) throw new EmpiricalError("INVALID_ARGUMENT", "--all requires --global");
        const project = await EmpiricalProject.open(context.root);
        const report = await project.integrations();
        emit(report, context.json, () => renderIntegrationReport(
          `Project runtime integration reconciled (${report.created.length} created, ${report.updated.length} updated, ${report.removed.length} obsolete removed, ${report.preserved.length} preserved).`, report));
      }
      return;
    }
    case "doctor": {
      assertNoArgs(context.args, "doctor");
      const project = await EmpiricalProject.openReadOnly(context.root);
      emit(await project.doctor(), context.json, () => "Empirical is healthy: CLI, MCP, Git isolation, and feature-local state are available.");
      return;
    }
    case "migrate": {
      assertNoArgs(context.args, "migrate");
      const project = await EmpiricalProject.open(context.root, { migrate: false });
      const migration = await project.migrate();
      emit(migration, context.json, () => `Project schema is current (${String(migration.schemaVersion)}).`);
      return;
    }
    case "capabilities": {
      const project = await EmpiricalProject.openReadOnly(context.root);
      const name = context.args.shift();
      assertNoArgs(context.args, "capabilities");
      if (name) {
        const contents = await project.capability(name);
        if (contents === null) throw new EmpiricalError("CAPABILITY_NOT_FOUND", `Unknown capability '${name}'`);
        emit({ name, contents }, context.json, () => contents);
      } else {
        const capabilities = await project.capabilities();
        emit(capabilities, context.json, () => capabilities.length === 0
          ? "No living capability specifications yet."
          : capabilities.map((item) => `${item.name}: ${item.requirements} requirements (${item.path})`).join("\n"));
      }
      return;
    }
    case "policy": {
      assertNoArgs(context.args, "policy");
      const project = await EmpiricalProject.openReadOnly(context.root);
      const policy = await project.policy();
      emit(policy, context.json, () => `Project policy: ${policy.context.length} context entries, ${Object.keys(policy.phases).length} customized phases (${project.store.policyPath}).`);
      return;
    }
    case "context": {
      assertNoArgs(context.args, "context");
      const project = await EmpiricalProject.open(context.root);
      const report = await project.context();
      emit(report, context.json, () => `Repository knowledge ${report.status}: ${report.files} files, digest ${report.digest}.\n${report.context.join("\n")}`);
      return;
    }
    case "handoff": {
      const agent = takeOption(context.args, "--agent") as AgentIntegrationId | undefined;
      const approvalToken = takeOption(context.args, "--approval-token");
      const approved = takeFlag(context.args, "--yes");
      assertNoArgs(context.args, "handoff");
      const project = await EmpiricalProject.openReadOnly(context.root);
      if (!agent) {
        if (approvalToken || approved) throw new EmpiricalError("INVALID_ARGUMENT", "--approval-token and --yes require --agent");
        return emit(await project.handoff(), context.json, renderAgentHandoffOffer);
      }
      if (!["codex", "claude", "cursor", "gemini", "windsurf"].includes(agent)) {
        throw new EmpiricalError("INVALID_ARGUMENT", `Unsupported agent '${agent}'`);
      }
      if (!approvalToken) throw new EmpiricalError("INVALID_ARGUMENT", "--agent requires --approval-token from the displayed proposal");
      emit(await project.authorizeHandoff(agent, approvalToken, approved), context.json, renderAuthorizedHandoff);
      return;
    }
    case "update": {
      if (takeFlag(context.args, "--check")) {
        assertNoArgs(context.args, "update");
        console.log(`Installed ${PRODUCT_VERSION}. Check npm with: npm view empirical-sdd version`);
        return;
      }
      assertNoArgs(context.args, "update");
      const report = updateEmpirical();
      emit(report, context.json, () => "Empirical package updated and the one managed agent entrypoint was refreshed.");
      return;
    }
    default:
      throw new EmpiricalError("UNKNOWN_COMMAND", `Unknown command '${command}'. Run empirical help.`);
  }
}

class InterviewQuit extends Error {}

class LinePrompter {
  private readonly readline = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    crlfDelay: Infinity,
  });
  private readonly lines = this.readline[Symbol.asyncIterator]();

  async ask(prompt: string): Promise<string> {
    process.stdout.write(prompt);
    const next = await this.lines.next();
    if (next.done) throw new InterviewQuit("Input closed");
    return next.value.trim();
  }

  close(): void { this.readline.close(); }
}

async function interactiveConfiguration(
  project: EmpiricalProject,
  current: Awaited<ReturnType<EmpiricalProject["config"]>>,
): Promise<ProjectConfigurationInput> {
  const prompt = new LinePrompter();
  let detected = current.isolation.baseBranch;
  if (detected === "auto") {
    try { detected = detectBase(project.store.root); } catch { detected = "auto"; }
  }
  console.log("\nEmpirical first-run setup · press Enter to keep each shown value.");
  try {
    const mode = await askDefault(prompt, `Isolation when another feature is active [${current.isolation.mode}] (ask/off): `, current.isolation.mode);
    if (mode !== "ask" && mode !== "off") throw new EmpiricalError("INVALID_CONFIG", "Isolation must be ask or off");
    const baseBranch = await askDefault(prompt, `Default Git base [${detected}]: `, detected);
    const worktreePath = await askDefault(prompt, `Sibling worktree path [${current.isolation.worktreePath}]: `, current.isolation.worktreePath);
    const branchPattern = await askDefault(prompt, `Branch pattern [${current.isolation.branchPattern}]: `, current.isolation.branchPattern);
    const complexRecords = await askDefault(prompt, `Complex decision records [${current.decisions.complexRecords}] (required/off): `, current.decisions.complexRecords);
    if (complexRecords !== "required" && complexRecords !== "off") throw new EmpiricalError("INVALID_CONFIG", "Complex decisions must be required or off");
    return {
      isolation: { mode, baseBranch, worktreePath, branchPattern },
      decisions: { complexRecords },
      setupComplete: true,
    };
  } finally {
    prompt.close();
  }
}

async function runSocraticInterview(
  project: EmpiricalProject,
  packet: ExplorationPacket,
  agentOption?: "codex" | "none",
): Promise<void> {
  const prompt = new LinePrompter();
  let record = createDiscoveryRecord(packet.problem);
  let paths = await saveDiscovery(project.store.root, record);
  let launchCodex = false;
  console.log("Empirical Socratic Explore · five passes");
  console.log(`\nIdea: ${packet.problem}`);
  console.log("\nI will ask one question at a time, save every answer, show the refined brief, and wait for approval before starting work.");
  console.log("Do not enter secrets or credentials. Type :quit to save the draft and stop.\n");
  try {
    interview: while (true) {
      const answers: SocraticAnswer[] = [];
      for (let index = 0; index < 5; index += 1) {
        const prior = answers.map((answer) => `${answer.answer} ${answer.followUp?.answer ?? ""}`).join(" ");
        const question = socraticQuestions(packet.problem, prior)[index]!;
        console.log(`Pass ${index + 1}/5 · ${question.title}`);
        const answer = await askRequired(prompt, `${question.question}\n> `);
        const entry: SocraticAnswer = { ...question, answer, followUp: null };
        answers.push(entry);
        record = touchDiscovery(record, { answers: [...answers] });
        paths = await saveDiscovery(project.store.root, record);
        const followUp = materialFollowUp(packet.problem, question, answer);
        if (followUp) {
          console.log("\nOne material follow-up:");
          entry.followUp = { question: followUp, answer: await askRequired(prompt, `${followUp}\n> `) };
          record = touchDiscovery(record, { answers: [...answers] });
          paths = await saveDiscovery(project.store.root, record);
        }
        console.log("");
      }
      const refinedRequest = buildRefinedRequest(packet.problem, answers);
      record = touchDiscovery(record, { answers, refinedRequest });
      paths = await saveDiscovery(project.store.root, record);
      console.log(`Refined request\n---------------\n${refinedRequest}\n\nDraft saved: ${paths.markdown}`);
      const approval = await askChoice(prompt, "\n[A] Approve  [R] Restart  [S] Save only\nChoose (default S): ", new Set(["a", "approve", "y", "yes", "r", "restart", "s", "save", ""]));
      if (approval === "r" || approval === "restart") {
        record = touchDiscovery(record, { status: "draft", answers: [], refinedRequest: null, approvedAt: null, workflow: null, handoff: null });
        paths = await saveDiscovery(project.store.root, record);
        continue interview;
      }
      if (!["a", "approve", "y", "yes"].includes(approval)) {
        console.log(`\nNo workflow was started. Draft saved at ${paths.markdown}.`);
        return;
      }
      record = touchDiscovery(record, { status: "approved", approvedAt: new Date().toISOString() });
      paths = await saveDiscovery(project.store.root, record);
      const recommended = recommendWorkflow(packet.problem, answers);
      const choice = await askChoice(prompt, `[C] Complex  [F] Fast  [S] Save approved only\nChoose (recommended ${recommended}): `, new Set(["c", "complex", "f", "fast", "s", "save", ""]));
      if (choice === "s" || choice === "save") return void console.log("\nThe approved brief was saved without starting workflow state.");
      let workflow: DiscoveryWorkflow = choice === "f" || choice === "fast" ? "fast" : choice === "c" || choice === "complex" ? "complex" : recommended;
      if (workflow === "fast" && recommended === "complex" && await prompt.ask("Type FAST to override the Complex recommendation: ") !== "FAST") workflow = "complex";
      let result = workflow === "fast" ? await project.fast(refinedRequest) : await project.complex(refinedRequest);
      let action: ActionPacket;
      if (result.kind === "worktree_proposal") {
        console.log(`\n${renderProposal(result)}`);
        const approve = await prompt.ask("Create this worktree now? [y/N]: ");
        if (!/^(y|yes)$/i.test(approve)) return void console.log("\nApproved discovery saved; no worktree or workflow was created.");
        const handoff = await createFromProposal(project, result);
        console.log(`\n${renderHandoff(handoff)}`);
        action = handoff.action;
      } else action = result;
      record = touchDiscovery(record, { status: "started", workflow, handoff: { feature: action.feature ?? "unknown", revision: action.revision } });
      paths = await saveDiscovery(project.store.root, record);
      console.log(`\n${renderAction(action)}\n\nDiscovery handoff recorded: ${paths.markdown}`);
      if (agentOption === "codex") launchCodex = true;
      else if (agentOption !== "none") launchCodex = /^(y|yes)$/i.test(await prompt.ask("\nLaunch Codex now? [y/N]: "));
      break interview;
    }
  } catch (error) {
    if (error instanceof InterviewQuit) return void console.log(`\nInterview stopped safely. Draft saved at ${paths.markdown}.`);
    throw error;
  } finally { prompt.close(); }
  if (launchCodex && record.handoff) launchCodexRuntime(project.store.root, record);
}

async function emitStart(project: EmpiricalProject, result: FeatureStartResult, json: boolean): Promise<void> {
  if (result.kind === "action") return emit(result, json, renderAction);
  if (json || !(process.stdin.isTTY && process.stdout.isTTY)) return emit(result, json, renderProposal);
  console.log(renderProposal(result));
  if (!(await approveProposal(result))) return void console.log("No worktree was created; the active feature is unchanged.");
  const handoff = await createFromProposal(project, result);
  emit(handoff, false, renderHandoff);
}

async function createFromProposal(project: EmpiricalProject, proposal: WorktreeProposal): Promise<WorktreeHandoff> {
  return project.createWorktree({
    request: proposal.request,
    workflow: proposal.workflow,
    changeType: proposal.changeType,
    feature: proposal.feature,
    branch: proposal.branch,
    path: proposal.path,
    base: proposal.base,
    baseCommit: proposal.baseCommit,
    activeFeature: proposal.activeFeature,
    approvalToken: proposal.approvalToken,
    approved: true,
  });
}

async function approveProposal(proposal: WorktreeProposal): Promise<boolean> {
  const prompt = new LinePrompter();
  try { return /^(y|yes)$/i.test(await prompt.ask("Create this worktree and start the feature? [y/N]: ")); }
  finally { prompt.close(); }
}

function renderProposal(value: unknown): string {
  const proposal = value as WorktreeProposal;
  return [
    "Empirical needs an isolated Git worktree (approval required)",
    `Active feature: ${proposal.activeFeature}`,
    `New request: ${proposal.request}`,
    `Workflow/type: ${proposal.workflow}/${proposal.changeType}`,
    `Base: ${proposal.base}`,
    `Base commit: ${proposal.baseCommit}`,
    `Branch: ${proposal.branch}`,
    `Path: ${proposal.path}`,
    `Command: ${proposal.command.map(shellDisplay).join(" ")}`,
    "No mutation has occurred. The checkout must be clean before approval can execute.",
  ].join("\n");
}

function renderHandoff(value: unknown): string {
  const handoff = value as WorktreeHandoff;
  return `Worktree created and Empirical started ${handoff.feature}.\nPath: ${handoff.path}\nBranch: ${handoff.branch}\nBase: ${handoff.base}\nRevision: ${handoff.revision}\nResume: ${handoff.resume}\n\n${renderAction(handoff.action)}`;
}

function renderExplain(value: unknown): string {
  const report = value as Awaited<ReturnType<EmpiricalProject["explain"]>>;
  const rationale = report.rationale;
  return [
    `Empirical Explain · ${report.feature ?? "no active feature"}`,
    `State: ${rationale.currentState}`,
    `Next: ${rationale.nextAction}`,
    `Why: ${rationale.reason}`,
    `Gate: ${rationale.gate}`,
    `Required context: ${rationale.requiredContext.length ? rationale.requiredContext.join(", ") : "none"}`,
    `Missing context: ${rationale.missingContext.length ? rationale.missingContext.join(", ") : "none"}`,
    report.decisions.length
      ? `Accepted decisions:\n${report.decisions.map((decision) => `- ${decision.id} ${decision.title}: ${decision.chosenApproach}`).join("\n")}`
      : "Accepted decisions: none",
  ].join("\n");
}

function renderExplore(value: unknown): string {
  const packet = value as ExplorationPacket;
  return [
    "Empirical Explore · packet mode (read-only)",
    `Problem: ${packet.problem}`,
    ...packet.instructions.map((item) => `- ${item}`),
    `Questions:\n${packet.questions.map((item) => `- ${item}`).join("\n")}`,
    ...(packet.projectContext.length ? [`Project context:\n${packet.projectContext.map((item) => `- ${item}`).join("\n")}`] : []),
    ...(packet.knowledgeContext.length ? [`Repository knowledge:\n${packet.knowledgeContext.map((item) => `- ${item}`).join("\n")}`] : []),
    ...(packet.capabilityContext.length ? [`Living capability context:\n${packet.capabilityContext.map((item) => `- ${item}`).join("\n")}`] : []),
    `Start when clear:\n- Fast: ${packet.next.fast}\n- Complex: ${packet.next.complex}`,
    "For the five-pass Socratic interview, use an interactive terminal or add --interactive.",
  ].join("\n\n");
}

async function askRequired(prompt: LinePrompter, question: string): Promise<string> {
  while (true) {
    const answer = await prompt.ask(question);
    if (answer === ":quit") throw new InterviewQuit("User quit");
    if (answer) return answer;
    console.log("Please answer, or type :quit to save and stop.");
  }
}

async function askDefault(prompt: LinePrompter, question: string, fallback: string): Promise<string> {
  const answer = await prompt.ask(question);
  return answer || fallback;
}

async function askChoice(prompt: LinePrompter, question: string, allowed: Set<string>): Promise<string> {
  while (true) {
    const answer = (await prompt.ask(question)).toLowerCase();
    if (answer === ":quit") throw new InterviewQuit("User quit");
    if (allowed.has(answer)) return answer;
    console.log("Choose one of the displayed options.");
  }
}

function touchDiscovery(record: DiscoveryRecord, update: Partial<Omit<DiscoveryRecord, "schemaVersion" | "id" | "problem" | "createdAt">>): DiscoveryRecord {
  return { ...record, ...update, updatedAt: new Date().toISOString() };
}

function launchCodexRuntime(root: string, record: DiscoveryRecord): void {
  const handoff = record.handoff!;
  const request = [
    `Resume the active Empirical workflow for feature ${handoff.feature}.`,
    "Run empirical loop once, execute the exact action, complete every revision with required evidence, and continue until Done, Blocked, or genuinely awaiting human input.",
    `Use .empirical/discoveries/${record.id}/brief.md as the approved product contract.`,
  ].join(" ");
  console.log("\nLaunching Codex with the approved workflow handoff...");
  const result = spawnSync("codex", [request], { cwd: root, stdio: "inherit" });
  if (result.error) console.warn(`Codex could not be launched (${result.error.message}). The workflow remains active.`);
  else if (result.status !== 0) console.warn(`Codex exited with status ${String(result.status)}. The workflow remains resumable.`);
}

function parseGlobals(argv: string[]): CliContext {
  const args = [...argv];
  const root = takeOption(args, "--root") ?? process.cwd();
  const json = takeFlag(args, "--json");
  return { args, root, json };
}

function readConfigurationFlags(args: string[]): { input: ProjectConfigurationInput; explicit: boolean } {
  const mode = takeOption(args, "--isolation");
  if (mode && mode !== "ask" && mode !== "off") throw new EmpiricalError("INVALID_CONFIG", "--isolation must be ask or off");
  const baseBranch = takeOption(args, "--base");
  const worktreePath = takeOption(args, "--worktree-path");
  const branchPattern = takeOption(args, "--branch-pattern");
  const complexRecords = takeOption(args, "--decisions");
  if (complexRecords && complexRecords !== "required" && complexRecords !== "off") throw new EmpiricalError("INVALID_CONFIG", "--decisions must be required or off");
  const explicit = Boolean(mode || baseBranch || worktreePath || branchPattern || complexRecords);
  return {
    explicit,
    input: {
      ...(mode || baseBranch || worktreePath || branchPattern ? { isolation: {
        ...(mode ? { mode: mode as "ask" | "off" } : {}),
        ...(baseBranch ? { baseBranch } : {}),
        ...(worktreePath ? { worktreePath } : {}),
        ...(branchPattern ? { branchPattern } : {}),
      } } : {}),
      ...(complexRecords ? { decisions: { complexRecords: complexRecords as "required" | "off" } } : {}),
    },
  };
}

function defaultConfiguration(): ProjectConfigurationInput {
  return {
    isolation: { mode: "ask", baseBranch: "auto", worktreePath: "../{repo}-{feature}", branchPattern: "{type}/{feature}" },
    decisions: { complexRecords: "required" },
    setupComplete: true,
  };
}

async function completionInput(args: string[]): Promise<CompletionInput> {
  const inputPath = takeOption(args, "--input");
  if (inputPath) {
    assertNoArgs(args, "complete --input");
    const text = inputPath === "-" ? await readStdin() : await readFile(inputPath, "utf8");
    return JSON.parse(text) as CompletionInput;
  }
  const revision = requiredInteger(args, "--revision");
  const outcome = takeOption(args, "--outcome") ?? "passed";
  if (!["passed", "failed", "awaiting_human", "blocked"].includes(outcome)) throw new EmpiricalError("INVALID_OUTCOME", `Invalid outcome '${outcome}'`);
  const summary = takeOption(args, "--summary");
  if (!summary) throw new EmpiricalError("SUMMARY_REQUIRED", "Use --summary \"<what happened>\"");
  const actor = takeOption(args, "--actor");
  const evidencePath = takeOption(args, "--evidence");
  const testSummary = takeOption(args, "--test");
  const reviewSummary = takeOption(args, "--review");
  if (evidencePath && (testSummary || reviewSummary)) throw new EmpiricalError("INVALID_ARGUMENT", "Use either --evidence or --test/--review shortcuts");
  const shortcut: Evidence[] = [
    ...(testSummary ? [{ criterionId: "AC-1", kind: "test" as const, passed: true, summary: testSummary }] : []),
    ...(reviewSummary ? [{ criterionId: "all", kind: "review" as const, passed: true, summary: reviewSummary }] : []),
  ];
  const evidence = evidencePath ? JSON.parse(await readFile(evidencePath, "utf8")) as Evidence[] : shortcut.length ? shortcut : undefined;
  assertNoArgs(args, "complete");
  return { revision, outcome: outcome as CompletionInput["outcome"], summary, ...(actor ? { actor } : {}), ...(evidence ? { evidence } : {}) };
}

function readProfile(args: string[]): Workflow | undefined {
  const profile = takeOption(args, "--profile");
  if (!profile) return undefined;
  if (profile !== "fast" && profile !== "complex") throw new EmpiricalError("INVALID_PROFILE", `Workflow must be fast or complex, not '${profile}'`);
  return profile;
}

function requiredInteger(args: string[], name: string): number {
  const value = takeOption(args, name);
  if (!value || !/^\d+$/.test(value)) throw new EmpiricalError("INVALID_ARGUMENT", `${name} requires a non-negative integer`);
  return Number(value);
}

function takeOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new EmpiricalError("INVALID_ARGUMENT", `${name} requires a value`);
  args.splice(index, 2);
  return value;
}

function takeFlag(args: string[], name: string): boolean {
  const index = args.indexOf(name);
  if (index < 0) return false;
  args.splice(index, 1);
  return true;
}

function assertNoArgs(args: string[], command: string): void {
  if (args.length) throw new EmpiricalError("INVALID_ARGUMENT", `Unknown ${command} arguments: ${args.join(" ")}`);
}

function emit(value: unknown, json: boolean, human: (value: unknown) => string): void {
  console.log(json ? JSON.stringify(value, null, 2) : human(value));
}

function renderIntegrationReport(summary: string, report: IntegrationReport): string {
  if (!report.entrypoints.length) {
    return report.scope === "global"
      ? `${summary}\n\nNo supported agents were detected. Install an agent or run empirical install --all.`
      : `${summary}\n\nNo project-local workflow skills are installed; the global Empirical entrypoint owns the UX.`;
  }
  const lines = [summary, "", "Installed Empirical entrypoints:"];
  for (const entry of report.entrypoints) {
    lines.push(`- ${entry.agent} (${entry.artifactRoot}): ${entry.invocations.join(", ")}`, `  Reload: ${entry.reload}`);
  }
  return lines.join("\n");
}

function renderConfig(value: unknown): string {
  const config = value as Awaited<ReturnType<EmpiricalProject["config"]>>;
  return `Empirical configuration saved.\nIsolation: ${config.isolation.mode}\nBase: ${config.isolation.baseBranch}\nWorktree path: ${config.isolation.worktreePath}\nBranch pattern: ${config.isolation.branchPattern}\nComplex decisions: ${config.decisions.complexRecords}`;
}

function renderAgentHandoffOffer(value: unknown): string {
  const offer = value as AgentHandoffOffer;
  const agents = offer.agents.length
    ? offer.agents.map((agent) => [
      `- ${agent.agent} (${agent.capability})`,
      `  Command: ${agent.argv.map(shellDisplay).join(" ")}`,
      `  Approval token: ${agent.approvalToken}`,
    ].join("\n")).join("\n")
    : "- No prompt-capable or workspace agent executable was detected.";
  return [
    `Empirical handoff · ${offer.feature}`,
    `Specification: ${offer.specification}`,
    "Choices: Continue here | Save for later | Continue in a detected agent",
    agents,
    "No process has been started. Display and explicitly approve one exact option before authorization.",
  ].join("\n\n");
}

function renderAuthorizedHandoff(value: unknown): string {
  const handoff = value as AuthorizedAgentHandoff;
  return `Authorized ${handoff.agent} handoff for ${handoff.feature}.\nCwd: ${handoff.cwd}\nCommand: ${handoff.argv.map(shellDisplay).join(" ")}\nThe current host may now execute only this exact command.`;
}

function renderAction(value: unknown): string {
  const action = value as ActionPacket;
  const header = action.feature ? `${action.feature}: ${action.phase} (${action.profile}, ${action.status}, revision ${action.revision})` : `Empirical: ${action.phase}`;
  const progress = phaseProgress(action.profile, action.phase);
  const sections = [`Empirical${progress ? ` · ${progress}` : ""}`, header, action.instructions];
  if (action.projectContext.length) sections.push(`Project context:\n${action.projectContext.map((item) => `- ${item}`).join("\n")}`);
  if (action.knowledgeContext.length) sections.push(`Repository knowledge:\n${action.knowledgeContext.map((item) => `- ${item}`).join("\n")}`);
  if (action.capabilityContext.length) sections.push(`Living capability context:\n${action.capabilityContext.map((item) => `- ${item}`).join("\n")}`);
  if (action.acceptanceCriteria.length) sections.push(`Acceptance criteria:\n${action.acceptanceCriteria.map((criterion) => `- ${criterion.id}: ${criterion.text}`).join("\n")}`);
  if (action.artifacts.length) sections.push(`Required artifacts:\n${action.artifacts.map((artifact) => `- ${artifact}`).join("\n")}`);
  if (action.requiredEvidence.length) sections.push(`Required evidence: ${action.requiredEvidence.join(", ")}`);
  if (action.completion.available) sections.push(`Complete with: ${action.completion.cli}`);
  return sections.join("\n\n");
}

function phaseProgress(profile: ActionPacket["profile"], phase: ActionPacket["phase"]): string | null {
  if (phase === "idle" || phase === "done") return null;
  const phases = profile === "fast" ? ["implement"] : profile === "quick" ? ["shape", "implement", "verify", "review"] : ["specify", "design", "plan", "implement", "verify", "review", "archive"];
  const index = phases.indexOf(phase);
  return index < 0 ? null : `step ${index + 1}/${phases.length}`;
}

function renderLoopAction(value: unknown): string {
  const action = value as ActionPacket;
  const rendered = renderAction(action);
  return ["idle", "done", "blocked", "awaiting_human"].includes(action.status)
    ? rendered
    : `${rendered}\nThe calling agent executes this action, completes revision ${action.revision}, and continues from the returned packet.`;
}

function shellDisplay(value: string): string {
  return /^[A-Za-z0-9_./:@+-]+$/.test(value) ? value : JSON.stringify(value);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function printHelp(): void {
  console.log(`Empirical v${PRODUCT_VERSION}

Install once: npm install -g empirical-sdd

Lifecycle:
  empirical install [--all]   Install one Empirical entrypoint in detected agents
  empirical update            Update the package and refresh installed entrypoints

Repository work happens inside your coding agent through its one Empirical
entrypoint. It initializes the repository, builds compact context, clarifies
vague work, chooses the internal workflow, resumes work, and offers explicit
agent handoff when a specification is ready.

Low-level CLI and MCP operations remain available for agent automation and
existing scripts, but users do not need to select Explore, Fast, Complex, or Loop.`);
}

function printExploreHelp(): void {
  console.log(`Conduct the original five-pass Socratic discovery before state is created.

  empirical explore "<vague problem>"
  empirical explore "<vague problem>" --agent codex
  empirical explore "<vague problem>" --json

The interview asks problem/user, observable outcome, boundaries/non-goals,
failure/risk, and verification one question at a time, saves answers, presents
the refined contract, and waits for approval before Fast or Complex.`);
}

function printCompleteHelp(): void {
  console.log(`Complete the current exact revision.

Fast:
  empirical complete --revision N --outcome passed --summary "<change>" --test "<result>" --review "<diff review>"

Complex evidence phases:
  empirical complete --revision N --outcome passed --summary "<result>" --evidence <evidence.json>

Use --input <file|-> for a complete structured result document.`);
}

main().catch((error: unknown) => {
  const payload = error instanceof EmpiricalError
    ? { error: error.code, message: error.message, details: error.details }
    : { error: "UNEXPECTED", message: asErrorMessage(error) };
  console.error(JSON.stringify(payload));
  process.exitCode = 1;
});
