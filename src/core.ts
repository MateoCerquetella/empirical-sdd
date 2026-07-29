import { mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, join, resolve } from "node:path";
import { EmpiricalError } from "./errors.js";
import { buildHandoffOption, detectSupportedAgents } from "./agents.js";
import { installProjectIntegrations } from "./integrations.js";
import { refreshRepositoryKnowledge, repositoryKnowledgePaths } from "./knowledge.js";
import { ProjectStore, discoverProject, isFile } from "./storage.js";
import { createDecisionTemplate, requireValidDecisions, validateDecisions } from "./decisions.js";
import { createGitWorktree, featureSlug, proposeWorktree as buildWorktreeProposal } from "./worktrees.js";
import {
  capabilityDeltaDigest,
  listCapabilities,
  loadCapabilityDeltas,
  planCapabilityArchive,
  validateFeatureDeltas,
} from "./specifications.js";
import {
  PRODUCT_VERSION,
  SCHEMA_VERSION,
  type ActionPacket,
  type ActionRationale,
  type AdoptionOptions,
  type AgentHandoffOffer,
  type AgentIntegrationId,
  type AuthorizedAgentHandoff,
  type ArchiveResult,
  type CapabilitySummary,
  type CompletionInput,
  type Criterion,
  type Evidence,
  type EvidenceKind,
  type ExplainReport,
  type ExplorationPacket,
  type FeatureStartResult,
  type FeatureStartOptions,
  type InitOptions,
  type IntegrationReport,
  type Phase,
  type Profile,
  type ProjectConfig,
  type ProjectPolicy,
  type ProjectConfigurationInput,
  type StartOptions,
  type ValidationReport,
  type Workflow,
  type WorkflowState,
  type WorktreeCreateInput,
  type WorktreeHandoff,
  type WorktreeProposal,
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
  "archive",
  "done",
];

export class EmpiricalProject {
  store: ProjectStore;
  private readonly readOnly: boolean;

  private constructor(store: ProjectStore, readOnly = false) {
    this.store = store;
    this.readOnly = readOnly;
  }

  static async open(start = process.cwd(), options: { migrate?: boolean } = {}): Promise<EmpiricalProject> {
    const base = await discoverProject(start);
    const migrate = options.migrate !== false;
    if (migrate) await base.migrateSchema();
    const active = await base.activeFeature(migrate);
    return new EmpiricalProject(active ? base.forFeature(active) : base);
  }

