export const SCHEMA_VERSION = 2 as const;
export const PRODUCT_VERSION = "2.1.0";

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
  evidence: Evidence[];
  updatedAt: string;
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

export interface ActionPacket {
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
  acceptanceCriteria: Criterion[];
  requiredEvidence: EvidenceKind[];
  artifacts: string[];
  completion: {
    available: boolean;
    mcpTool: "empirical_complete";
    cli: string;
    requiredFields: string[];
  };
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
