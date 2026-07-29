import { mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, join, resolve } from "node:path";
import { EmpiricalError } from "./errors.js";
import { installProjectIntegrations } from "./integrations.js";
import { ProjectStore, discoverProject, isFile } from "./storage.js";
import {
  PRODUCT_VERSION,
  SCHEMA_VERSION,
  type ActionPacket,
  type AdoptionOptions,
  type CompletionInput,
  type Criterion,
  type Evidence,
  type EvidenceKind,
  type FeatureStartOptions,
  type InitOptions,
  type IntegrationReport,
  type Phase,
  type Profile,
  type ProjectConfig,
  type StartOptions,
  type ValidationReport,
  type Workflow,
  type WorkflowState,
} from "./types.js";

const FAST_PHASES: Phase[] = ["implement", "done"];
const QUICK_PHASES: Phase[] = ["shape", "implement", "verify", "review", "done"];
const COMPLEX_PHASES: Phase[] = [
  "specify",
  "design",
  "plan",
  "implement",
  "verify",
  "review",
  "done",
];

export class EmpiricalProject {
  readonly store: ProjectStore;

  private constructor(store: ProjectStore) {
    this.store = store;
  }

  static async open(start = process.cwd()): Promise<EmpiricalProject> {
    return new EmpiricalProject(await discoverProject(start));
  }

  static async initialize(
    root = process.cwd(),
    options: InitOptions = {},
  ): Promise<{ project: EmpiricalProject; state: WorkflowState; integrations: IntegrationReport }> {
    const absoluteRoot = resolve(root);
    await mkdir(absoluteRoot, { recursive: true });
    const store = new ProjectStore(absoluteRoot);
    if (await store.exists()) {
      const integrations = options.integrations === false
        ? emptyIntegrationReport()
        : await installProjectIntegrations(absoluteRoot);
      return { project: new EmpiricalProject(store), state: await store.loadState(), integrations };
    }
    if (await isFile(join(absoluteRoot, "ai", "STATE.md"))) {
      throw new EmpiricalError(
        "LEGACY_PROJECT",
        "An Empirical v1 ai/ workspace already exists; run empirical adopt",
      );
    }
    const profile = options.profile ?? "complex";
    assertWorkflow(profile);
    const config = defaultConfig(profile, null);
    const state = initialState(profile);
    await store.writeInitial(config, state);
    const integrations = options.integrations === false
      ? emptyIntegrationReport()
      : await installProjectIntegrations(absoluteRoot);
    return { project: new EmpiricalProject(store), state, integrations };
  }

  static async adopt(
    root = process.cwd(),
    options: AdoptionOptions = {},
  ): Promise<{ project: EmpiricalProject; state: WorkflowState; integrations: IntegrationReport }> {
    const absoluteRoot = resolve(root);
    const store = new ProjectStore(absoluteRoot);
    if (await store.exists()) {
      const integrations = options.integrations === false
        ? emptyIntegrationReport()
        : await installProjectIntegrations(absoluteRoot);
      return { project: new EmpiricalProject(store), state: await store.loadState(), integrations };
    }
    const legacyStatePath = join(absoluteRoot, "ai", "STATE.md");
    if (!(await isFile(legacyStatePath))) {
      throw new EmpiricalError(
        "LEGACY_NOT_FOUND",
        "No ai/STATE.md was found; use empirical init for a new repository",
      );
    }
    const legacy = await readFile(legacyStatePath, "utf8");
    const feature = legacyField(legacy, "current_spec") ?? legacyField(legacy, "currentSpec");
    const legacyPhase = legacyField(legacy, "current_phase")
      ?? legacyField(legacy, "currentPhase")
      ?? legacyField(legacy, "phase");
    const profile = options.profile ?? "complex";
    assertWorkflow(profile);
    const phase = feature ? mapLegacyPhase(legacyPhase, profile) : "idle";
    const now = new Date().toISOString();
    const state: WorkflowState = {
      ...initialState(profile),
      activeFeature: feature,
      phase,
      status: phase === "idle" ? "idle" : phase === "done" ? "done" : "waiting",
      updatedAt: now,
      message: "Adopted non-destructively from ai/",
    };
    await store.writeInitial(defaultConfig(profile, "ai"), state);
    if (feature) {
      const legacySpec = join(absoluteRoot, "ai", "specs", feature, "spec.md");
      if (await isFile(legacySpec)) {
        await store.writeSpec(feature, await readFile(legacySpec, "utf8"));
      } else {
        const request = `Adopted v1 feature ${feature}`;
        await store.writeSpec(
          feature,
          profile === "fast" ? renderFastSpec(feature, request) : renderSpec(feature, request),
        );
      }
    }
    const integrations = options.integrations === false
      ? emptyIntegrationReport()
      : await installProjectIntegrations(absoluteRoot);
    return { project: new EmpiricalProject(store), state, integrations };
  }

