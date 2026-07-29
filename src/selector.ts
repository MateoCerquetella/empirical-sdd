import { emitKeypressEvents } from "node:readline";
import type { ReadStream, WriteStream } from "node:tty";
import type { AgentIntegrationId } from "./types.js";

export interface AgentSelectorItem {
  id: AgentIntegrationId;
  label: string;
  detected: boolean;
  managed: boolean;
}

export interface AgentSelectorState {
  cursor: number;
  selected: Set<AgentIntegrationId>;
  error: string | null;
}

export type SelectorKey = "up" | "down" | "toggle" | "all" | "submit";

export function createSelectorState(
  items: AgentSelectorItem[],
  initiallySelected: Iterable<AgentIntegrationId>,
): AgentSelectorState {
  const allowed = new Set(items.map((item) => item.id));
  return {
    cursor: 0,
    selected: new Set([...initiallySelected].filter((id) => allowed.has(id))),
    error: null,
  };
}

export function reduceSelector(
  state: AgentSelectorState,
  key: SelectorKey,
  items: AgentSelectorItem[],
): AgentSelectorState {
  if (items.length === 0) return { ...state, error: "No supported agents are available." };
  if (key === "up") return { ...state, cursor: (state.cursor - 1 + items.length) % items.length, error: null };
  if (key === "down") return { ...state, cursor: (state.cursor + 1) % items.length, error: null };
  if (key === "submit") {
    return state.selected.size === 0
      ? { ...state, error: "Select at least one agent before continuing." }
      : { ...state, error: null };
  }
  const selected = new Set(state.selected);
  if (key === "all") {
    if (selected.size === items.length) selected.clear();
    else for (const item of items) selected.add(item.id);
  } else {
    const id = items[state.cursor]!.id;
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
  }
  return { ...state, selected, error: null };
}

export function renderAgentSelector(items: AgentSelectorItem[], state: AgentSelectorState): string {
  const rows = items.map((item, index) => {
    const cursor = index === state.cursor ? "›" : " ";
    const checked = state.selected.has(item.id) ? "[x]" : "[ ]";
    const badges = [item.detected ? "detected" : "", item.managed ? "installed" : ""]
      .filter(Boolean)
      .map((badge) => `[${badge}]`)
      .join(" ");
    return `${cursor} ${checked} ${item.label}${badges ? `  ${badges}` : ""}`;
  });
  return [
    "Empirical · choose agents",
    "",
    ...rows,
    "",
    "↑/↓ move  space select  a toggle all  enter install",
    ...(state.error ? [``, `! ${state.error}`] : []),
  ].join("\n");
}

export async function selectAgentsInteractive(
  items: AgentSelectorItem[],
  initiallySelected: Iterable<AgentIntegrationId>,
  input: ReadStream = process.stdin,
  output: WriteStream = process.stdout,
): Promise<AgentIntegrationId[]> {
  if (!input.isTTY || !output.isTTY) throw new Error("Interactive agent selection requires a TTY");
  emitKeypressEvents(input);
  const wasRaw = input.isRaw;
  input.setRawMode(true);
  input.resume();
  let state = createSelectorState(items, initiallySelected);
  const draw = () => output.write(`\x1b[2J\x1b[H${renderAgentSelector(items, state)}`);
  output.write("\x1b[?25l");
  draw();
  try {
    return await new Promise<AgentIntegrationId[]>((resolve, reject) => {
      const onKeypress = (_text: string, key: { name?: string; ctrl?: boolean; sequence?: string }): void => {
        if ((key.ctrl && key.name === "c") || key.name === "escape") {
          cleanup();
          reject(new Error("Agent selection cancelled"));
          return;
        }
        const mapped: SelectorKey | null = key.name === "up" || key.name === "k"
          ? "up"
          : key.name === "down" || key.name === "j"
            ? "down"
            : key.name === "space" || key.sequence === " "
              ? "toggle"
              : key.name === "a"
                ? "all"
                : key.name === "return" || key.name === "enter"
                  ? "submit"
                  : null;
        if (!mapped) return;
        state = reduceSelector(state, mapped, items);
        draw();
        if (mapped === "submit" && state.selected.size > 0) {
          const result = items.filter((item) => state.selected.has(item.id)).map((item) => item.id);
          cleanup();
          resolve(result);
        }
      };
      const cleanup = (): void => { input.off("keypress", onKeypress); };
      input.on("keypress", onKeypress);
    });
  } finally {
    input.setRawMode(wasRaw);
    input.pause();
    output.write("\x1b[?25h\n");
  }
}
