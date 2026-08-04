import { spawn } from "node:child_process";
import { once } from "node:events";
import { realpath } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { resolveRepositoryPath } from "./policy.js";
import { sha256 } from "./protocol.js";

const DEFAULT_ALLOWED_ENVIRONMENT = [
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "TMPDIR",
  "TMP",
  "TEMP",
  "CI",
  "NO_COLOR",
] as const;

const SECRET_KEY = /(token|secret|password|passwd|credential|api[-_]?key|private[-_]?key|cookie|authorization)/i;
const SECRET_VALUE = /(?:gh[opsu]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+|npm_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._~+/-]+=*)/gi;

export interface RuntimeCommand {
  argv: string[];
  cwd: string;
  timeoutMs: number;
  maxOutputBytes: number;
  environment?: Record<string, string>;
}

export interface RuntimeResult {
  argv: string[];
  cwd: string;
  timeoutMs: number;
  maxOutputBytes: number;
  environmentKeys: string[];
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  stdoutDigest: string;
  stderrDigest: string;
  stdoutTail: string;
  stderrTail: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  startedAt: string;
  completedAt: string;
}

export interface CapturedRuntimeResult {
  result: RuntimeResult;
  stdout: string;
  stderr: string;
}

export interface ProcessInvocation {
  executable: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  maxOutputBytes: number;
}

export interface ProcessOutcome {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  stdout: Uint8Array;
  stderr: Uint8Array;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
}

export type ProcessAdapter = (invocation: ProcessInvocation) => Promise<ProcessOutcome>;

function boundedAppend(
  chunks: Buffer[],
  incoming: Buffer,
  currentBytes: number,
  maxBytes: number,
): { bytes: number; truncated: boolean } {
  if (currentBytes >= maxBytes) {
    return { bytes: currentBytes, truncated: incoming.length > 0 };
  }
  const remaining = maxBytes - currentBytes;
  const accepted = incoming.subarray(0, remaining);
  if (accepted.length > 0) {
    chunks.push(accepted);
  }
  return {
    bytes: currentBytes + accepted.length,
    truncated: accepted.length < incoming.length,
  };
}

export const nodeProcessAdapter: ProcessAdapter = async (invocation) => {
  const child = spawn(invocation.executable, invocation.args, {
    cwd: invocation.cwd,
    env: invocation.env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let stdoutTruncated = false;
  let stderrTruncated = false;
  child.stdout.on("data", (value: Buffer | string) => {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    const result = boundedAppend(
      stdout,
      chunk,
      stdoutBytes,
      invocation.maxOutputBytes,
    );
    stdoutBytes = result.bytes;
    stdoutTruncated ||= result.truncated;
  });
  child.stderr.on("data", (value: Buffer | string) => {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    const result = boundedAppend(
      stderr,
      chunk,
      stderrBytes,
      invocation.maxOutputBytes,
    );
    stderrBytes = result.bytes;
    stderrTruncated ||= result.truncated;
  });

  let timedOut = false;
  let forceKill: ReturnType<typeof setTimeout> | undefined;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
    forceKill = setTimeout(() => child.kill("SIGKILL"), 1_000);
    forceKill.unref();
  }, invocation.timeoutMs);
  timeout.unref();

  const [exitCode, signal] = (await once(child, "close")) as [
    number | null,
    NodeJS.Signals | null,
  ];
  clearTimeout(timeout);
  if (forceKill) clearTimeout(forceKill);
  return {
    exitCode,
    signal,
    timedOut,
    stdout: Buffer.concat(stdout),
    stderr: Buffer.concat(stderr),
    stdoutTruncated,
    stderrTruncated,
  };
};

export function redactOutput(value: string): string {
  return value.replaceAll(SECRET_VALUE, "[REDACTED]");
}

function safeEnvironment(
  additions: Record<string, string> | undefined,
): { env: NodeJS.ProcessEnv; keys: string[] } {
  const env: NodeJS.ProcessEnv = {};
  for (const key of DEFAULT_ALLOWED_ENVIRONMENT) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }
  for (const [key, value] of Object.entries(additions ?? {})) {
    if (SECRET_KEY.test(key)) {
      throw new Error(`Runtime environment key is secret-like and cannot be recorded: ${key}`);
    }
    if (value.includes("\0")) {
      throw new Error(`Runtime environment value contains a null byte: ${key}`);
    }
    env[key] = value;
  }
  return { env, keys: Object.keys(env).sort() };
}

export async function executeCommand(
  root: string,
  command: RuntimeCommand,
  adapter: ProcessAdapter = nodeProcessAdapter,
  now: () => Date = () => new Date(),
): Promise<RuntimeResult> {
  return (await executeCommandCaptured(root, command, adapter, now)).result;
}

export async function executeCommandCaptured(
  root: string,
  command: RuntimeCommand,
  adapter: ProcessAdapter = nodeProcessAdapter,
  now: () => Date = () => new Date(),
): Promise<CapturedRuntimeResult> {
  if (command.argv.length === 0 || command.argv.some((arg) => !arg || arg.includes("\0"))) {
    throw new Error("Runtime command requires non-empty null-free argv.");
  }
  if (!Number.isInteger(command.timeoutMs) || command.timeoutMs <= 0 || command.timeoutMs > 900_000) {
    throw new Error("Runtime timeout must be between 1 and 900000 milliseconds.");
  }
  if (!Number.isInteger(command.maxOutputBytes) || command.maxOutputBytes <= 0 || command.maxOutputBytes > 4_194_304) {
    throw new Error("Runtime output bound must be between 1 and 4194304 bytes.");
  }
  const cwd = resolveRepositoryPath(root, command.cwd);
  const canonicalRoot = await realpath(resolve(root));
  const { env, keys } = safeEnvironment(command.environment);
  const startedAt = now().toISOString();
  const [executable, ...args] = command.argv;
  if (!executable) {
    throw new Error("Runtime command has no executable.");
  }
  const outcome = await adapter({
    executable,
    args,
    cwd,
    env,
    timeoutMs: command.timeoutMs,
    maxOutputBytes: command.maxOutputBytes,
  });
  const completedAt = now().toISOString();
  const stdout = Buffer.from(outcome.stdout);
  const stderr = Buffer.from(outcome.stderr);
  const redactedStdout = redactOutput(stdout.toString("utf8"));
  const redactedStderr = redactOutput(stderr.toString("utf8"));
  const stdoutTail = redactedStdout.slice(-8192);
  const stderrTail = redactedStderr.slice(-8192);
  const result: RuntimeResult = {
    argv: [...command.argv],
    cwd: relative(canonicalRoot, cwd) || ".",
    timeoutMs: command.timeoutMs,
    maxOutputBytes: command.maxOutputBytes,
    environmentKeys: keys.filter((key) => !SECRET_KEY.test(key)),
    exitCode: outcome.exitCode,
    signal: outcome.signal,
    timedOut: outcome.timedOut,
    stdoutDigest: sha256(redactedStdout),
    stderrDigest: sha256(redactedStderr),
    stdoutTail,
    stderrTail,
    stdoutTruncated: outcome.stdoutTruncated,
    stderrTruncated: outcome.stderrTruncated,
    startedAt,
    completedAt,
  };
  return {
    result,
    stdout: redactedStdout,
    stderr: redactedStderr,
  };
}