  async status(): Promise<WorkflowState> {
    return this.store.loadState();
  }

  async config(): Promise<ProjectConfig> {
    return this.store.loadConfig();
  }

  async start(request: string, options: StartOptions = {}): Promise<ActionPacket> {
    const cleanRequest = request.trim();
    if (!cleanRequest) {
      throw new EmpiricalError("REQUEST_REQUIRED", "A non-empty feature request is required");
    }
    const configuredProfile = (await this.store.loadConfig()).profile;
    const profile = options.profile ?? (configuredProfile === "quick" ? "complex" : configuredProfile);
    assertWorkflow(profile);
    const started = await this.store.transaction(async (current) => {
      if (current.activeFeature && current.status !== "done") {
        throw new EmpiricalError(
          "FEATURE_ACTIVE",
          `Feature ${current.activeFeature} is still ${current.status}; finish it before starting another`,
        );
      }
      const number = await this.store.nextFeatureNumber();
      const feature = options.id ?? `${String(number).padStart(3, "0")}-${slugify(cleanRequest)}`;
      if (await isFile(this.store.specPath(feature))) {
        throw new EmpiricalError("FEATURE_EXISTS", `Feature ${feature} already exists`);
      }
      const spec = profile === "fast"
        ? renderFastSpec(titleFromFeature(feature), cleanRequest)
        : renderSpec(titleFromFeature(feature), cleanRequest);
      await this.store.writeSpec(feature, spec);
      return {
        actor: "empirical-start",
        summary: `Started ${feature}`,
        state: {
          ...current,
          activeFeature: feature,
          request: cleanRequest,
          profile,
          phase: firstPhase(profile),
          status: "waiting",
          repairAttempts: 0,
          message: null,
          implementationActor: null,
          specDigest: digest(spec),
          evidence: [],
        },
        value: { feature, spec },
      };
    });
    return actionPacket(this.store.root, started.state, parseCriteria(started.value.spec));
  }

  async fast(request: string, options: FeatureStartOptions = {}): Promise<ActionPacket> {
    return this.begin(request, "fast", options);
  }

  async complex(request: string, options: FeatureStartOptions = {}): Promise<ActionPacket> {
    return this.begin(request, "complex", options);
  }

  async loop(): Promise<ActionPacket> {
    if (arguments.length > 0) {
      throw new EmpiricalError(
        "INVALID_ARGUMENT",
        "Loop only resumes current work; start new work with empirical fast or empirical complex",
      );
    }
    return this.next();
  }

  private async begin(
    request: string,
    profile: "fast" | "complex",
    options: FeatureStartOptions,
  ): Promise<ActionPacket> {
    const current = await this.store.loadState();
    const cleanRequest = request.trim();
    if (!cleanRequest) {
      throw new EmpiricalError("REQUEST_REQUIRED", "A non-empty feature request is required");
    }

    const currentRequest = current.request?.trim();
    const active = current.activeFeature !== null && current.status !== "done";
    if (active) {
      if (currentRequest !== cleanRequest) {
        throw new EmpiricalError(
          "FEATURE_ACTIVE",
          `Feature ${current.activeFeature} is still ${current.status}; finish it before starting another`,
        );
      }
      if (profile !== current.profile) {
        throw new EmpiricalError(
          "PROFILE_CONFLICT",
          `The active feature uses profile ${current.profile}, not ${profile}`,
        );
      }
      if (options.id && options.id !== current.activeFeature) {
        throw new EmpiricalError(
          "FEATURE_ACTIVE",
          `The active feature is ${current.activeFeature}, not ${options.id}`,
        );
      }
      return assertStartAction(await this.next(), cleanRequest, profile, options);
    }

    if (current.status === "done" && currentRequest === cleanRequest) {
      if (profile !== current.profile) {
        throw new EmpiricalError(
          "PROFILE_CONFLICT",
          `The completed feature used profile ${current.profile}, not ${profile}`,
        );
      }
      if (options.id && options.id !== current.activeFeature) {
        throw new EmpiricalError(
          "FEATURE_EXISTS",
          `The completed request belongs to ${current.activeFeature}, not ${options.id}`,
        );
      }
      return assertStartAction(await this.next(), cleanRequest, profile, options);
    }
    try {
      return await this.start(cleanRequest, { profile, ...options });
    } catch (error) {
      if (
        error instanceof EmpiricalError
        && (error.code === "FEATURE_ACTIVE" || error.code === "PROJECT_BUSY")
      ) {
        const latest = await this.next();
        if (latest.request === cleanRequest) {
          return assertStartAction(latest, cleanRequest, profile, options);
        }
      }
      throw error;
    }
  }

