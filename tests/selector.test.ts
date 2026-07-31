import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import {
  createSelectorState,
  filterAgentSelectorItems,
  reduceSelector,
  renderAgentSelector,
  selectAgentsInteractive,
  selectorViewport,
  type AgentSelectorItem,
} from "../src/selector.js";

const items: AgentSelectorItem[] = [
  { id: "codex", label: "Codex", aliases: [], destination: ".codex/skills", detected: true, managed: true },
  { id: "claude-code", label: "Claude Code", aliases: ["claude"], destination: ".claude/skills", detected: false, managed: false, remembered: true },
  { id: "cursor", label: "Cursor", aliases: [], destination: ".cursor/skills", detected: false, managed: false },
  { id: "codebuddy", label: "CodeBuddy", aliases: [], destination: ".codebuddy/skills", detected: false, managed: false },
  { id: "command-code", label: "Command Code", aliases: [], destination: ".commandcode/skills", detected: false, managed: false },
  { id: "continue", label: "Continue", aliases: [], destination: ".continue/skills", detected: false, managed: false },
  { id: "crush", label: "Crush", aliases: [], destination: ".config/crush/skills", detected: false, managed: false },
  { id: "droid", label: "Droid", aliases: [], destination: ".factory/skills", detected: false, managed: false },
  { id: "opencode", label: "OpenCode", aliases: [], destination: ".config/opencode/skills", detected: false, managed: false },
  { id: "windsurf", label: "Windsurf", aliases: [], destination: ".codeium/windsurf/skills", detected: false, managed: false },
];

describe("agent installer selector", () => {
  test("preselects detected and remembered agents and renders status and paths", () => {
    const state = createSelectorState(items, ["codex", "claude-code"]);
    expect([...state.selected]).toEqual(["codex", "claude-code"]);
    const frame = renderAgentSelector(items, state, 120);
    expect(frame).toContain("Codex   detected · installed   ~/.codex/skills");
    expect(frame).toContain("Claude Code   remembered   ~/.claude/skills");
    expect(frame).toContain("Selected (2): Codex, Claude Code");
  });

  test("supports movement, filtering by name, id, alias, and destination, and toggling", () => {
    let state = createSelectorState(items, []);
    state = reduceSelector(state, "down", items);
    state = reduceSelector(state, "toggle", items);
    expect(state.cursor).toBe(1);
    expect([...state.selected]).toEqual(["claude-code"]);

    state = reduceSelector(state, { type: "input", value: "open" }, items);
    expect(filterAgentSelectorItems(items, state.query).map((item) => item.id)).toEqual(["opencode"]);
    state = reduceSelector(state, "toggle", items);
    expect([...state.selected]).toEqual(["claude-code", "opencode"]);
    expect(filterAgentSelectorItems(items, "claude").map((item) => item.id)).toEqual(["claude-code"]);
    expect(filterAgentSelectorItems(items, "command-code").map((item) => item.id)).toEqual(["command-code"]);
    expect(filterAgentSelectorItems(items, "factory").map((item) => item.id)).toEqual(["droid"]);
    state = reduceSelector(state, "backspace", items);
    expect(state.query).toBe("ope");
  });

  test("bounds the viewport, reports hidden rows, and keeps every frame width-safe", () => {
    let state = createSelectorState(items, []);
    for (let index = 0; index < 7; index += 1) state = reduceSelector(state, "down", items);
    const viewport = selectorViewport(items, state, 4);
    expect(viewport.items).toHaveLength(4);
    expect(viewport.hiddenAbove).toBeGreaterThan(0);
    expect(viewport.hiddenBelow).toBeGreaterThanOrEqual(0);
    for (const columns of [40, 80, 120]) {
      const frame = renderAgentSelector(items, state, { columns, visibleRows: 4 });
      expect(frame).toContain("above");
      expect(frame.split("\n").every((line) => [...line].length <= columns)).toBe(true);
      expect(frame.split("\n").filter((line) => / [●○] /.test(line))).toHaveLength(4);
    }
  });

  test("refuses empty submission and preserves an explicit empty default", () => {
    const initial = createSelectorState(items, []);
    expect(initial.selected.size).toBe(0);
    const state = reduceSelector(initial, "submit", items);
    expect(state.error).toBe("Select at least one agent before continuing.");
  });

  test("restores raw mode and cursor visibility when rendering fails", async () => {
    const input = new EventEmitter() as EventEmitter & {
      isTTY: boolean;
      isRaw: boolean;
      rawModes: boolean[];
      paused: boolean;
      setRawMode(value: boolean): void;
      resume(): void;
      pause(): void;
    };
    input.isTTY = true;
    input.isRaw = false;
    input.rawModes = [];
    input.paused = false;
    input.setRawMode = (value) => { input.rawModes.push(value); input.isRaw = value; };
    input.resume = () => {};
    input.pause = () => { input.paused = true; };

    const writes: string[] = [];
    const output = new EventEmitter() as EventEmitter & {
      isTTY: boolean;
      columns: number;
      write(value: string): boolean;
    };
    output.isTTY = true;
    output.columns = 80;
    output.write = (value) => {
      writes.push(value);
      if (value.includes("◆ Empirical install")) throw new Error("draw failed");
      return true;
    };

    await expect(selectAgentsInteractive(items, [], input as never, output as never))
      .rejects.toThrow("draw failed");
    expect(input.rawModes).toEqual([true, false]);
    expect(input.paused).toBe(true);
    expect(writes.at(-1)).toBe("\x1b[?25h\n");
  });
});