  static async openReadOnly(start = process.cwd()): Promise<EmpiricalProject> {
    const base = await discoverProject(start);
    await base.assertCurrentSchemaReadOnly();
    const active = await base.activeFeature(false);
    return new EmpiricalProject(active ? base.forFeature(active) : base, true);
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
      await store.migrateSchema();
      await refreshRepositoryKnowledge(absoluteRoot);
      const active = await store.activeFeature();
      const project = new EmpiricalProject(active ? store.forFeature(active) : store);
      return { project, state: await project.store.loadState(), integrations };
    }
    if (await isFile(join(absoluteRoot, "ai", "STATE.md"))) {
      throw new EmpiricalError(
        "LEGACY_PROJECT",
        "An Empirical v1 ai/ workspace already exists; use the Empirical agent entrypoint to adopt it",
      );
    }
    const profile = options.profile ?? "complex";
    assertWorkflow(profile);
    const config = defaultConfig(profile, null, options);
    const state = initialState(profile);
    await store.writeInitial(config);
    const integrations = options.integrations === false
      ? emptyIntegrationReport()
      : await installProjectIntegrations(absoluteRoot);
    await refreshRepositoryKnowledge(absoluteRoot);
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
      await store.migrateSchema();
      await refreshRepositoryKnowledge(absoluteRoot);
      const active = await store.activeFeature();
      const project = new EmpiricalProject(active ? store.forFeature(active) : store);
      return { project, state: await project.store.loadState(), integrations };
    }
    const legacyStatePath = join(absoluteRoot, "ai", "STATE.md");
    if (!(await isFile(legacyStatePath))) {
      throw new EmpiricalError(
        "LEGACY_NOT_FOUND",
        "No ai/STATE.md was found; use the Empirical agent entrypoint for a new repository",
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
    await store.writeInitial(defaultConfig(profile, "ai", options));
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
      await store.forFeature(feature).writeInitialFeature(state, "empirical-adopt", "Adopted Empirical v1 state");
    }
    const integrations = options.integrations === false
      ? emptyIntegrationReport()
      : await installProjectIntegrations(absoluteRoot);
    await refreshRepositoryKnowledge(absoluteRoot);
    const project = new EmpiricalProject(feature ? store.forFeature(feature) : store);
    return { project, state, integrations };
  }

  async status(): Promise<WorkflowState> {
    return this.store.loadState(!this.readOnly);
  }

  async config(): Promise<ProjectConfig> {
    return this.store.loadConfig();
  }

  async configure(input: ProjectConfigurationInput): Promise<ProjectConfig> {
    const current = await this.store.loadConfig();
    return this.store.configure({
      ...current,
      isolation: { ...current.isolation, ...input.isolation },
      decisions: { ...current.decisions, ...input.decisions },
      setupComplete: input.setupComplete ?? true,
    });
  }

  async policy(): Promise<ProjectPolicy> {
    return this.store.loadPolicy();
  }

  async explore(problem: string): Promise<ExplorationPacket> {
    const cleanProblem = problem.trim();
    if (!cleanProblem) throw new EmpiricalError("REQUEST_REQUIRED", "A non-empty problem is required");
    const policy = await this.store.loadPolicy();
    const capabilities = await listCapabilities(this.store);
    return {
      protocol: "empirical-sdd",
      schemaVersion: SCHEMA_VERSION,
      root: this.store.root,
      problem: cleanProblem,
      instructions: [
        "Use the current host agent only. Inspect the relevant code and living capability specifications; do not write implementation code yet.",
        "Identify the observed problem, affected users, current behavior, smallest useful outcome, constraints, risks, and two or three viable approaches.",
        "Ask only questions whose answers materially change scope or architecture, then restate the refined request in observable terms.",
        "Choose Fast only when the refined change is explicit, tiny, localized, reversible, low-risk, and non-UI; choose Complex otherwise.",
      ],
      questions: [
        "Who experiences the problem and what observable behavior should change?",
        "What is the smallest useful outcome, and what is explicitly out of scope?",
        "Which assumption, dependency, or risk could change the implementation approach?",
      ],
      projectContext: policy.context,
      knowledgeContext: await existingKnowledgePaths(this.store.root),
      capabilityContext: capabilities.map((capability) => capability.path),
      next: {
        fast: `empirical __internal fast ${JSON.stringify(cleanProblem)}`,
        complex: `empirical __internal complex ${JSON.stringify(cleanProblem)}`,
      },
    };
  }

  async capabilities(): Promise<CapabilitySummary[]> {
    return listCapabilities(this.store);
  }

  async context() {
    if (this.readOnly) {
      throw new EmpiricalError("READ_ONLY", "Repository knowledge refresh requires a writable project");
    }
    return refreshRepositoryKnowledge(this.store.root);
  }

  async handoff(): Promise<AgentHandoffOffer> {
    const state = await this.store.loadState(!this.readOnly);
    if (!state.activeFeature || state.profile !== "complex" || ["idle", "specify", "done"].includes(state.phase)) {
      throw new EmpiricalError(
        "HANDOFF_NOT_READY",
        "Agent handoff is available only after a Complex specification has passed",
      );
    }
    const specification = this.store.specPath(state.activeFeature);
    const specDigest = digest(await this.store.readSpec(state.activeFeature));
    const agents = await detectSupportedAgents({ includeConfigured: false });
    return {
      kind: "agent_handoff_offer",
      protocol: "empirical-sdd",
      schemaVersion: SCHEMA_VERSION,
      root: this.store.root,
      feature: state.activeFeature,
      specification,
      choices: ["current", "save", "agent"],
      agents: agents.map((agent) => buildHandoffOption({
        root: this.store.root,
        feature: state.activeFeature!,
        specification,
        specDigest,
        agent,
      })),
      requiresApproval: true,
    };
  }

  async authorizeHandoff(
    agent: AgentIntegrationId,
    approvalToken: string,
    approved: boolean,
  ): Promise<AuthorizedAgentHandoff> {
    if (approved !== true) {
      throw new EmpiricalError("HANDOFF_APPROVAL_REQUIRED", "Agent handoff requires explicit approval");
    }
    const offer = await this.handoff();
    const option = offer.agents.find((candidate) => candidate.id === agent);
    if (!option) throw new EmpiricalError("AGENT_NOT_DETECTED", `Agent ${agent} is not currently detected`);
    if (option.approvalToken !== approvalToken) {
      throw new EmpiricalError("STALE_HANDOFF_PROPOSAL", "The approved agent handoff changed; review a new proposal");
    }
    return {
      kind: "authorized_agent_handoff",
      protocol: "empirical-sdd",
      schemaVersion: SCHEMA_VERSION,
      root: offer.root,
      feature: offer.feature,
      agent,
      cwd: option.cwd,
      argv: [...option.argv],
      prompt: option.prompt,
    };
  }

  async capability(name: string): Promise<string | null> {
    return this.store.readCapability(name);
  }

  async start(request: string, options: StartOptions = {}): Promise<FeatureStartResult> {
    const cleanRequest = request.trim();
    if (!cleanRequest) {
      throw new EmpiricalError("REQUEST_REQUIRED", "A non-empty feature request is required");
    }
    const configuredProfile = (await this.store.loadConfig()).profile;
    const profile = options.profile ?? (configuredProfile === "quick" ? "complex" : configuredProfile);
    assertWorkflow(profile);
    const base = new ProjectStore(this.store.root);
    const active = await base.activeFeature();
    if (active) {
      const current = await base.forFeature(active).loadState();
      if (current.request?.trim() === cleanRequest) {
        this.store = base.forFeature(active);
        return assertStartAction(await this.next(), cleanRequest, profile, options);
      }
      return this.proposeWorktree(cleanRequest, profile, { ...(options.id ? { feature: options.id } : {}) });
    }
    const started = await base.withResourceLock("specs", async () => {
      const raced = await base.activeFeature();
      if (raced) {
        const current = await base.forFeature(raced).loadState();
        if (current.request?.trim() === cleanRequest) {
          return { existing: true as const, store: base.forFeature(raced), state: current, spec: await base.readSpec(raced) };
        }
        return { proposal: await this.proposeWorktree(cleanRequest, profile, { ...(options.id ? { feature: options.id } : {}) }) };
      }
      const feature = options.id ?? featureSlug(cleanRequest);
      if ((await base.listFeatureIds()).includes(feature)) {
        throw new EmpiricalError("FEATURE_EXISTS", `Feature ${feature} already exists; choose a distinct --id`);
      }
      const spec = profile === "fast"
        ? renderFastSpec(titleFromFeature(feature), cleanRequest)
        : renderSpec(titleFromFeature(feature), cleanRequest);
      await base.writeSpec(feature, spec);
      if (profile === "complex") await createDecisionTemplate(base, feature);
      const state: WorkflowState = {
        ...initialState(profile),
        revision: 1,
        activeFeature: feature,
        request: cleanRequest,
        phase: firstPhase(profile),
        status: "waiting",
        specDigest: digest(spec),
        capabilityArchiveRequired: profile === "complex",
        updatedAt: new Date().toISOString(),
      };
      const scoped = base.forFeature(feature);
      await scoped.writeInitialFeature(state);
      return { existing: false as const, store: scoped, state, spec };
    });
    if ("proposal" in started) return started.proposal;
    this.store = started.store;
    return this.packet(started.state, parseCriteria(started.spec));
  }

  async fast(request: string, options: FeatureStartOptions = {}): Promise<FeatureStartResult> {
    return this.begin(request, "fast", options);
  }

  async complex(request: string, options: FeatureStartOptions = {}): Promise<FeatureStartResult> {
    return this.begin(request, "complex", options);
  }

  async loop(): Promise<ActionPacket> {
    if (arguments.length > 0) {
      throw new EmpiricalError(
        "INVALID_ARGUMENT",
        "Loop only resumes current work; start new work through empirical_fast or empirical_complex",
      );
    }
    return this.next();
  }

  private async begin(
    request: string,
    profile: "fast" | "complex",
    options: FeatureStartOptions,
  ): Promise<FeatureStartResult> {
    const base = new ProjectStore(this.store.root);
    const activeFeature = await base.activeFeature();
    const current = activeFeature ? await base.forFeature(activeFeature).loadState() : await base.loadState();
    const cleanRequest = request.trim();
    if (!cleanRequest) {
      throw new EmpiricalError("REQUEST_REQUIRED", "A non-empty feature request is required");
    }

    const currentRequest = current.request?.trim();
    const active = current.activeFeature !== null && current.phase !== "done";
    if (active) {
      if (currentRequest !== cleanRequest) {
        return this.proposeWorktree(cleanRequest, profile, { ...(options.id ? { feature: options.id } : {}) });
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
      this.store = base.forFeature(current.activeFeature!);
      return assertStartAction(await this.next(), cleanRequest, profile, options);
    }

    try {
      return await this.start(cleanRequest, { profile, ...options });
    } catch (error) {
      if (
        error instanceof EmpiricalError
        && (error.code === "FEATURE_ACTIVE" || error.code === "PROJECT_BUSY")
      ) {
        const latest = await EmpiricalProject.open(this.store.root);
        const action = await latest.next();
        if (action.request === cleanRequest) {
          this.store = latest.store;
          return assertStartAction(action, cleanRequest, profile, options);
        }
      }
      throw error;
    }
  }

  async proposeWorktree(
    request: string,
    workflow: Workflow,
    overrides: {
      changeType?: "feature" | "fix" | "chore";
      feature?: string;
      branch?: string;
      path?: string;
      base?: string;
    } = {},
  ): Promise<WorktreeProposal> {
    const base = new ProjectStore(this.store.root);
    const activeFeature = await base.activeFeature(!this.readOnly);
    if (!activeFeature) {
      throw new EmpiricalError("WORKTREE_NOT_NEEDED", "This checkout has no active feature; start the request here");
    }
    const config = await base.loadConfig();
    if (config.isolation.mode === "off") {
      throw new EmpiricalError(
        "FEATURE_ACTIVE",
        `Feature ${activeFeature} is active and automatic worktree proposals are disabled`,
      );
    }
    return buildWorktreeProposal(
      base.root,
      request,
      workflow,
      activeFeature,
      config.isolation,
      overrides,
    );
  }

  async createWorktree(input: WorktreeCreateInput): Promise<WorktreeHandoff> {
    if (input.approved !== true) {
      throw new EmpiricalError("WORKTREE_APPROVAL_REQUIRED", "Worktree creation requires approved: true");
    }
    const proposal = await this.proposeWorktree(input.request, input.workflow, {
      ...(input.changeType ? { changeType: input.changeType } : {}),
      ...(input.feature ? { feature: input.feature } : {}),
      ...(input.branch ? { branch: input.branch } : {}),
      ...(input.path ? { path: input.path } : {}),
      ...(input.base ? { base: input.base } : {}),
    });
    if (proposal.activeFeature !== input.activeFeature) {
      throw new EmpiricalError(
        "STALE_WORKTREE_PROPOSAL",
        `The active feature changed from ${input.activeFeature} to ${proposal.activeFeature}; review a new proposal`,
      );
    }
    if (proposal.baseCommit !== input.baseCommit) {
      throw new EmpiricalError(
        "STALE_WORKTREE_PROPOSAL",
        `Base ${proposal.base} moved after approval; review a new proposal`,
      );
    }
    if (proposal.approvalToken !== input.approvalToken) {
      throw new EmpiricalError(
        "STALE_WORKTREE_PROPOSAL",
        "The approved worktree fields changed; review and approve a new proposal",
      );
    }
    await createGitWorktree(proposal);
    try {
      let project: EmpiricalProject;
      try {
        project = await EmpiricalProject.open(proposal.path);
      } catch (error) {
        if (!(error instanceof EmpiricalError) || error.code !== "PROJECT_NOT_INITIALIZED") throw error;
        project = (await EmpiricalProject.initialize(proposal.path, { integrations: false })).project;
      }
      const result = proposal.workflow === "fast"
        ? await project.fast(proposal.request, { id: proposal.feature })
        : await project.complex(proposal.request, { id: proposal.feature });
      if (result.kind !== "action") {
        throw new EmpiricalError(
          "WORKTREE_HANDOFF_FAILED",
          `The new checkout already contains active feature ${result.activeFeature}`,
        );
      }
      return {
        kind: "worktree_handoff",
        protocol: "empirical-sdd",
        schemaVersion: SCHEMA_VERSION,
        root: proposal.root,
        path: proposal.path,
        branch: proposal.branch,
        base: proposal.base,
        baseCommit: proposal.baseCommit,
        feature: result.feature!,
        revision: result.revision,
        workflow: proposal.workflow,
        resume: `cd ${JSON.stringify(proposal.path)} && empirical __internal loop`,
        action: result,
      };
    } catch (error) {
      throw new EmpiricalError(
        "WORKTREE_HANDOFF_FAILED",
        `Git created ${proposal.path}, but Empirical handoff failed: ${error instanceof Error ? error.message : String(error)}`,
        { path: proposal.path, branch: proposal.branch, base: proposal.base, baseCommit: proposal.baseCommit },
      );
    }
  }

  async explain(): Promise<ExplainReport> {
    const state = await this.store.loadState(!this.readOnly);
    const criteria = state.activeFeature
      ? parseCriteria(await this.store.readSpec(state.activeFeature))
      : [];
    const packet = await this.packet(state, criteria);
    const decisions = state.activeFeature && state.profile === "complex"
      ? (await validateDecisions(this.store, state.activeFeature, false)).decisions
          .filter((decision) => decision.status === "Accepted")
      : [];
    return {
      protocol: "empirical-sdd",
      schemaVersion: SCHEMA_VERSION,
      root: this.store.root,
      feature: state.activeFeature,
      phase: state.phase,
      status: state.status,
      revision: state.revision,
      rationale: packet.rationale,
      decisions,
    };
  }

  async next(): Promise<ActionPacket> {
    const state = await this.store.loadState(!this.readOnly);
    const criteria = state.activeFeature
      ? parseCriteria(await this.store.readSpec(state.activeFeature))
      : [];
    return this.packet(state, criteria);
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
      if (current.phase === "archive") {
        throw new EmpiricalError("ARCHIVE_REQUIRED", "Use empirical_archive for the reviewed revision");
      }
      if (current.status === "blocked") {
        throw new EmpiricalError("WORKFLOW_BLOCKED", "Resolve the blocker and call empirical_retry");
      }
      if (current.status === "awaiting_human") {
        throw new EmpiricalError("AWAITING_HUMAN", "Call empirical_retry after the decision is provided");
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
      await this.assertCapabilityDeltasUnchanged(current);
      const criteria = parseCriteria(specBefore);
      const config = await this.store.loadConfig();
      let approvedDeltaDigest: string | null = null;
      if (input.outcome === "passed") {
        approvedDeltaDigest = await this.validatePhasePass(current, input, criteria, config);
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
        if (current.phase === "specify" && current.capabilityArchiveRequired) {
          state.capabilityDeltaDigest = approvedDeltaDigest;
        }
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
          if (
            approvedDeltaDigest
            && await capabilityDeltaDigest(this.store, current.activeFeature!) !== approvedDeltaDigest
          ) {
            throw new EmpiricalError(
              "DELTA_CHANGED",
              "Capability deltas changed during completion; read the latest action and retry",
            );
          }
        },
      };
    });
    return this.packet(completed.state, parseCriteria(completed.value));
  }

  async archive(expectedRevision: number, actor = "agent"): Promise<ArchiveResult> {
    const current = await this.store.loadState();
    if (!current.activeFeature) throw new EmpiricalError("NO_ACTIVE_PHASE", "There is no feature to archive");
    if (
      current.phase === "done"
      && current.status === "done"
      && current.profile === "complex"
      && current.revision === expectedRevision + 1
      && current.message?.startsWith("Archived")
    ) {
      return {
        action: await this.next(),
        report: {
          feature: current.activeFeature,
          capabilities: [],
          added: 0,
          modified: 0,
          removed: 0,
          converged: true,
        },
      };
    }
    if (current.phase === "done" && current.status === "done") {
      throw new EmpiricalError(
        "STALE_REVISION",
        `Archive revision ${expectedRevision} does not identify the latest completed archive`,
      );
    }
    if (current.phase !== "archive" || current.status !== "waiting") {
      throw new EmpiricalError("ARCHIVE_NOT_READY", "Complex work must pass review before archive");
    }
    if (current.revision !== expectedRevision) {
      throw new EmpiricalError(
        "STALE_REVISION",
        `Expected revision ${expectedRevision}, but the project is at ${current.revision}`,
      );
    }
    return this.store.withResourceLock("capabilities", async () => {
      await this.assertCapabilityDeltasUnchanged(current);
      const deltas = await loadCapabilityDeltas(this.store, current.activeFeature!);
      const plan = deltas.length > 0
        ? await planCapabilityArchive(this.store, current.activeFeature!)
        : null;
      if (!plan && current.capabilityArchiveRequired) {
        throw new EmpiricalError("DELTA_REQUIRED", `Complex change ${current.activeFeature} has no capability deltas`);
      }
      const archived = await this.store.transaction(async (latest) => {
        if (latest.revision !== expectedRevision) {
          throw new EmpiricalError(
            "STALE_REVISION",
            `Expected revision ${expectedRevision}, but the project is at ${latest.revision}`,
          );
        }
        if (latest.phase !== "archive" || latest.status !== "waiting") {
          throw new EmpiricalError("ARCHIVE_NOT_READY", "Complex work must pass review before archive");
        }
        const state = structuredClone(latest);
        state.phase = "done";
        state.status = "done";
        state.message = plan
          ? `Archived capability changes: ${plan.report.capabilities.join(", ")}`
          : "Archived legacy change without capability deltas";
        state.repairAttempts = 0;
        return {
          actor: actor.trim() || "agent",
          summary: state.message,
          state,
          value: latest.activeFeature!,
          ...(plan ? { effect: plan.commit } : {}),
        };
      });
      return {
        action: await this.packet(
          archived.state,
          parseCriteria(await this.store.readSpec(archived.value)),
        ),
        report: {
          feature: archived.value,
          capabilities: plan?.report.capabilities ?? [],
          added: plan?.report.added ?? 0,
          modified: plan?.report.modified ?? 0,
          removed: plan?.report.removed ?? 0,
          converged: false,
        },
      };
    });
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
    return this.packet(state, criteria);
  }

  async verify(): Promise<ValidationReport> {
    const state = await this.store.loadState(!this.readOnly);
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
      state.phase === "review" || state.phase === "archive" || state.phase === "done",
    );
    if (state.specDigest && state.specDigest !== digest(spec)) {
      missing.push("Specification changed after the last completed revision");
    }
    if (state.capabilityArchiveRequired && state.capabilityDeltaDigest) {
      try {
        if (await capabilityDeltaDigest(this.store, state.activeFeature) !== state.capabilityDeltaDigest) {
          missing.push("Capability deltas changed after Specify approval");
        }
      } catch {
        missing.push("Capability deltas are malformed or unreadable after Specify approval");
      }
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
    const migration = await new ProjectStore(this.store.root).migrateSchema();
    return {
      ...migration,
      version: PRODUCT_VERSION,
      schemaVersion: SCHEMA_VERSION,
    };
  }

  async doctor(): Promise<Record<string, unknown>> {
    const state = await this.store.loadState(!this.readOnly);
    const config = await this.store.loadConfig();
    return {
      ok: true,
      version: PRODUCT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      root: this.store.root,
      state,
      config,
      activeFeature: await new ProjectStore(this.store.root).activeFeature(!this.readOnly),
      policy: await this.store.loadPolicy(),
      capabilities: await this.capabilities(),
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
  ): Promise<string | null> {
    let approvedDeltaDigest: string | null = null;
    if ((state.phase === "shape" || state.phase === "specify") && criteria.length === 0) {
      throw new EmpiricalError(
        "CRITERIA_REQUIRED",
        `Add at least one '- [ ] [AC-1] observable behavior' to ${relativeSpec(state.activeFeature)}`,
      );
    }
    if (state.phase === "specify" && state.profile === "complex" && state.capabilityArchiveRequired) {
      const report = await validateFeatureDeltas(this.store, state.activeFeature!);
      if (!report.valid) {
        throw new EmpiricalError("DELTA_REQUIRED", `Capability deltas are incomplete: ${report.issues.join("; ")}`);
      }
      approvedDeltaDigest = report.digest;
    }
    if (state.phase === "design") {
      await requireArtifact(this.store.specDirectory(state.activeFeature!), "design.md");
      if (config.decisions.complexRecords === "required" && state.profile === "complex") {
        await requireValidDecisions(this.store, state.activeFeature!);
      }
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
      if (config.decisions.complexRecords === "required" && state.profile === "complex") {
        await requireValidDecisions(this.store, state.activeFeature!);
      }
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
    return approvedDeltaDigest;
  }

  private async assertCapabilityDeltasUnchanged(state: WorkflowState): Promise<void> {
    if (!state.capabilityArchiveRequired || !state.capabilityDeltaDigest || !state.activeFeature) return;
    try {
      if (await capabilityDeltaDigest(this.store, state.activeFeature) === state.capabilityDeltaDigest) return;
    } catch {
      // Report one stable workflow error for malformed, missing, or unreadable approved deltas.
    }
    throw new EmpiricalError(
      "DELTA_CHANGED",
      "Capability deltas changed after Specify approval; restore the approved deltas before continuing",
    );
  }

  private async packet(state: WorkflowState, criteria: Criterion[]): Promise<ActionPacket> {
    const policy = await this.store.loadPolicy();
    const config = await this.store.loadConfig();
    const capabilities = await listCapabilities(this.store);
    const artifacts = expectedArtifacts(state, config.decisions.complexRecords === "required");
    const missingArtifacts: string[] = [];
    for (const artifact of artifacts) {
      if (artifact.includes("deltas/<capability>.md") && state.activeFeature) {
        if (!(await validateFeatureDeltas(this.store, state.activeFeature)).valid) missingArtifacts.push(artifact);
      } else if (artifact.endsWith("/decisions.md") && state.activeFeature) {
        if (!(await validateDecisions(this.store, state.activeFeature, state.phase === "design" || state.phase === "review")).valid) {
          missingArtifacts.push(artifact);
        }
      } else if (artifact.includes("<capability>")) {
        missingArtifacts.push(artifact);
      } else if (!(await isFile(join(this.store.root, artifact)))) {
        missingArtifacts.push(artifact);
      }
    }
    return actionPacket(
      this.store.root,
      state,
      criteria,
      policy,
      await existingKnowledgePaths(this.store.root),
      capabilities.map((capability) => capability.path),
      artifacts,
      missingArtifacts,
    );
  }
}

export function parseCriteria(markdown: string): Criterion[] {
  const criteria: Criterion[] = [];
  let inComment = false;
  let activeCriterion: Criterion | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    if (line.includes("<!--")) {
      inComment = true;
      activeCriterion = null;
    }
    if (inComment) {
      if (line.includes("-->")) inComment = false;
      continue;
    }
    const match = /^\s*-\s*\[([ xX])\]\s*\[([^\]]+)\]\s*(.+?)\s*$/.exec(line);
    if (match?.[2] && match[3]) {
      const id = match[2].trim();
      const text = match[3].trim();
      activeCriterion = {
        id,
        text,
        ui: /\[UI\]/i.test(text),
        checked: match[1]?.toLowerCase() === "x",
      };
      criteria.push(activeCriterion);
      continue;
    }
    if (activeCriterion && /^\s{2,}\S/.test(line)) {
      activeCriterion.text = `${activeCriterion.text} ${line.trim()}`;
      activeCriterion.ui = /\[UI\]/i.test(activeCriterion.text);
      continue;
    }
    activeCriterion = null;
  }
  return criteria;
}