  async next(): Promise<ActionPacket> {
    const state = await this.store.loadState();
    const criteria = state.activeFeature
      ? parseCriteria(await this.store.readSpec(state.activeFeature))
      : [];
    return actionPacket(this.store.root, state, criteria);
  }

  async complete(input: CompletionInput): Promise<ActionPacket> {
    assertCompletionInput(input);
    const summary = input.summary.trim();
    if (!summary) throw new EmpiricalError("SUMMARY_REQUIRED", "Completion summary cannot be blank");
    const actor = input.actor?.trim() || "agent";
    const completed = await this.store.transaction(async (current) => {
      if (input.revision !== current.revision) {
        throw new EmpiricalError(
          "STALE_REVISION",
          `Expected revision ${input.revision}, but the project is at ${current.revision}`,
        );
      }
      if (!current.activeFeature || current.phase === "idle" || current.phase === "done") {
        throw new EmpiricalError("NO_ACTIVE_PHASE", "There is no active phase to complete");
      }
      if (current.status === "blocked") {
        throw new EmpiricalError("WORKFLOW_BLOCKED", "Resolve the blocker and run empirical retry");
      }
      if (current.status === "awaiting_human") {
        throw new EmpiricalError("AWAITING_HUMAN", "Run empirical retry after the decision is provided");
      }
      const specBefore = await this.store.readSpec(current.activeFeature);
      const specBeforeDigest = digest(specBefore);
      if (
        current.specDigest
        && current.specDigest !== specBeforeDigest
        && current.phase !== "shape"
        && current.phase !== "specify"
      ) {
        throw new EmpiricalError(
          "SPEC_CHANGED",
          "The specification changed after it was approved; restore it or start a new feature",
        );
      }
      const criteria = parseCriteria(specBefore);
      const config = await this.store.loadConfig();
      if (input.outcome === "passed") {
        await this.validatePhasePass(current, input, criteria, config);
      }
      const state = structuredClone(current);
      state.specDigest = specBeforeDigest;
      if (input.outcome === "awaiting_human") {
        state.status = "awaiting_human";
        state.message = summary;
      } else if (input.outcome === "blocked") {
        state.status = "blocked";
        state.message = summary;
      } else if (input.outcome === "failed") {
        routeFailure(state, summary, config.maxRepairAttempts);
      } else {
        if (state.phase === "implement") state.implementationActor = actor;
        if (input.evidence?.length) state.evidence.push(...input.evidence);
        state.phase = followingPhase(state.profile, state.phase);
        state.status = state.phase === "done" ? "done" : "waiting";
        state.message = summary;
        if (state.phase === "done") state.repairAttempts = 0;
      }
      return {
        actor,
        summary,
        state,
        value: specBefore,
        validate: async () => {
          if (await this.store.readSpec(current.activeFeature!) !== specBefore) {
            throw new EmpiricalError(
              "SPEC_CHANGED",
              "The specification changed during completion; read the latest action and retry",
            );
          }
        },
      };
    });
    return actionPacket(this.store.root, completed.state, parseCriteria(completed.value));
  }

  async retry(expectedRevision: number, actor = "human"): Promise<ActionPacket> {
    const current = await this.store.loadState();
    if (!(["blocked", "awaiting_human"] as const).includes(
      current.status as "blocked" | "awaiting_human",
    )) {
      throw new EmpiricalError("NOT_PAUSED", "The workflow is not blocked or awaiting human input");
    }
    const state = await this.store.transition(expectedRevision, actor, "Resumed workflow", (state) => ({
      ...state,
      status: "waiting",
      message: null,
    }));
    const criteria = state.activeFeature
      ? parseCriteria(await this.store.readSpec(state.activeFeature))
      : [];
    return actionPacket(this.store.root, state, criteria);
  }

