export const SCHEMA_VERSION = 4 as const;
export const PRODUCT_VERSION = "0.20.2";
export const POLICY_SCHEMA_VERSION = 1 as const;

export type Workflow = "fast" | "complex";
export type Profile = Workflow | "quick";
export type Phase =
  | "idle"
  | "shape"
  | "specify"
  | "design"
  | "plan"
  | "implement"
  | "verify"
  | "review"
  | "archive"
  | "done";
export type WorkflowStatus =
  | "idle"
  | "waiting"
  | "awaiting_human"
  | "blocked"
  | "done";
export type Outcome = "passed" | "failed" | "awaiting_human" | "blocked";
export type EvidenceKind = "test" | "browser" | "screenshot" | "review" | "human";
export type ChangeType = "feature" | "fix" | "chore";
export type IsolationMode = "ask" | "off";
export type ComplexDecisionMode = "required" | "off";

export interface IsolationConfig {
  mode: IsolationMode;
  baseBranch: string;
  worktreePath: string;
  branchPattern: string;
}

export interface DecisionConfig {
  complexRecords: ComplexDecisionMode;
}

export interface ProjectConfig {
  schemaVersion: typeof SCHEMA_VERSION;
  profile: Profile;
  maxRepairAttempts: number;
  evidence: {
    required: boolean;
    browserForUi: boolean;
    screenshotForUi: boolean;
    codeReview: boolean;
  };
  isolation: IsolationConfig;
  decisions: DecisionConfig;
  setupComplete: boolean;
  legacySource: "ai" | null;
}

export interface ProjectConfigurationInput {
  isolation?: Partial<IsolationConfig>;
  decisions?: Partial<DecisionConfig>;
  setupComplete?: boolean;
}

export interface WorkflowState {
  schemaVersion: typeof SCHEMA_VERSION;
  revision: number;
  activeFeature: string | null;
  request: string | null;
  profile: Profile;
  phase: Phase;
  status: WorkflowStatus;
  repairAttempts: number;
  message: string | null;
  implementationActor: string | null;
  specDigest: string | null;
  capabilityArchiveRequired: boolean;
  capabilityDeltaDigest: string | null;
  evidence: Evidence[];
  updatedAt: string;
}

export interface ProjectPolicy {
  schemaVersion: typeof POLICY_SCHEMA_VERSION;
  context: string[];
  phases: Partial<Record<Phase, string[]>>;
}

export interface Criterion {
  id: string;
  text: string;
  ui: boolean;
  checked: boolean;
}

export interface Evidence {
  criterionId: string;
  kind: EvidenceKind;
  passed: boolean;
  summary: string;
  artifact?: string;
}

export interface CompletionInput {
  revision: number;
  outcome: Outcome;
  summary: string;
  actor?: string;
  evidence?: Evidence[];
}

export interface ActionRationale {
  currentState: string;
  nextAction: string;
  reason: string;
  requiredContext: string[];
  missingContext: string[];
  gate: "proceed" | "stop";
}

export interface ActionPacket {
  kind: "action";
  protocol: "empirical-sdd";
  schemaVersion: typeof SCHEMA_VERSION;
  root: string;
  feature: string | null;
  request: string | null;
  profile: Profile;
  phase: Phase;
  status: WorkflowStatus;
  revision: number;
  instructions: string;
  rationale: ActionRationale;
  acceptanceCriteria: Criterion[];
  requiredEvidence: EvidenceKind[];
  artifacts: string[];
  projectContext: string[];
  knowledgeContext: string[];
  capabilityContext: string[];
  completion: {
    available: boolean;
    mcpTool: "empirical_complete" | "empirical_archive";
    cli: string;
    requiredFields: string[];
  };
}

export interface WorktreeProposal {
  kind: "worktree_proposal";
  protocol: "empirical-sdd";
  schemaVersion: typeof SCHEMA_VERSION;
  root: string;
  request: string;
  workflow: Workflow;
  changeType: ChangeType;
  feature: string;
  branch: string;
  path: string;
  base: string;
  baseCommit: string;
  activeFeature: string;
  approvalToken: string;
  command: string[];
  requiresApproval: true;
}

export interface WorktreeCreateInput {
  request: string;
  workflow: Workflow;
  changeType?: ChangeType;
  feature?: string;
  branch?: string;
  path?: string;
  base?: string;
  baseCommit: string;
  activeFeature: string;
  approvalToken: string;
  approved: true;
}

export interface WorktreeHandoff {
  kind: "worktree_handoff";
  protocol: "empirical-sdd";
  schemaVersion: typeof SCHEMA_VERSION;
  root: string;
  path: string;
  branch: string;
  base: string;
  baseCommit: string;
  feature: string;
  revision: number;
  workflow: Workflow;
  resume: string;
  action: ActionPacket;
}

