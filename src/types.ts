export const SCHEMA_VERSION = 3 as const;
export const PRODUCT_VERSION = "2.3.0";
export const WORKSTREAM_SCHEMA_VERSION = 1 as const;
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
  legacySource: "ai" | null;
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

export interface WorkstreamEntry {
  createdAt: string;
}

export interface WorkstreamManifest {
  schemaVersion: typeof WORKSTREAM_SCHEMA_VERSION;
  selected: string;
  workstreams: Record<string, WorkstreamEntry>;
}

export interface WorkstreamSummary {
  id: string;
  selected: boolean;
  activeFeature: string | null;
  request: string | null;
  profile: Profile;
  phase: Phase;
  status: WorkflowStatus;
  revision: number;
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
  workstream?: string;
  actor?: string;
  evidence?: Evidence[];
}

export interface ActionPacket {
  protocol: "empirical-sdd";
  schemaVersion: typeof SCHEMA_VERSION;
  root: string;
  workstream: string;
  feature: string | null;
  request: string | null;
  profile: Profile;
  phase: Phase;
  status: WorkflowStatus;
  revision: number;
  instructions: string;
  acceptanceCriteria: Criterion[];
  requiredEvidence: EvidenceKind[];
  artifacts: string[];
  projectContext: string[];
  capabilityContext: string[];
  completion: {
    available: boolean;
    mcpTool: "empirical_complete" | "empirical_archive";
    cli: string;
    requiredFields: string[];
  };
}

export interface ExplorationPacket {
  protocol: "empirical-sdd";
  schemaVersion: typeof SCHEMA_VERSION;
  root: string;
  problem: string;
  instructions: string[];
  questions: string[];
  projectContext: string[];
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
  workstream: string;
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
  created: string[];
  updated: string[];
  preserved: string[];
}

export interface InitOptions {
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

export interface AdoptionOptions {
  profile?: Workflow;
  integrations?: boolean;
}

export interface ValidationReport {
  valid: boolean;
  phase: Phase;
  criteria: number;
  missing: string[];
}