  async verify(): Promise<ValidationReport> {
    const state = await this.store.loadState();
    if (!state.activeFeature) {
      return { valid: false, phase: state.phase, criteria: 0, missing: ["No active feature"] };
    }
    const spec = await this.store.readSpec(state.activeFeature);
    const criteria = parseCriteria(spec);
    const config = await this.store.loadConfig();
    const missing = validateEvidence(
      criteria,
      state.evidence,
      config,
      state.phase === "review" || state.phase === "done",
    );
    if (state.specDigest && state.specDigest !== digest(spec)) {
      missing.push("Specification changed after the last completed revision");
    }
    for (const record of state.evidence) {
      if (
        record.kind === "screenshot"
        && record.passed
        && record.artifact
        && !(await isFile(join(this.store.root, record.artifact)))
      ) {
        missing.push(`Screenshot artifact does not exist: ${record.artifact}`);
      }
    }
    return { valid: missing.length === 0, phase: state.phase, criteria: criteria.length, missing };
  }

  async integrations(): Promise<IntegrationReport> {
    return installProjectIntegrations(this.store.root);
  }

  async migrate(): Promise<Record<string, unknown>> {
    const migration = await this.store.migrateSchema();
    return { ...migration, version: PRODUCT_VERSION, schemaVersion: SCHEMA_VERSION };
  }

  async doctor(): Promise<Record<string, unknown>> {
    const state = await this.store.loadState();
    const config = await this.store.loadConfig();
    return {
      ok: true,
      version: PRODUCT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      root: this.store.root,
      state,
      config,
      runtime: "node",
      bunUsedForDevelopment: true,
      mcpCommand: "empirical mcp",
      canonicalStore: ".empirical",
    };
  }

  private async validatePhasePass(
    state: WorkflowState,
    input: CompletionInput,
    criteria: Criterion[],
    config: ProjectConfig,
  ): Promise<void> {
    if ((state.phase === "shape" || state.phase === "specify") && criteria.length === 0) {
      throw new EmpiricalError(
        "CRITERIA_REQUIRED",
        `Add at least one '- [ ] [AC-1] observable behavior' to ${relativeSpec(state.activeFeature)}`,
      );
    }
    if (state.phase === "design") {
      await requireArtifact(this.store.specDirectory(state.activeFeature!), "design.md");
    }
    if (state.phase === "plan") {
      await requireArtifact(this.store.specDirectory(state.activeFeature!), "plan.md");
    }
    if (state.phase === "verify") {
      const evidence = input.evidence ?? [];
      const missing = validateEvidence(criteria, evidence, config, false);
      if (missing.length > 0) {
        throw new EmpiricalError("EVIDENCE_REQUIRED", `Verification is incomplete: ${missing.join("; ")}`);
      }
      await validateEvidenceArtifacts(this.store.root, evidence);
    }
    if (state.phase === "review" && config.evidence.codeReview) {
      const review = input.evidence?.some((record) => record.kind === "review" && record.passed);
      if (!review) {
        throw new EmpiricalError("REVIEW_REQUIRED", "Review completion needs passing review evidence");
      }
    }
    if (state.profile === "fast" && state.phase === "implement") {
      if (criteria.length === 0) {
        throw new EmpiricalError(
          "CRITERIA_REQUIRED",
          `Add at least one '- [ ] [AC-1] observable behavior' to ${relativeSpec(state.activeFeature)}`,
        );
      }
      const evidence = input.evidence ?? [];
      const missing = validateEvidence(criteria, evidence, config, true);
      if (missing.length > 0) {
        throw new EmpiricalError(
          "EVIDENCE_REQUIRED",
          `Fast completion is incomplete: ${missing.join("; ")}`,
        );
      }
      await validateEvidenceArtifacts(this.store.root, evidence);
    }
  }
}

export function parseCriteria(markdown: string): Criterion[] {
  const criteria: Criterion[] = [];
  let inComment = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (line.includes("<!--")) inComment = true;
    if (inComment) {
      if (line.includes("-->")) inComment = false;
      continue;
    }
    const match = /^\s*-\s*\[([ xX])\]\s*\[([^\]]+)\]\s*(.+?)\s*$/.exec(line);
    if (!match?.[2] || !match[3]) continue;
    const id = match[2].trim();
    const text = match[3].trim();
    criteria.push({
      id,
      text,
      ui: /\[UI\]/i.test(text),
      checked: match[1]?.toLowerCase() === "x",
    });
  }
  return criteria;
}

