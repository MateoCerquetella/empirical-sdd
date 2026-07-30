import { mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { EmpiricalError } from "./errors.js";
import { isFile, isSymbolicLink, readJson, writeJsonAtomic, writeTextAtomic } from "./storage.js";
import type { FeatureStartResult } from "./types.js";

export const DISCOVERY_SCHEMA_VERSION = 1 as const;

export type DiscoveryPassId = "problem" | "outcome" | "boundaries" | "risks" | "verification";
export type DiscoveryStatus = "draft" | "approved" | "started";
export type DiscoveryWorkflow = "fast" | "complex";

export const DISCOVERY_PASS_ORDER: readonly DiscoveryPassId[] = [
  "problem",
  "outcome",
  "boundaries",
  "risks",
  "verification",
] as const;

export interface SocraticQuestion {
  pass: DiscoveryPassId;
  title: string;
  question: string;
}

export interface SocraticPrompt extends SocraticQuestion {
  kind: "pass" | "follow_up";
}

export interface SocraticAnswer {
  pass: DiscoveryPassId;
  title: string;
  question: string;
  answer: string;
  followUp: { question: string; answer: string } | null;
}

export interface DiscoveryRecord {
  schemaVersion: typeof DISCOVERY_SCHEMA_VERSION;
  id: string;
  problem: string;
  status: DiscoveryStatus;
  answers: SocraticAnswer[];
  refinedRequest: string | null;
  approvedAt: string | null;
  workflow: DiscoveryWorkflow | null;
  handoff: {
    feature: string;
    revision: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveryPaths {
  directory: string;
  json: string;
  markdown: string;
}

export interface DiscoverySubmission {
  id?: string;
  problem: string;
  answers: SocraticAnswer[];
  approved?: true;
}

export interface DiscoverySubmissionResult {
  record: DiscoveryRecord;
  paths: DiscoveryPaths;
  refinedRequest: string | null;
  nextQuestion: SocraticPrompt | null;
  start: FeatureStartResult | null;
}

interface DiscoveryDomains {
  game: boolean;
  ui: boolean;
  api: boolean;
  data: boolean;
  security: boolean;
}

export function createDiscoveryRecord(problem: string, now = new Date()): DiscoveryRecord {
  const cleanProblem = problem.trim();
  if (!cleanProblem) throw new EmpiricalError("REQUEST_REQUIRED", "A non-empty problem is required");
  const timestamp = now.toISOString().replace(/[-:.]/g, "");
  const slug = slugify(cleanProblem);
  return {
    schemaVersion: DISCOVERY_SCHEMA_VERSION,
    id: `${timestamp}-${slug}`,
    problem: cleanProblem,
    status: "draft",
    answers: [],
    refinedRequest: null,
    approvedAt: null,
    workflow: null,
    handoff: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function socraticQuestions(problem: string, priorContext = ""): SocraticQuestion[] {
  const domains = classifyDomains(`${problem} ${priorContext}`);
  const outcomeHint = domains.game
    ? "Describe the smallest playable loop: player input, recorded or cooperative behavior, reset condition, and exact win or failure condition."
    : domains.ui
      ? "Describe the smallest end-to-end interaction and the exact visible result."
      : domains.api
        ? "Describe the smallest consumer-visible request, response, and failure behavior."
        : "Describe the smallest end-to-end behavior a user must be able to observe when this succeeds.";
  const boundaryHint = domains.game
    ? "What must the first playable version include—levels, controls, target devices, art/audio, persistence, or networking—and what is explicitly out of scope?"
    : domains.data
      ? "What data, compatibility, migration, rollback, and preservation boundaries apply, and what is explicitly out of scope?"
      : domains.security
        ? "Which actors, permissions, trust boundaries, and explicit non-goals constrain the first version?"
        : domains.ui
          ? "Which screens, states, target devices, accessibility constraints, and explicit non-goals define the first version?"
          : "What must the first version include, what is explicitly out of scope, and which constraints cannot change?";
  const riskHint = domains.game
    ? "Which failures would break the experience—input replay drift, timing, impossible levels, lost progress, or performance—and how should they behave?"
    : domains.security
      ? "Which abuse cases, permission failures, privacy risks, and recovery paths could change the solution?"
      : domains.data
        ? "Which partial failures, invalid data, compatibility breaks, or rollback risks could change the solution?"
        : "Which failure cases, dependencies, or risks could change the implementation approach, and what should the user observe when they occur?";
  const verificationHint = domains.game || domains.ui
    ? "How will we prove each behavior in a real browser, including interaction checks and screenshot evidence for visible states?"
    : domains.api
      ? "Which automated contract tests prove success, validation, compatibility, and failure responses?"
      : "Which concrete tests or observable checks will prove the outcome and the important failure behavior?";
  return [
    {
      pass: "problem",
      title: "Problem and user",
      question: `Who is this for, what problem do they experience today, and why does solving “${problem.trim()}” matter?`,
    },
    { pass: "outcome", title: "Observable outcome", question: outcomeHint },
    { pass: "boundaries", title: "Boundaries", question: boundaryHint },
    { pass: "risks", title: "Failure and risk", question: riskHint },
    { pass: "verification", title: "Verification", question: verificationHint },
  ];
}

export function materialFollowUp(
  problem: string,
  question: SocraticQuestion,
  answer: string,
): string | null {
  const clean = answer.trim();
  const domains = classifyDomains(`${problem} ${answer}`);
  if (isVague(clean)) {
    return `Make the ${question.title.toLowerCase()} decision concrete: what exact behavior or boundary should the specification use?`;
  }
  if (question.pass === "problem" && !/(user|player|developer|customer|team|admin|operator|visitor|person|people|author|recipient|reader|viewer|owner)/i.test(clean)) {
    return "Name the primary user or actor and the current pain they experience.";
  }
  if (question.pass === "outcome" && domains.game && !/(win|goal|exit|complete|success|lose|loss|fail|failure)/i.test(clean)) {
    return "What exact condition wins or completes the game, and what ends a loop without success?";
  }
  if (question.pass === "boundaries" && !/(out of scope|non-goal|exclude|without|no\s|not include|only|won't|will not)/i.test(clean)) {
    return "Name at least one explicit non-goal so the first version has a hard boundary.";
  }
  if (question.pass === "risks" && !/(fail|error|risk|invalid|timeout|offline|lost|drift|recover|fallback|deny|impossible)/i.test(clean)) {
    return "Name the most important failure case and the behavior the user should observe when it happens.";
  }
  if (
    question.pass === "verification"
    && (domains.game || domains.ui)
    && !/(browser|playwright|screenshot|visual|interaction|end-to-end|e2e)/i.test(clean)
  ) {
    return "Which real-browser interaction and screenshot will prove the visible experience works?";
  }
  if (
    question.pass === "verification"
    && !(domains.game || domains.ui)
    && !/(test|assert|check|verify|spec|integration|unit|contract)/i.test(clean)
  ) {
    return "Name the exact automated check or assertion that will prove the outcome.";
  }
  return null;
}

export function buildRefinedRequest(problem: string, answers: SocraticAnswer[]): string {
  const answerFor = (pass: DiscoveryPassId) => {
    const entry = answers.find((answer) => answer.pass === pass);
    if (!entry) return "Not yet answered.";
    return entry.followUp
      ? `${entry.answer} Follow-up decision: ${entry.followUp.answer}`
      : entry.answer;
  };
  return `${problem.trim()}

Approved Socratic discovery:
- Primary user and problem: ${answerFor("problem")}
- Smallest observable outcome: ${answerFor("outcome")}
- Scope, non-goals, and constraints: ${answerFor("boundaries")}
- Failure cases and risks: ${answerFor("risks")}
- Required verification: ${answerFor("verification")}`;
}

export function validateSocraticAnswers(
  answers: SocraticAnswer[],
  options: { complete?: boolean } = {},
): SocraticAnswer[] {
  if (!Array.isArray(answers) || answers.length > DISCOVERY_PASS_ORDER.length) {
    throw new EmpiricalError(
      "INVALID_DISCOVERY",
      `Discovery requires at most ${String(DISCOVERY_PASS_ORDER.length)} ordered answers`,
    );
  }
  if (options.complete && answers.length !== DISCOVERY_PASS_ORDER.length) {
    throw new EmpiricalError(
      "INVALID_DISCOVERY",
      `Approved discovery requires exactly ${String(DISCOVERY_PASS_ORDER.length)} answers`,
    );
  }
  return answers.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new EmpiricalError("INVALID_DISCOVERY", `Discovery answer ${String(index + 1)} is invalid`);
    }
    const expected = DISCOVERY_PASS_ORDER[index];
    if (entry.pass !== expected) {
      throw new EmpiricalError(
        "INVALID_DISCOVERY",
        `Discovery answer ${String(index + 1)} must be the '${String(expected)}' pass`,
      );
    }
    const title = requiredDiscoveryText(entry.title, `answer ${String(index + 1)} title`);
    const question = requiredDiscoveryText(entry.question, `answer ${String(index + 1)} question`);
    const answer = requiredDiscoveryText(entry.answer, `answer ${String(index + 1)} response`);
    let followUp: SocraticAnswer["followUp"] = null;
    if (entry.followUp !== null && entry.followUp !== undefined) {
      if (typeof entry.followUp !== "object") {
        throw new EmpiricalError("INVALID_DISCOVERY", `Discovery answer ${String(index + 1)} follow-up is invalid`);
      }
      followUp = {
        question: requiredDiscoveryText(entry.followUp.question, `answer ${String(index + 1)} follow-up question`),
        answer: requiredDiscoveryText(entry.followUp.answer, `answer ${String(index + 1)} follow-up response`),
      };
    }
    return { pass: entry.pass, title, question, answer, followUp };
  });
}

export function validateMaterialFollowUps(
  problem: string,
  answers: SocraticAnswer[],
  options: { complete?: boolean } = {},
): void {
  answers.forEach((entry, index) => {
    const expected = materialFollowUp(problem, entry, entry.answer);
    if (entry.followUp) {
      if (!expected) {
        throw new EmpiricalError(
          "INVALID_DISCOVERY",
          `Discovery '${entry.pass}' includes a follow-up that is not material`,
        );
      }
      if (entry.followUp.question !== expected) {
        throw new EmpiricalError(
          "INVALID_DISCOVERY",
          `Discovery '${entry.pass}' must use the material follow-up returned by Empirical`,
        );
      }
    } else if (expected && (options.complete || index < answers.length - 1)) {
      throw new EmpiricalError(
        "INVALID_DISCOVERY",
        `Discovery '${entry.pass}' requires its material follow-up before continuing`,
      );
    }
  });
}

export function nextSocraticPrompt(
  problem: string,
  answers: SocraticAnswer[],
): SocraticPrompt | null {
  const last = answers.at(-1);
  if (last && !last.followUp) {
    const followUp = materialFollowUp(problem, last, last.answer);
    if (followUp) {
      return { pass: last.pass, title: last.title, question: followUp, kind: "follow_up" };
    }
  }
  if (answers.length >= DISCOVERY_PASS_ORDER.length) return null;
  const prior = answers
    .map((entry) => `${entry.answer} ${entry.followUp?.answer ?? ""}`)
    .join(" ");
  const question = socraticQuestions(problem, prior)[answers.length]!;
  return { ...question, kind: "pass" };
}

export function recommendWorkflow(problem: string, answers: SocraticAnswer[]): DiscoveryWorkflow {
  const combined = `${problem} ${answers.map((item) => `${item.answer} ${item.followUp?.answer ?? ""}`).join(" ")}`;
  if (/(game|browser|ui|ux|screen|visual|css|react|vue|svelte|auth|security|permission|payment|migration|database|schema|api|dependency|infrastructure|architecture|refactor|multiple|cross-cutting)/i.test(combined)) {
    return "complex";
  }
  return /\b(typo|copy|wording|label|comment|rename|one line|single line)\b/i.test(combined)
    ? "fast"
    : "complex";
}

export async function saveDiscovery(root: string, record: DiscoveryRecord): Promise<DiscoveryPaths> {
  assertDiscoveryId(record.id);
  const storage = discoveryStorage(root, record.id);
  if (
    await isSymbolicLink(storage.rootDirectory)
    || await isSymbolicLink(storage.recordDirectory)
    || await isSymbolicLink(storage.jsonPath)
    || await isSymbolicLink(storage.markdownPath)
  ) {
    throw new EmpiricalError(
      "UNSAFE_DISCOVERY_PATH",
      `Discovery storage cannot use symbolic links: ${storage.recordDirectory}`,
    );
  }
  await mkdir(storage.recordDirectory, { recursive: true });
  await writeJsonAtomic(storage.jsonPath, record);
  await writeTextAtomic(storage.markdownPath, renderDiscoveryMarkdown(record));
  return {
    directory: portableRelative(root, storage.recordDirectory),
    json: portableRelative(root, storage.jsonPath),
    markdown: portableRelative(root, storage.markdownPath),
  };
}

export async function loadDiscovery(root: string, id: string): Promise<DiscoveryRecord> {
  assertDiscoveryId(id);
  const storage = discoveryStorage(root, id);
  if (
    await isSymbolicLink(storage.rootDirectory)
    || await isSymbolicLink(storage.recordDirectory)
    || await isSymbolicLink(storage.jsonPath)
  ) {
    throw new EmpiricalError(
      "UNSAFE_DISCOVERY_PATH",
      `Discovery storage cannot use symbolic links: ${storage.recordDirectory}`,
    );
  }
  if (!(await isFile(storage.jsonPath))) {
    throw new EmpiricalError("DISCOVERY_NOT_FOUND", `Discovery '${id}' was not found`);
  }
  let record: DiscoveryRecord;
  try {
    record = await readJson<DiscoveryRecord>(storage.jsonPath);
  } catch (error) {
    throw new EmpiricalError(
      "INVALID_DISCOVERY",
      `Discovery '${id}' could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  validateDiscoveryRecord(record, id);
  return record;
}

export function renderDiscoveryMarkdown(record: DiscoveryRecord): string {
  const answers = record.answers.map((answer, index) => {
    const followUp = answer.followUp
      ? `\n\n**Follow-up:** ${escapeInline(answer.followUp.question)}\n\n${quote(answer.followUp.answer)}`
      : "";
    return `## Pass ${index + 1}: ${escapeInline(answer.title)}\n\n**Question:** ${escapeInline(answer.question)}\n\n${quote(answer.answer)}${followUp}`;
  }).join("\n\n");
  const refined = record.refinedRequest ? `\n\n## Refined request\n\n${quote(record.refinedRequest)}` : "";
  const handoff = record.handoff
    ? `\n\n## Workflow handoff\n\n- Workflow: ${record.workflow}\n- Feature: ${record.handoff.feature}\n- Revision: ${record.handoff.revision}`
    : "";
  return `# Socratic discovery: ${escapeInline(record.problem)}

- Status: ${record.status}
- Created: ${record.createdAt}
- Updated: ${record.updatedAt}
${answers ? `\n${answers}` : ""}${refined}${handoff}
`;
}

function classifyDomains(problem: string): DiscoveryDomains {
  return {
    game: /\b(game|player|level|puzzle|cursor|loop|score|playable)\b/i.test(problem),
    ui: /\b(browser|ui|ux|screen|page|website|frontend|visual|mobile|desktop)\b/i.test(problem),
    api: /\b(api|endpoint|request|response|webhook|sdk)\b/i.test(problem),
    data: /\b(data|database|schema|migration|import|export|storage)\b/i.test(problem),
    security: /\b(auth|security|permission|role|token|secret|privacy|payment)\b/i.test(problem),
  };
}

function isVague(answer: string): boolean {
  return answer.length < 16
    || /^(i don'?t know|idk|not sure|whatever|anything|simple|basic|yes|no|maybe|tbd)[.!]?$/i.test(answer);
}

function requiredDiscoveryText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new EmpiricalError("INVALID_DISCOVERY", `Discovery ${label} must be non-empty`);
  }
  return value.trim();
}

function assertDiscoveryId(id: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(id)) {
    throw new EmpiricalError("INVALID_DISCOVERY", `Invalid discovery id: ${id}`);
  }
}

function discoveryStorage(root: string, id: string): {
  rootDirectory: string;
  recordDirectory: string;
  jsonPath: string;
  markdownPath: string;
} {
  const rootDirectory = join(root, ".empirical", "discoveries");
  const recordDirectory = join(rootDirectory, id);
  return {
    rootDirectory,
    recordDirectory,
    jsonPath: join(recordDirectory, "interview.json"),
    markdownPath: join(recordDirectory, "brief.md"),
  };
}

function validateDiscoveryRecord(record: DiscoveryRecord, expectedId: string): void {
  if (!record || typeof record !== "object" || record.schemaVersion !== DISCOVERY_SCHEMA_VERSION) {
    throw new EmpiricalError("INVALID_DISCOVERY", `Discovery '${expectedId}' has an unsupported schema`);
  }
  if (record.id !== expectedId) {
    throw new EmpiricalError("INVALID_DISCOVERY", `Discovery '${expectedId}' contains a mismatched id`);
  }
  requiredDiscoveryText(record.problem, "problem");
  if (!["draft", "approved", "started"].includes(record.status)) {
    throw new EmpiricalError("INVALID_DISCOVERY", `Discovery '${expectedId}' has an invalid status`);
  }
  validateSocraticAnswers(record.answers, { complete: record.status !== "draft" });
  if (record.status !== "draft" && !record.refinedRequest) {
    throw new EmpiricalError("INVALID_DISCOVERY", `Discovery '${expectedId}' is missing its refined request`);
  }
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .slice(0, 7)
    .join("-");
  return slug || "discovery";
}

function quote(value: string): string {
  return value.split(/\r?\n/).map((line) => `> ${line.replace(/<!--/g, "&lt;!--").replace(/-->/g, "--&gt;")}`).join("\n");
}

function escapeInline(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/<!--/g, "&lt;!--").replace(/-->/g, "--&gt;");
}

function portableRelative(from: string, to: string): string {
  return relative(from, to).replaceAll("\\", "/");
}