export type FeatureStartResult = ActionPacket | WorktreeProposal;

export interface DecisionSummary {
  id: string;
  title: string;
  status: "Accepted" | "Superseded";
  chosenApproach: string;
  supersedes: string[];
  supersededBy: string | null;
}

export interface DecisionValidationReport {
  valid: boolean;
  decisions: DecisionSummary[];
  issues: string[];
}

export interface ExplainReport {
  protocol: "empirical-sdd";
  schemaVersion: typeof SCHEMA_VERSION;
  root: string;
  feature: string | null;
  phase: Phase;
  status: WorkflowStatus;
  revision: number;
  rationale: ActionRationale;
  decisions: DecisionSummary[];
}

export interface ExplorationPacket {
  protocol: "empirical-sdd";
  schemaVersion: typeof SCHEMA_VERSION;
  root: string;
  problem: string;
  instructions: string[];
  questions: string[];
  projectContext: string[];
  knowledgeContext: string[];
  capabilityContext: string[];
  next: {
    fast: string;
    complex: string;
  };
}

export type DeltaOperation = "added" | "modified" | "removed";

export interface RequirementDelta {
  operation: DeltaOperation;
  name: string;
  contents: string;
}

export interface CapabilityDelta {
  capability: string;
  purpose: string | null;
  requirements: RequirementDelta[];
  source: string;
}

export interface CapabilitySummary {
  name: string;
  path: string;
  requirements: number;
}

export interface DeltaValidationReport {
  valid: boolean;
  capabilities: string[];
  operations: number;
  issues: string[];
  digest: string | null;
}

export interface ArchiveReport {
  feature: string;
  capabilities: string[];
  added: number;
  modified: number;
  removed: number;
  converged: boolean;
}

export interface ArchiveResult {
  action: ActionPacket;
  report: ArchiveReport;
}

export interface TransitionEvent {
  schemaVersion: typeof SCHEMA_VERSION;
  revision: number;
  previousRevision: number;
  actor: string;
  summary: string;
  createdAt: string;
  state: WorkflowState;
}

export interface IntegrationReport {
  scope: "project" | "global";
  created: string[];
  updated: string[];
  removed: string[];
  preserved: string[];
  entrypoints: AgentEntrypointReport[];
}

export type AgentIntegrationId = "codex" | "claude" | "cursor" | "gemini" | "windsurf";

export interface AgentEntrypointReport {
  id: AgentIntegrationId;
  agent: string;
  kind: "skill" | "slash-command";
  artifactRoot: string;
  invocations: string[];
  reload: string;
}

export type AgentLaunchCapability = "prompt" | "workspace";

export interface DetectedAgent {
  id: AgentIntegrationId;
  agent: string;
  executable: string;
  capability: AgentLaunchCapability;
}

export interface AgentHandoffOption extends DetectedAgent {
  feature: string;
  specification: string;
  cwd: string;
  prompt: string;
  argv: string[];
  approvalToken: string;
}

export interface AgentHandoffOffer {
  kind: "agent_handoff_offer";
  protocol: "empirical-sdd";
  schemaVersion: typeof SCHEMA_VERSION;
  root: string;
  feature: string;
  specification: string;
  choices: ["current", "save", "agent"];
  agents: AgentHandoffOption[];
  requiresApproval: true;
}

export interface AuthorizedAgentHandoff {
  kind: "authorized_agent_handoff";
  protocol: "empirical-sdd";
  schemaVersion: typeof SCHEMA_VERSION;
  root: string;
  feature: string;
  agent: AgentIntegrationId;
  cwd: string;
  argv: string[];
  prompt: string;
}

export interface RepositoryKnowledgeFile {
  path: string;
  size: number;
  digest: string;
}

export interface RepositoryKnowledgeManifest {
  schemaVersion: 1;
  digest: string;
  files: RepositoryKnowledgeFile[];
  truncated: boolean;
}

export interface RepositoryKnowledgeReport {
  root: string;
  status: "created" | "refreshed" | "current";
  digest: string;
  files: number;
  truncated: boolean;
  manifest: string;
  context: string[];
}

export interface InitOptions extends ProjectConfigurationInput {
  profile?: Workflow;
  integrations?: boolean;
}

export interface StartOptions {
  profile?: Workflow;
  id?: string;
}

export interface FeatureStartOptions {
  id?: string;
}

export interface AdoptionOptions extends ProjectConfigurationInput {
  profile?: Workflow;
  integrations?: boolean;
}

export interface ValidationReport {
  valid: boolean;
  phase: Phase;
  criteria: number;
  missing: string[];
}
