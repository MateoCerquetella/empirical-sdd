import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { EmpiricalProject } from "./core.js";
import { asErrorMessage } from "./errors.js";
import { PRODUCT_VERSION, type Evidence } from "./types.js";

const profileSchema = z.enum(["fast", "complex"]);
const changeTypeSchema = z.enum(["feature", "fix", "chore"]);
const evidenceSchema = z.object({
  criterionId: z.string().min(1),
  kind: z.enum(["test", "browser", "screenshot", "review", "human"]),
  passed: z.boolean(),
  summary: z.string().min(1),
  artifact: z.string().min(1).optional(),
});
const configurationSchema = {
  isolation: z.enum(["ask", "off"]).optional(),
  base: z.string().min(1).optional(),
  worktreePath: z.string().min(1).optional(),
  branchPattern: z.string().min(1).optional(),
  decisions: z.enum(["required", "off"]).optional(),
};

export function createMcpServer(defaultRoot = mcpDefaultRoot()): McpServer {
  const server = new McpServer(
    { name: "empirical-sdd", version: PRODUCT_VERSION },
    {
      instructions:
        "Automatically use Empirical for repository-changing work. For genuinely vague work, call empirical_explore and conduct the original five Socratic passes in the current conversation, one question at a time; present the refined contract and wait for explicit approval. Choose empirical_fast only for explicit, tiny, localized, reversible, low-risk non-UI work; otherwise choose empirical_complex. One checkout has one active feature. If Fast or Complex returns worktree_proposal, show it, wait for explicit approval, then call empirical_worktree_create with approved true. Execute each exact action and complete its revision until done, blocked, or awaiting human input. Use empirical_explain for a concise evidence-backed decision trail, never private chain-of-thought. The current host agent performs all work; Empirical never launches another runtime.",
    },
  );

  server.registerTool("empirical_explore", {
    title: "Explore a vague problem",
    description: "Return read-only repository context for a five-pass Socratic interview.",
    inputSchema: { root: z.string().optional(), problem: z.string().min(1) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ root, problem }) => toolResult(async () => (await EmpiricalProject.openReadOnly(root ?? defaultRoot)).explore(problem)));

  server.registerTool("empirical_init", {
    title: "Initialize Empirical",
    description: "Initialize feature-local Empirical state with deterministic non-interactive configuration.",
    inputSchema: { root: z.string().optional(), profile: profileSchema.optional(), ...configurationSchema },
    annotations: { destructiveHint: false, idempotentHint: true },
  }, async ({ root, profile, isolation, base, worktreePath, branchPattern, decisions }) => toolResult(async () => {
    const initialized = await EmpiricalProject.initialize(root ?? defaultRoot, {
      ...(profile ? { profile } : {}),
      isolation: {
        ...(isolation ? { mode: isolation } : {}),
        ...(base ? { baseBranch: base } : {}),
        ...(worktreePath ? { worktreePath } : {}),
        ...(branchPattern ? { branchPattern } : {}),
      },
      decisions: { ...(decisions ? { complexRecords: decisions } : {}) },
      setupComplete: true,
    });
    return { state: initialized.state, config: await initialized.project.config(), integrations: initialized.integrations, next: await initialized.project.next() };
  }));

  server.registerTool("empirical_configure", {
    title: "Configure Empirical",
    description: "Persist worktree isolation and Complex decision-record preferences.",
    inputSchema: { root: z.string().optional(), ...configurationSchema },
    annotations: { destructiveHint: false, idempotentHint: true },
  }, async ({ root, isolation, base, worktreePath, branchPattern, decisions }) => toolResult(async () => {
    const project = await EmpiricalProject.open(root ?? defaultRoot);
    return project.configure({
      isolation: {
        ...(isolation ? { mode: isolation } : {}),
        ...(base ? { baseBranch: base } : {}),
        ...(worktreePath ? { worktreePath } : {}),
        ...(branchPattern ? { branchPattern } : {}),
      },
      decisions: { ...(decisions ? { complexRecords: decisions } : {}) },
      setupComplete: true,
    });
  }));

  server.registerTool("empirical_adopt", {
    title: "Adopt Empirical v1",
    description: "Non-destructively adopt an ai/ Empirical v1 workspace.",
    inputSchema: { root: z.string().optional(), profile: profileSchema.optional() },
    annotations: { destructiveHint: false, idempotentHint: true },
  }, async ({ root, profile }) => toolResult(async () => {
    const adopted = await EmpiricalProject.adopt(root ?? defaultRoot, { ...(profile ? { profile } : {}), setupComplete: true });
    return { state: adopted.state, integrations: adopted.integrations, next: await adopted.project.next() };
  }));

  server.registerTool("empirical_fast", {
    title: "Start or resume Fast",
    description: "Start an explicit tiny low-risk non-UI change, or return a worktree proposal for unrelated active work.",
    inputSchema: { root: z.string().optional(), request: z.string().min(1), id: z.string().optional() },
    annotations: { destructiveHint: false, idempotentHint: true },
  }, async ({ root, request, id }) => toolResult(async () => (await EmpiricalProject.open(root ?? defaultRoot)).fast(request, { ...(id ? { id } : {}) })));

  server.registerTool("empirical_complex", {
    title: "Start or resume Complex",
    description: "Start a substantial/UI change, or return a worktree proposal for unrelated active work.",
    inputSchema: { root: z.string().optional(), request: z.string().min(1), id: z.string().optional() },
    annotations: { destructiveHint: false, idempotentHint: true },
  }, async ({ root, request, id }) => toolResult(async () => (await EmpiricalProject.open(root ?? defaultRoot)).complex(request, { ...(id ? { id } : {}) })));

  server.registerTool("empirical_worktree_propose", {
    title: "Preview isolated Git worktree",
    description: "Return the exact base, branch, path, and command without mutating Git or files.",
    inputSchema: {
      root: z.string().optional(), request: z.string().min(1), workflow: profileSchema,
      changeType: changeTypeSchema.optional(), id: z.string().optional(), branch: z.string().optional(), path: z.string().optional(), base: z.string().optional(),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ root, request, workflow, changeType, id, branch, path, base }) => toolResult(async () => {
    const project = await EmpiricalProject.openReadOnly(root ?? defaultRoot);
    return project.proposeWorktree(request, workflow, {
      ...(changeType ? { changeType } : {}), ...(id ? { feature: id } : {}),
      ...(branch ? { branch } : {}), ...(path ? { path } : {}), ...(base ? { base } : {}),
    });
  }));

  server.registerTool("empirical_worktree_create", {
    title: "Create approved Git worktree",
    description: "After explicit human approval, revalidate safety, create the worktree, and start the exact request there.",
    inputSchema: {
      root: z.string().optional(), request: z.string().min(1), workflow: profileSchema,
      changeType: changeTypeSchema.optional(), id: z.string().optional(), branch: z.string().optional(), path: z.string().optional(), base: z.string().optional(),
      baseCommit: z.string().min(1), activeFeature: z.string().min(1), approvalToken: z.string().length(64),
      approved: z.literal(true),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  }, async ({ root, request, workflow, changeType, id, branch, path, base, baseCommit, activeFeature, approvalToken, approved }) => toolResult(async () => {
    const project = await EmpiricalProject.open(root ?? defaultRoot);
    return project.createWorktree({
      request, workflow, approved,
      ...(changeType ? { changeType } : {}), ...(id ? { feature: id } : {}),
      ...(branch ? { branch } : {}), ...(path ? { path } : {}), ...(base ? { base } : {}),
      baseCommit, activeFeature, approvalToken,
    });
  }));

  server.registerTool("empirical_loop", {
    title: "Resume active workflow",
    description: "Return the exact current action; takes no request or profile.",
    inputSchema: { root: z.string().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ root }) => toolResult(async () => (await EmpiricalProject.openReadOnly(root ?? defaultRoot)).loop()));

  server.registerTool("empirical_next", {
    title: "Read current action",
    description: "Read the current workflow action without changing state.",
    inputSchema: { root: z.string().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ root }) => toolResult(async () => (await EmpiricalProject.openReadOnly(root ?? defaultRoot)).next()));

  server.registerTool("empirical_explain", {
    title: "Explain current Empirical state",
    description: "Show deterministic state rationale, context gaps, gate, and accepted decision summaries without private reasoning.",
    inputSchema: { root: z.string().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ root }) => toolResult(async () => (await EmpiricalProject.openReadOnly(root ?? defaultRoot)).explain()));

  server.registerTool("empirical_complete", {
    title: "Complete current action",
    description: "Complete the exact current revision with outcome, summary, and required evidence.",
    inputSchema: {
      root: z.string().optional(), revision: z.number().int().nonnegative(),
      outcome: z.enum(["passed", "failed", "awaiting_human", "blocked"]),
      summary: z.string().min(1), actor: z.string().optional(), evidence: z.array(evidenceSchema).optional(),
    },
    annotations: { destructiveHint: false, idempotentHint: false },
  }, async ({ root, revision, outcome, summary, actor, evidence }) => toolResult(async () => {
    const project = await EmpiricalProject.open(root ?? defaultRoot);
    return project.complete({ revision, outcome, summary, ...(actor ? { actor } : {}), ...(evidence ? { evidence: evidence as Evidence[] } : {}) });
  }));

  server.registerTool("empirical_archive", {
    title: "Archive reviewed capability deltas",
    description: "Apply approved capability deltas and finish the exact archive revision.",
    inputSchema: { root: z.string().optional(), revision: z.number().int().nonnegative(), actor: z.string().optional() },
    annotations: { destructiveHint: false, idempotentHint: true },
  }, async ({ root, revision, actor }) => toolResult(async () => (await EmpiricalProject.open(root ?? defaultRoot)).archive(revision, actor)));

  server.registerTool("empirical_status", {
    title: "Read workflow status",
    description: "Read current feature-local workflow state.",
    inputSchema: { root: z.string().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ root }) => toolResult(async () => (await EmpiricalProject.openReadOnly(root ?? defaultRoot)).status()));

  server.registerTool("empirical_verify", {
    title: "Validate evidence",
    description: "Validate current specification and evidence without advancing state.",
    inputSchema: { root: z.string().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ root }) => toolResult(async () => (await EmpiricalProject.openReadOnly(root ?? defaultRoot)).verify()));

  server.registerTool("empirical_retry", {
    title: "Resume a paused workflow",
    description: "Resume a blocked or awaiting-human feature at its exact revision.",
    inputSchema: { root: z.string().optional(), revision: z.number().int().nonnegative(), actor: z.string().optional() },
    annotations: { destructiveHint: false, idempotentHint: false },
  }, async ({ root, revision, actor }) => toolResult(async () => (await EmpiricalProject.open(root ?? defaultRoot)).retry(revision, actor)));

  server.registerTool("empirical_doctor", {
    title: "Inspect project health",
    description: "Read configuration, active feature, policy, capabilities, and runtime metadata.",
    inputSchema: { root: z.string().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ root }) => toolResult(async () => (await EmpiricalProject.openReadOnly(root ?? defaultRoot)).doctor()));

  server.registerTool("empirical_migrate", {
    title: "Migrate Empirical schema",
    description: "Migrate legacy default root state into feature-local schema 4; alternate parallel state remains unsupported.",
    inputSchema: { root: z.string().optional() },
    annotations: { destructiveHint: false, idempotentHint: true },
  }, async ({ root }) => toolResult(async () => (await EmpiricalProject.open(root ?? defaultRoot, { migrate: false })).migrate()));

  server.registerTool("empirical_capabilities", {
    title: "Read living capability specifications",
    description: "List capability specs or read one current behavior contract.",
    inputSchema: { root: z.string().optional(), name: z.string().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ root, name }) => toolResult(async () => {
    const project = await EmpiricalProject.openReadOnly(root ?? defaultRoot);
    return name ? { name, contents: await project.capability(name) } : project.capabilities();
  }));

  server.registerTool("empirical_policy", {
    title: "Read project policy",
    description: "Read committed project context and additive phase guidance.",
    inputSchema: { root: z.string().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ root }) => toolResult(async () => (await EmpiricalProject.openReadOnly(root ?? defaultRoot)).policy()));

  server.registerTool("empirical_integrate", {
    title: "Refresh project agent discovery",
    description: "Refresh project instructions, skills, commands, and MCP configuration.",
    inputSchema: { root: z.string().optional() },
    annotations: { destructiveHint: false, idempotentHint: true },
  }, async ({ root }) => toolResult(async () => (await EmpiricalProject.open(root ?? defaultRoot)).integrations()));

  return server;
}

export async function runMcpServer(defaultRoot?: string): Promise<void> {
  const server = createMcpServer(defaultRoot);
  await server.connect(new StdioServerTransport());
}

function mcpDefaultRoot(): string {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

async function toolResult(operation: () => Promise<unknown>) {
  try {
    const value = await operation();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
      structuredContent: isRecord(value) ? value : { value },
    };
  } catch (error) {
    return { isError: true, content: [{ type: "text" as const, text: asErrorMessage(error) }] };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
