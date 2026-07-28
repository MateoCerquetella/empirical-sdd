import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { EmpiricalProject } from "./core.js";
import { asErrorMessage } from "./errors.js";
import { PRODUCT_VERSION, type Evidence } from "./types.js";

const profileSchema = z.enum(["quick", "strong"]);
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
        "Use Empirical to manage feature workflow state. Call empirical_status first. "
        + "If no feature is active, call empirical_start with the user's request. Then call "
        + "empirical_next, perform exactly that phase, and call empirical_complete at the "
        + "returned revision. Continue until done, blocked, or awaiting human input.",
    },
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
    "empirical_start",
    {
      title: "Start a feature",
      description: "Start a Quick or Strong feature from the user's plain-language request.",
      inputSchema: {
        root: z.string().optional(),
        request: z.string().min(1),
        profile: profileSchema.optional(),
        id: z.string().optional(),
      },
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async ({ root, request, profile, id }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot);
      return project.start(request, {
        ...(profile ? { profile } : {}),
        ...(id ? { id } : {}),
      });
    }),
  );

  server.registerTool(
    "empirical_status",
    {
      title: "Read workflow status",
      description: "Read the current feature, phase, revision, and stop condition without mutation.",
      inputSchema: { root: z.string().optional() },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ root }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot);
      return project.status();
    }),
  );

  server.registerTool(
    "empirical_next",
    {
      title: "Get the next action",
      description: "Return complete instructions, criteria, evidence requirements, and revision for the next phase.",
      inputSchema: { root: z.string().optional() },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ root }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot);
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
        revision: z.number().int().nonnegative(),
        outcome: z.enum(["passed", "failed", "awaiting_human", "blocked"]),
        summary: z.string().min(1),
        actor: z.string().min(1).optional(),
        evidence: z.array(evidenceSchema).optional(),
      },
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async ({ root, revision, outcome, summary, actor, evidence }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot);
      return project.complete({
        revision,
        outcome,
        summary,
        ...(actor ? { actor } : {}),
        ...(evidence ? { evidence: evidence as Evidence[] } : {}),
      });
    }),
  );

  server.registerTool(
    "empirical_verify",
    {
      title: "Validate completion evidence",
      description: "Check acceptance-criterion, UI, screenshot, and review evidence without mutation.",
      inputSchema: { root: z.string().optional() },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ root }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot);
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
        revision: z.number().int().nonnegative(),
        actor: z.string().min(1).optional(),
      },
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async ({ root, revision, actor }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot);
      return project.retry(revision, actor);
    }),
  );

  server.registerTool(
    "empirical_integrate",
    {
      title: "Refresh agent discovery",
      description: "Safely refresh project instructions and MCP configuration for supported agents.",
      inputSchema: { root: z.string().optional() },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async ({ root }) => toolResult(async () => {
      const project = await EmpiricalProject.open(root ?? defaultRoot);
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