function defaultConfig(profile: Profile, legacySource: "ai" | null): ProjectConfig {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile,
    maxRepairAttempts: 2,
    evidence: {
      required: true,
      browserForUi: true,
      screenshotForUi: true,
      codeReview: true,
    },
    legacySource,
  };
}

function initialState(profile: Profile): WorkflowState {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: 0,
    activeFeature: null,
    request: null,
    profile,
    phase: "idle",
    status: "idle",
    repairAttempts: 0,
    message: null,
    implementationActor: null,
    specDigest: null,
    evidence: [],
    updatedAt: new Date().toISOString(),
  };
}

function renderSpec(title: string, request: string): string {
  return `# ${title}

## Request

${renderRequest(request)}

## Goal

Describe the observable result.

## Acceptance Criteria

<!-- Replace this comment with observable criteria such as:
- [ ] [AC-1] The user can complete the intended action.
- [ ] [AC-UI-1] [UI] The result is visible in the browser.
-->

## Scope

## Non-goals

## Verification
`;
}

function renderFastSpec(title: string, request: string): string {
  const criterion = request
    .replace(/<!--/g, "&lt;!--")
    .replace(/-->/g, "--&gt;")
    .replace(/\s+/g, " ")
    .trim();
  return `# ${title}

## Request

${renderRequest(request)}

## Goal

${criterion}

## Acceptance Criteria

- [ ] [AC-1] ${criterion}

## Scope

Small, localized, and reversible changes required by the request.

## Non-goals

Unrequested behavior or broader architectural changes.

## Verification

Run the smallest real check that proves AC-1 and inspect the resulting diff.
`;
}

function renderRequest(request: string): string {
  return request
    .replace(/<!--/g, "&lt;!--")
    .replace(/-->/g, "--&gt;")
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
}

function actionPacket(root: string, state: WorkflowState, criteria: Criterion[]): ActionPacket {
  const evidence = requiredEvidence(state, criteria);
  const completionAvailable = state.status === "waiting"
    && state.phase !== "idle"
    && state.phase !== "done";
  const fastCliEvidence = state.profile === "fast"
    && evidence.length === 2
    && evidence.includes("test")
    && evidence.includes("review")
    ? ' --test "<test result>" --review "<diff review>"'
    : null;
  return {
    protocol: "empirical-sdd",
    schemaVersion: SCHEMA_VERSION,
    root,
    feature: state.activeFeature,
    request: state.request,
    profile: state.profile,
    phase: state.phase,
    status: state.status,
    revision: state.revision,
    instructions: instructionsFor(state),
    acceptanceCriteria: criteria,
    requiredEvidence: evidence,
    artifacts: expectedArtifacts(state),
    completion: {
      available: completionAvailable,
      mcpTool: "empirical_complete",
      cli: completionAvailable
        ? `empirical complete --revision ${state.revision} --outcome passed --summary "<what you did>"${fastCliEvidence ?? (evidence.length > 0 ? " --evidence <evidence.json>" : "")}`
        : "",
      requiredFields: completionAvailable
        ? ["revision", "outcome", "summary", ...(evidence.length > 0 ? ["evidence"] : [])]
        : [],
    },
  };
}

function assertStartAction(
  action: ActionPacket,
  request: string,
  profile: "fast" | "complex",
  options: FeatureStartOptions,
): ActionPacket {
  if (action.request?.trim() !== request) {
    throw new EmpiricalError(
      "FEATURE_ACTIVE",
      action.feature
        ? `Feature ${action.feature} belongs to a different request`
        : "The requested feature is no longer active",
    );
  }
  if (profile !== action.profile) {
    throw new EmpiricalError(
      "PROFILE_CONFLICT",
      `The feature uses profile ${action.profile}, not ${profile}`,
    );
  }
  if (options.id && options.id !== action.feature) {
    throw new EmpiricalError(
      "FEATURE_ACTIVE",
      `The active feature is ${action.feature ?? "none"}, not ${options.id}`,
    );
  }
  return action;
}

