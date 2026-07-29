import { describe, expect, test } from "bun:test";
import {
  createSelectorState,
  reduceSelector,
  renderAgentSelector,
  type AgentSelectorItem,
} from "../src/selector.js";

const items: AgentSelectorItem[] = [
  { id: "codex", label: "Codex", detected: true, managed: false },
  { id: "claude", label: "Claude Code", detected: false, managed: true },
  { id: "cursor", label: "Cursor", detected: false, managed: false },
];

describe("agent installer selector", () => {
  test("preselects detected and managed agents and renders their status", () => {
    const state = createSelectorState(items, ["codex", "claude"]);
    expect([...state.selected]).toEqual(["codex", "claude"]);
    expect(renderAgentSelector(items, state)).toContain("Codex  [detected]");
    expect(renderAgentSelector(items, state)).toContain("Claude Code  [installed]");
  });

  test("supports movement, toggling, and select all", () => {
    let state = createSelectorState(items, []);
    state = reduceSelector(state, "down", items);
    state = reduceSelector(state, "toggle", items);
    expect(state.cursor).toBe(1);
    expect([...state.selected]).toEqual(["claude"]);
    state = reduceSelector(state, "all", items);
    expect([...state.selected]).toEqual(["claude", "codex", "cursor"]);
    state = reduceSelector(state, "all", items);
    expect(state.selected.size).toBe(0);
  });

  test("refuses an empty submission", () => {
    const state = reduceSelector(createSelectorState(items, []), "submit", items);
    expect(state.error).toBe("Select at least one agent before continuing.");
  });
});
