import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { EmpiricalProject } from "./core.js";
import { asErrorMessage } from "./errors.js";
import { PRODUCT_VERSION, type Evidence } from "./types.js";

const profileSchema = z.enum(["fast", "complex"]);
const evidenceSchema = z.object({
  criterionId: z.string().min(1),
  kind: z.enum(["test", "browser", "screenshot", "review", "human"]),
  passed: z.boolean(),
  summary: z.string().min(1),
  artifact: z.string().min(1).optional(),
});

export function createMcpServer(defaultRoot = mcpDefaultRoot()): McpServer {
  const server = new McpServer(
    { name: "empirical-sdd", version: PRODUCT_VERSION },
    {
      instructions:
        "Automatically use Empirical for repository-changing work. For new work choose "
        + "empirical_explore first only when the problem is genuinely vague and needs investigation. After Explore, conduct the original five Socratic passes in the current conversation—problem/user, observable outcome, boundaries/non-goals, failure/risk, and verification—one question at a time. Add only material follow-ups, present the refined contract, and wait for explicit human approval before choosing a workflow. Choose "
        + "empirical_fast only when the request is explicit, tiny, localized, reversible, "
        + "low-risk, and non-UI; otherwise choose empirical_complex. Use empirical_loop only "
        + "to resume work that is already active. Preserve the explicit workstream in every action. "
        + "Perform the returned action and call empirical_complete or empirical_archive at its exact revision. Each response is the next "
        + "action; consume it directly until done, blocked, or awaiting human input. The "
        + "current host agent executes the work; Empirical never launches an AI runtime.",
    },
  );

  server.registerTool(
    "empirical_explore",
    {
      title: "Explore a vague problem",
      description: "Return read-only context for the current agent to conduct a five-pass Socratic interview before choosing Fast or Complex. Never creates workflow state or launches another AI.",
      inputSchema: {
        root: z.string().optional(),
        workstream: z.string().optional(),
        problem: z.string().min(1),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ root, workstream, problem }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot, workstream);
      return project.explore(problem);
    }),
  );

  server.registerTool(
    "empirical_init",
    {
      title: "Initialize Empirical",
      description: "Initialize Empirical and agent discovery in a repository.",
      inputSchema: {
        root: z.string().optional(),
        profile: profileSchema.optional(),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async ({ root, profile }) => toolResult(async () => {
      const initialized = await EmpiricalProject.initialize(root ?? defaultRoot, {
        ...(profile ? { profile } : {}),
      });
      return {
        state: initialized.state,
        integrations: initialized.integrations,
        next: await initialized.project.next(),
      };
    }),
  );

  server.registerTool(
    "empirical_adopt",
    {
      title: "Adopt Empirical v1",
      description: "Non-destructively adopt an existing ai/ Empirical v1 workspace.",
      inputSchema: {
        root: z.string().optional(),
        profile: profileSchema.optional(),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async ({ root, profile }) => toolResult(async () => {
      const adopted = await EmpiricalProject.adopt(root ?? defaultRoot, {
        ...(profile ? { profile } : {}),
      });
      return {
        state: adopted.state,
        integrations: adopted.integrations,
        next: await adopted.project.next(),
      };
    }),
  );

  server.registerTool(
    "empirical_fast",
    {
      title: "Start Fast SDD",
      description: "Start or idempotently resume one explicit, tiny, localized, reversible, low-risk non-UI change.",
      inputSchema: {
        root: z.string().optional(),
        workstream: z.string().optional(),
        request: z.string().min(1),
        id: z.string().optional(),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async ({ root, workstream, request, id }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot, workstream);
      return project.fast(request, { ...(id ? { id } : {}) });
    }),
  );

  server.registerTool(
    "empirical_complex",
    {
      title: "Start Complex SDD",
      description: "Start or idempotently resume the full high-assurance SDD workflow. Use whenever Fast eligibility is uncertain.",
      inputSchema: {
        root: z.string().optional(),
        workstream: z.string().optional(),
        request: z.string().min(1),
        id: z.string().optional(),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async ({ root, workstream, request, id }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot, workstream);
      return project.complex(request, { ...(id ? { id } : {}) });
    }),
  );

  server.registerTool(
    "empirical_start",
    {
      title: "Legacy profile-based start",
      description: "Compatibility entrypoint for older profile-based clients. New agents use empirical_fast or empirical_complex.",
      inputSchema: {
        root: z.string().optional(),
        workstream: z.string().optional(),
        request: z.string().min(1),
        profile: profileSchema.optional(),
        id: z.string().optional(),
      },
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async ({ root, workstream, request, profile, id }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot, workstream);
      return project.start(request, {
        ...(profile ? { profile } : {}),
        ...(id ? { id } : {}),
      });
    }),
  );

  server.registerTool(
    "empirical_loop",
    {
      title: "Resume the agent loop",
      description:
        "Return the current resumable action without starting work or choosing an SDD workflow.",
      inputSchema: { root: z.string().optional(), workstream: z.string().optional() },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ root, workstream }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot, workstream);
      return project.loop();
    }),
  );

  server.registerTool(
    "empirical_status",
    {
      title: "Read workflow status",
      description: "Read the current feature, phase, revision, and stop condition without mutation.",
      inputSchema: { root: z.string().optional(), workstream: z.string().optional() },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ root, workstream }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot, workstream);
      return project.status();
    }),
  );

  server.registerTool(
    "empirical_next",
    {
      title: "Get the next action",
      description: "Return complete instructions, criteria, evidence requirements, and revision for the next phase.",
      inputSchema: { root: z.string().optional(), workstream: z.string().optional() },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ root, workstream }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot, workstream);
      return project.next();
    }),
  );

  server.registerTool(
    "empirical_complete",
    {
      title: "Complete a phase",
      description: "Submit a typed result for the current phase at the exact observed revision.",
      inputSchema: {
        root: z.string().optional(),
        workstream: z.string().optional(),
        revision: z.number().int().nonnegative(),
        outcome: z.enum(["passed", "failed", "awaiting_human", "blocked"]),
        summary: z.string().min(1),
        actor: z.string().min(1).optional(),
        evidence: z.array(evidenceSchema).optional(),
      },
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async ({ root, workstream, revision, outcome, summary, actor, evidence }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot, workstream);
      return project.complete({
        revision,
        outcome,
        summary,
        ...(workstream ? { workstream } : {}),
        ...(actor ? { actor } : {}),
        ...(evidence ? { evidence: evidence as Evidence[] } : {}),
      });
    }),
  );

  server.registerTool(
    "empirical_archive",
    {
      title: "Archive reviewed capability changes",
      description: "Apply validated capability deltas and complete the exact reviewed Complex revision.",
      inputSchema: {
        root: z.string().optional(),
        workstream: z.string().optional(),
        revision: z.number().int().nonnegative(),
        actor: z.string().min(1).optional(),
      },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ root, workstream, revision, actor }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot, workstream);
      return project.archive(revision, actor);
    }),
  );

  server.registerTool(
    "empirical_verify",
    {
      title: "Validate completion evidence",
      description: "Check acceptance-criterion, UI, screenshot, and review evidence without mutation.",
      inputSchema: { root: z.string().optional(), workstream: z.string().optional() },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ root, workstream }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot, workstream);
      return project.verify();
    }),
  );

  server.registerTool(
    "empirical_retry",
    {
      title: "Resume a paused workflow",
      description: "Resume after a blocker or required human decision is resolved.",
      inputSchema: {
        root: z.string().optional(),
        workstream: z.string().optional(),
        revision: z.number().int().nonnegative(),
        actor: z.string().min(1).optional(),
      },
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async ({ root, workstream, revision, actor }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot, workstream);
      return project.retry(revision, actor);
    }),
  );

  server.registerTool(
    "empirical_workstreams",
    {
      title: "Manage workstreams",
      description: "List, create, or select independently revisioned workstreams.",
      inputSchema: {
        root: z.string().optional(),
        operation: z.enum(["list", "create", "select"]).default("list"),
        name: z.string().optional(),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async ({ root, operation, name }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot);
      if (operation === "list") return project.workstreams();
      if (!name) throw new Error(`${operation} requires a workstream name`);
      return operation === "create" ? project.createWorkstream(name) : project.selectWorkstream(name);
    }),
  );

  server.registerTool(
    "empirical_capabilities",
    {
      title: "Read living capability specifications",
      description: "List capability specs or read one current behavior contract.",
      inputSchema: { root: z.string().optional(), name: z.string().optional() },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ root, name }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot);
      return name ? { name, contents: await project.capability(name) } : project.capabilities();
    }),
  );

  server.registerTool(
    "empirical_policy",
    {
      title: "Read project policy",
      description: "Read committed project context and additive phase guidance.",
      inputSchema: { root: z.string().optional() },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ root }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot);
      return project.policy();
    }),
  );

  server.registerTool(
    "empirical_integrate",
    {
      title: "Refresh agent discovery",
      description: "Safely refresh project instructions and MCP configuration for supported agents.",
      inputSchema: { root: z.string().optional(), workstream: z.string().optional() },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async ({ root, workstream }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot, workstream);
      return project.integrations();
    }),
  );

  return server;
}

export async function runMcpServer(defaultRoot?: string): Promise<void> {
  const server = createMcpServer(defaultRoot);
  const transport = new StdioServerTransport();
  await server.connect(transport);
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
    return {
      isError: true,
      content: [{ type: "text" as const, text: asErrorMessage(error) }],
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