function instructionsFor(state: WorkflowState): string {
  if (state.status === "blocked") return `Stop. Resolve this blocker before retrying: ${state.message ?? "unknown"}`;
  if (state.status === "awaiting_human") return `Stop and ask the user: ${state.message ?? "a decision is required"}`;
  if (state.phase === "idle") return "No feature is active. Start it with empirical_fast or empirical_complex; use empirical loop only to resume current work.";
  if (state.phase === "done") return "The feature passed verification and review. Report completion; delivery is manual.";
  const feature = state.activeFeature ?? "current feature";
  const instructions: Record<Exclude<Phase, "idle" | "done">, string> = {
    shape: `Read the request, edit ${relativeSpec(feature)}, and define concise observable acceptance criteria. Do not implement yet.`,
    specify: `Refine ${relativeSpec(feature)} into a complete contract with observable acceptance criteria, scope, non-goals, risks, and verification.`,
    design: `Design the solution and write .empirical/specs/${feature}/design.md. Resolve architectural risks before implementation.`,
    plan: `Break the approved design into an executable plan in .empirical/specs/${feature}/plan.md.`,
    implement: state.profile === "fast"
      ? "Fast lane: the packet already contains the complete generated criterion. Inspect only the relevant project files, implement in one focused pass, combine the smallest real test and diff review when practical, then run the returned completion command. Do not reread Empirical state or add redundant checks. If the work is no longer small and low-risk, report failure so Empirical can escalate it."
      : "Implement the current acceptance criteria. Preserve unrelated work and run focused checks while editing.",
    verify: "Run real tests for every criterion. For [UI] criteria, use a real browser and capture a screenshot. Return structured evidence.",
    review: "Review the implementation against every criterion and the diff. Return passing review evidence or route failures back to implementation.",
  };
  return instructions[state.phase];
}

function expectedArtifacts(state: WorkflowState): string[] {
  if (!state.activeFeature) return [];
  const base = `.empirical/specs/${state.activeFeature}`;
  if (state.phase === "shape" || state.phase === "specify") return [`${base}/spec.md`];
  if (state.phase === "design") return [`${base}/design.md`];
  if (state.phase === "plan") return [`${base}/plan.md`];
  return [];
}

function requiredEvidence(state: WorkflowState, criteria: Criterion[]): EvidenceKind[] {
  const fast = state.profile === "fast" && state.phase === "implement";
  if (state.phase !== "verify" && state.phase !== "review" && !fast) return [];
  const kinds = new Set<EvidenceKind>();
  if (state.phase === "verify" || fast) kinds.add("test");
  if ((state.phase === "verify" || fast) && criteria.some((criterion) => criterion.ui)) {
    kinds.add("browser");
    kinds.add("screenshot");
  }
  if (state.phase === "review" || fast) kinds.add("review");
  return [...kinds];
}

function validateEvidence(
  criteria: Criterion[],
  evidence: Evidence[],
  config: ProjectConfig,
  includeReview: boolean,
): string[] {
  if (!config.evidence.required) return [];
  const missing: string[] = [];
  if (criteria.length === 0) missing.push("No acceptance criteria are defined");
  for (const criterion of criteria) {
    const records = evidence.filter((record) => record.criterionId === criterion.id && record.passed);
    if (!records.some((record) => record.kind === "test")) {
      missing.push(`${criterion.id} has no passing test evidence`);
    }
    if (criterion.ui && config.evidence.browserForUi && !records.some((record) => record.kind === "browser")) {
      missing.push(`${criterion.id} has no browser evidence`);
    }
    if (
      criterion.ui
      && config.evidence.screenshotForUi
      && !records.some((record) => record.kind === "screenshot" && record.artifact)
    ) {
      missing.push(`${criterion.id} has no screenshot artifact`);
    }
  }
  if (includeReview && config.evidence.codeReview && !evidence.some((record) => record.kind === "review" && record.passed)) {
    missing.push("No passing code review evidence");
  }
  return missing;
}

function routeFailure(
  state: WorkflowState,
  summary: string,
  maxRepairAttempts: number,
): WorkflowState {
  state.message = summary;
  if (state.profile === "fast" && state.phase === "implement") {
    state.profile = "complex";
    state.phase = "specify";
    state.repairAttempts = 0;
    state.evidence = [];
    state.status = "waiting";
    return state;
  }
  if (state.phase === "verify" || state.phase === "review") {
    state.repairAttempts += 1;
    state.evidence = [];
    if (state.repairAttempts > maxRepairAttempts) {
      state.status = "blocked";
      return state;
    }
    state.phase = "implement";
    state.status = "waiting";
    return state;
  }
  state.status = "waiting";
  return state;
}

