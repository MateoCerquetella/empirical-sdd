export { EmpiricalProject, parseCriteria } from "./core.js";
export { EmpiricalError } from "./errors.js";
export {
  installGlobalAgentSkills,
  installedGlobalAgentIds,
  installProjectIntegrations,
  managedGlobalAgentIds,
} from "./integrations.js";
export { SUPPORTED_AGENTS, agentDefinition, buildHandoffOption, detectSupportedAgents } from "./agents.js";
export {
  AGENT_CATALOG_SOURCE,
  AGENT_SKILL_TARGETS,
  agentSkillTarget,
  agentSkillTargetPath,
  detectAgentSkillTargets,
  globalAgentSkillTargets,
  resolveAgentSkillTargetId,
  validateAgentSkillCatalog,
} from "./agent-catalog.js";
export type { AgentSkillTargetDefinition, AgentSkillTargetId, GlobalAgentSkillTarget } from "./agent-catalog.js";
export { KNOWLEDGE_CONTEXT_PATHS, refreshRepositoryKnowledge, repositoryKnowledgePaths } from "./knowledge.js";
export { updateEmpirical } from "./lifecycle.js";
export {
  recommendedSetupSettings,
  renderSetupSummary,
  setupConfigurationInput,
  setupSettingsFromConfig,
  validateSetupSettings,
} from "./setup.js";
export type { SetupSettings } from "./setup.js";
export {
  DISCOVERY_PASS_ORDER,
  buildRefinedRequest,
  createDiscoveryRecord,
  loadDiscovery,
  materialFollowUp,
  nextSocraticPrompt,
  renderDiscoveryMarkdown,
  saveDiscovery,
  socraticQuestions,
  validateSocraticAnswers,
  validateMaterialFollowUps,
} from "./discovery.js";
export type {
  DiscoveryPassId,
  DiscoveryPaths,
  DiscoveryRecord,
  DiscoveryStatus,
  DiscoverySubmission,
  DiscoverySubmissionResult,
  DiscoveryWorkflow,
  SocraticAnswer,
  SocraticPrompt,
  SocraticQuestion,
} from "./discovery.js";
export { ProjectStore, discoverProject } from "./storage.js";
export {
  capabilityDeltaDigest,
  listCapabilities,
  loadCapabilityDeltas,
  parseCapabilityDelta,
  planCapabilityArchive,
  validateFeatureDeltas,
} from "./specifications.js";
export * from "./types.js";
