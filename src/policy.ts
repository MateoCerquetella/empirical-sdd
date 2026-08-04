import { realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

import {
  POLICY_SCHEMA_VERSION,
  digestJson,
  projectPolicySchema,
  type ProjectPolicy,
} from "./protocol.js";

export function defaultPolicy(): ProjectPolicy {
  return projectPolicySchema.parse({
    schemaVersion: POLICY_SCHEMA_VERSION,
    context: [],
    phases: {},
    verification: {
      evidence: {
        required: true,
        browserForUi: true,
        screenshotForUi: true,
        codeReview: true,
      },
      commands: [],
    },
    delivery: null,
    preferredAgent: null,
  });
}

export function resolveRepositoryPath(root: string, configured: string): string {
  if (configured.includes("\0")) {
    throw new Error("Policy path contains a null byte.");
  }
  const lexicalRoot = resolve(root);
  const absolute = resolve(lexicalRoot, configured);
  const lexicalRelative = relative(lexicalRoot, absolute);
  if (lexicalRelative === ".." || lexicalRelative.startsWith(`..${sep}`) || isAbsolute(lexicalRelative)) {
    throw new Error(`Policy path escapes the repository: ${configured}`);
  }
  let canonicalRoot: string;
  let canonicalPath: string;
  try {
    canonicalRoot = realpathSync.native(lexicalRoot);
    canonicalPath = realpathSync.native(absolute);
  } catch (error) {
    throw new Error(`Policy path cannot be resolved inside the repository: ${configured}`, {
      cause: error,
    });
  }
  const canonicalRelative = relative(canonicalRoot, canonicalPath);
  if (canonicalRelative === ".." || canonicalRelative.startsWith(`..${sep}`) || isAbsolute(canonicalRelative)) {
    throw new Error(`Policy path resolves outside the repository: ${configured}`);
  }
  return canonicalPath;
}

function validateArgv(argv: readonly string[], commandId: string): void {
  const executable = argv[0];
  if (!executable) {
    throw new Error(`Verification command ${commandId} has no executable.`);
  }
  const shellTokens = new Set(["|", "||", "&&", ";", ">", ">>", "<", "2>", "&"]);
  if (argv.some((arg) => shellTokens.has(arg) || arg.includes("\0"))) {
    throw new Error(`Verification command ${commandId} contains shell syntax.`);
  }
  if (["sh", "bash", "zsh", "cmd", "cmd.exe", "powershell", "pwsh"].includes(executable.toLowerCase())) {
    throw new Error(`Verification command ${commandId} may not invoke a shell.`);
  }
}

export function parsePolicy(value: unknown, root: string): ProjectPolicy {
  const policy = projectPolicySchema.parse(value);
  const ids = new Set<string>();
  for (const command of policy.verification.commands) {
    if (ids.has(command.id)) {
      throw new Error(`Duplicate verification command id: ${command.id}`);
    }
    ids.add(command.id);
    validateArgv(command.argv, command.id);
    resolveRepositoryPath(root, command.cwd);
  }
  return {
    ...policy,
    verification: {
      ...policy.verification,
      commands: policy.verification.commands.map((command) => ({
        ...command,
        evidenceKinds: [...new Set(command.evidenceKinds)].sort(),
        criteria: [...new Set(command.criteria)].sort(),
      })),
    },
  };
}

export interface EffectivePolicy {
  policy: ProjectPolicy;
  digest: string;
}

export function effectivePolicy(value: unknown, root: string): EffectivePolicy {
  const policy = parsePolicy(value, root);
  return { policy, digest: digestJson(policy) };
}

export function migratePolicyV1(value: unknown): ProjectPolicy {
  const legacy = value as {
    schemaVersion?: unknown;
    context?: unknown;
    phases?: unknown;
  };
  if (legacy === null || typeof legacy !== "object" || legacy.schemaVersion !== 1) {
    throw new Error("Policy migration requires a valid Schema-1 policy.");
  }
  return projectPolicySchema.parse({
    schemaVersion: POLICY_SCHEMA_VERSION,
    context: Array.isArray(legacy.context) ? legacy.context : [],
    phases:
      legacy.phases !== null && typeof legacy.phases === "object"
        ? legacy.phases
        : {},
    verification: {
      evidence: {
        required: true,
        browserForUi: true,
        screenshotForUi: true,
        codeReview: true,
      },
      commands: [],
    },
    delivery: null,
    preferredAgent: null,
  });
}