function firstPhase(profile: Profile): Phase {
  if (profile === "fast") return "implement";
  return profile === "quick" ? "shape" : "specify";
}

function followingPhase(profile: Profile, phase: Phase): Phase {
  const sequence = profile === "fast"
    ? FAST_PHASES
    : profile === "quick"
      ? QUICK_PHASES
      : COMPLEX_PHASES;
  const index = sequence.indexOf(phase);
  if (index < 0) throw new EmpiricalError("INVALID_PHASE", `Phase ${phase} is not valid for ${profile}`);
  return sequence[index + 1] ?? "done";
}

function mapLegacyPhase(value: string | null, profile: Profile): Phase {
  const phase = value?.toLowerCase() ?? "";
  if (/done|complete|ready/.test(phase)) return "done";
  if (profile === "fast") return "implement";
  if (/review/.test(phase)) return "review";
  if (/test|verify|qa/.test(phase)) return "verify";
  if (/develop|implement|dev/.test(phase)) return "implement";
  if (profile === "quick") return "shape";
  if (/plan/.test(phase)) return "plan";
  if (/architect|design/.test(phase)) return "design";
  return "specify";
}

function legacyField(contents: string, field: string): string | null {
  const match = new RegExp(`^\\s*${field}\\s*:\\s*([^#\\r\\n]+)`, "im").exec(contents);
  const value = match?.[1]?.trim();
  if (!value || /<none|none|null/i.test(value)) return null;
  return value.replace(/^['"]|['"]$/g, "");
}

function slugify(request: string): string {
  const slug = request
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .slice(0, 7)
    .join("-");
  return slug || "feature";
}

function titleFromFeature(feature: string): string {
  const withoutNumber = feature.replace(/^\d+-/, "");
  return withoutNumber
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ") || basename(feature);
}

function relativeSpec(feature: string | null): string {
  return `.empirical/specs/${feature ?? "<feature>"}/spec.md`;
}

async function requireArtifact(directory: string, name: string): Promise<void> {
  const path = join(directory, name);
  if (!(await isFile(path)) || (await readFile(path, "utf8")).trim().length === 0) {
    throw new EmpiricalError("ARTIFACT_REQUIRED", `Create the non-empty artifact ${path}`);
  }
}

async function validateEvidenceArtifacts(root: string, evidence: Evidence[]): Promise<void> {
  for (const record of evidence) {
    if (
      record.kind === "screenshot"
      && record.passed
      && record.artifact
      && !(await isFile(join(root, record.artifact)))
    ) {
      throw new EmpiricalError(
        "EVIDENCE_REQUIRED",
        `Screenshot artifact does not exist: ${record.artifact}`,
      );
    }
  }
}

function digest(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

function emptyIntegrationReport(): IntegrationReport {
  return { created: [], updated: [], preserved: [] };
}

function assertWorkflow(profile: string): asserts profile is Workflow {
  if (profile !== "fast" && profile !== "complex") {
    throw new EmpiricalError("INVALID_PROFILE", `Workflow must be fast or complex, not '${profile}'`);
  }
}

function assertCompletionInput(input: CompletionInput): void {
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) {
    throw new EmpiricalError("INVALID_REVISION", "Completion revision must be a non-negative integer");
  }
  if (!("passed failed awaiting_human blocked".split(" ") as string[]).includes(input.outcome)) {
    throw new EmpiricalError("INVALID_OUTCOME", `Unsupported completion outcome '${String(input.outcome)}'`);
  }
  for (const record of input.evidence ?? []) {
    if (!record.criterionId?.trim() || !record.summary?.trim() || typeof record.passed !== "boolean") {
      throw new EmpiricalError("INVALID_EVIDENCE", "Evidence needs criterionId, summary, kind, and passed");
    }
    if (!("test browser screenshot review human".split(" ") as string[]).includes(record.kind)) {
      throw new EmpiricalError("INVALID_EVIDENCE", `Unsupported evidence kind '${String(record.kind)}'`);
    }
    if (
      record.artifact
      && (record.artifact.startsWith("/")
        || /^[A-Za-z]:[\\/]/.test(record.artifact)
        || record.artifact.split(/[\\/]/).includes(".."))
    ) {
      throw new EmpiricalError("INVALID_EVIDENCE", "Evidence artifact paths must stay inside the repository");
    }
  }
}