function defaultConfig(
  profile: Profile,
  legacySource: "ai" | null,
  options: ProjectConfigurationInput = {},
): ProjectConfig {
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
    isolation: {
      mode: options.isolation?.mode ?? "ask",
      baseBranch: options.isolation?.baseBranch ?? "auto",
      worktreePath: options.isolation?.worktreePath ?? "../{repo}-{feature}",
      branchPattern: options.isolation?.branchPattern ?? "{type}/{feature}",
    },
    decisions: {
      complexRecords: options.decisions?.complexRecords ?? "required",
    },
    setupComplete: options.setupComplete ?? true,
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
    capabilityArchiveRequired: false,
    capabilityDeltaDigest: null,
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

## Capability Deltas

Create one or more files under deltas/<capability>.md using ADDED, MODIFIED, or
REMOVED Requirements sections, named Requirement blocks, and concrete Scenario
examples. These merge into living specifications
after verification and review.
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

function actionPacket(
  root: string,
  state: WorkflowState,
  criteria: Criterion[],
  policy: ProjectPolicy,
  knowledgeContext: string[],
  capabilityContext: string[],
  artifacts: string[],
  missingArtifacts: string[],
): ActionPacket {
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
  const archive = state.phase === "archive";
  return {
    kind: "action",
    protocol: "empirical-sdd",
    schemaVersion: SCHEMA_VERSION,
    root,
    feature: state.activeFeature,
    request: state.request,
    profile: state.profile,
    phase: state.phase,
    status: state.status,
    revision: state.revision,
    instructions: instructionsFor(state, policy),
    rationale: rationaleFor(state, artifacts, missingArtifacts, evidence),
    acceptanceCriteria: criteria,
    requiredEvidence: evidence,
    artifacts,
    projectContext: policy.context,
    knowledgeContext,
    capabilityContext,
    completion: {
      available: completionAvailable,
      mcpTool: archive ? "empirical_archive" : "empirical_complete",
      cli: completionAvailable
        ? archive
          ? `empirical __internal archive --revision ${state.revision}`
          : `empirical __internal complete --revision ${state.revision} --outcome passed --summary "<what you did>"${fastCliEvidence ?? (evidence.length > 0 ? " --evidence <evidence.json>" : "")}`
        : "",
      requiredFields: completionAvailable
        ? archive
          ? ["revision"]
          : ["revision", "outcome", "summary", ...(evidence.length > 0 ? ["evidence"] : [])]
        : [],
    },
  };
}

function rationaleFor(
  state: WorkflowState,
  artifacts: string[],
  missingArtifacts: string[],
  evidence: EvidenceKind[],
): ActionRationale {
  const currentState = `${state.phase}/${state.status} at revision ${state.revision}`;
  const nextAction = state.status === "blocked" || state.status === "awaiting_human"
    ? "Resolve the stated gate, then retry the exact revision"
    : state.phase === "idle"
      ? "Start an approved Fast or Complex feature"
      : state.phase === "done"
        ? "Report completion"
        : state.phase === "archive"
          ? "Archive the reviewed capability deltas"
          : `Complete ${state.phase} at revision ${state.revision}`;
  const reason = state.phase === "idle"
    ? "No non-terminal feature state exists in this checkout."
    : state.phase === "done"
      ? "All workflow gates have completed."
      : state.status === "blocked" || state.status === "awaiting_human"
        ? state.message ?? "The workflow state machine has an unresolved stop condition."
        : `The ${state.profile} state machine advances from ${state.phase} only after its artifacts and evidence pass.`;
  return {
    currentState,
    nextAction,
    reason,
    requiredContext: [...artifacts, ...evidence.map((kind) => `${kind} evidence`)],
    missingContext: [...missingArtifacts, ...evidence.map((kind) => `${kind} evidence`)],
    gate: state.status === "blocked" || state.status === "awaiting_human" ? "stop" : "proceed",
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

function instructionsFor(state: WorkflowState, policy: ProjectPolicy): string {
  if (state.status === "blocked") return appendPolicy(`Stop. Resolve this blocker before retrying: ${state.message ?? "unknown"}`, state, policy);
  if (state.status === "awaiting_human") return appendPolicy(`Stop and ask the user: ${state.message ?? "a decision is required"}`, state, policy);
  if (state.phase === "idle") return appendPolicy("No feature is active. Explore genuinely vague work first; otherwise start it with empirical_fast or empirical_complex. Use empirical_loop only to resume current work.", state, policy);
  if (state.phase === "done") return appendPolicy("The feature passed verification, review, and required capability archive. Report completion; delivery is manual.", state, policy);
  const feature = state.activeFeature ?? "current feature";
  const instructions: Record<Exclude<Phase, "idle" | "done">, string> = {
    shape: `Read the request, edit ${relativeSpec(feature)}, and define concise observable acceptance criteria. Do not implement yet.`,
    specify: `Refine ${relativeSpec(feature)} into a complete contract with observable acceptance criteria, scope, non-goals, risks, and verification. Declare current-behavior changes in .empirical/specs/${feature}/deltas/<capability>.md using ADDED, MODIFIED, or REMOVED requirement blocks with scenarios.`,
    design: `Design the solution in .empirical/specs/${feature}/design.md and maintain .empirical/specs/${feature}/decisions.md with accepted evidence, options, the chosen approach, trade-offs/risks, and verification. Record concise reviewable decisions, never private chain-of-thought.`,
    plan: `Break the approved design into an executable plan in .empirical/specs/${feature}/plan.md.`,
    implement: state.profile === "fast"
      ? "Fast lane: the packet already contains the complete generated criterion. Inspect only the relevant project files, implement in one focused pass, combine the smallest real test and diff review when practical, then run the returned completion command. Do not reread Empirical state or add redundant checks. If the work is no longer small and low-risk, report failure so Empirical can escalate it."
      : "Implement the current acceptance criteria. Preserve unrelated work and run focused checks while editing.",
    verify: "Run real tests for every criterion. For [UI] criteria, use a real browser and capture a screenshot. Return structured evidence.",
    review: `Review the implementation against every criterion, the diff, and accepted decisions in .empirical/specs/${feature}/decisions.md. Contradictions require an explicit accepted superseding entry. Return passing review evidence or route failures back to implementation.`,
    archive: "Apply the reviewed capability deltas to the living specifications with the returned empirical_archive operation. Do not edit capability specs manually during archive.",
  };
  return appendPolicy(instructions[state.phase], state, policy);
}

function appendPolicy(base: string, state: WorkflowState, policy: ProjectPolicy): string {
  const sections = [base];
  if (policy.context.length > 0) sections.push(`Project context:\n- ${policy.context.join("\n- ")}`);
  const phaseGuidance = policy.phases[state.phase] ?? [];
  if (phaseGuidance.length > 0) {
    sections.push(`Additional project guidance (mandatory Empirical gates still apply):\n- ${phaseGuidance.join("\n- ")}`);
  }
  return sections.join("\n\n");
}

function expectedArtifacts(state: WorkflowState, decisionsRequired: boolean): string[] {
  if (!state.activeFeature) return [];
  const base = `.empirical/specs/${state.activeFeature}`;
  if (state.phase === "shape") return [`${base}/spec.md`];
  if (state.phase === "specify") return [`${base}/spec.md`, `${base}/deltas/<capability>.md`];
  if (state.phase === "design") return [`${base}/design.md`, ...(decisionsRequired ? [`${base}/decisions.md`] : [])];
  if (state.phase === "plan") return [`${base}/plan.md`];
  if (state.phase === "review") return decisionsRequired ? [`${base}/decisions.md`] : [];
  if (state.phase === "archive") return [".empirical/capabilities/<capability>/spec.md"];
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
    state.capabilityArchiveRequired = true;
    state.capabilityDeltaDigest = null;
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
  return { scope: "project", created: [], updated: [], removed: [], preserved: [], entrypoints: [] };
}

async function existingKnowledgePaths(root: string): Promise<string[]> {
  const paths = repositoryKnowledgePaths();
  const existing = await Promise.all(paths.map(async (path) => ({ path, exists: await isFile(join(root, path)) })));
  return existing.filter((item) => item.exists).map((item) => item.path);
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
