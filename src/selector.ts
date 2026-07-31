import { emitKeypressEvents } from "node:readline";
import type { ReadStream, WriteStream } from "node:tty";
import type { AgentSkillTargetId } from "./agent-catalog.js";

const DEFAULT_VISIBLE_ROWS = 8;
const DEFAULT_COLUMNS = 80;

export interface AgentSelectorItem {
  id: AgentSkillTargetId;
  label: string;
  aliases: readonly string[];
  destination: string;
  detected: boolean;
  managed: boolean;
  remembered?: boolean;
}

export interface AgentSelectorState {
  cursor: number;
  query: string;
  selected: Set<AgentSkillTargetId>;
  error: string | null;
}

export type SelectorKey =
  | "up"
  | "down"
  | "toggle"
  | "backspace"
  | "submit"
  | { type: "input"; value: string };

export interface AgentSelectorRenderOptions {
  columns?: number;
  visibleRows?: number;
}

export function createSelectorState(
  items: AgentSelectorItem[],
  initiallySelected: Iterable<AgentSkillTargetId>,
): AgentSelectorState {
  const allowed = new Set(items.map((item) => item.id));
  return {
    cursor: 0,
    query: "",
    selected: new Set([...initiallySelected].filter((id) => allowed.has(id))),
    error: null,
  };
}

export function orderedAgentSelectorItems(items: AgentSelectorItem[]): AgentSelectorItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftPriority = left.item.detected || left.item.managed || left.item.remembered ? 0 : 1;
      const rightPriority = right.item.detected || right.item.managed || right.item.remembered ? 0 : 1;
      return leftPriority - rightPriority || left.index - right.index;
    })
    .map(({ item }) => item);
}

export function filterAgentSelectorItems(
  items: AgentSelectorItem[],
  query: string,
): AgentSelectorItem[] {
  const normalized = query.trim().toLowerCase();
  const ordered = orderedAgentSelectorItems(items);
  if (!normalized) return ordered;
  return ordered.filter((item) => [item.label, item.id, item.destination ?? "", ...(item.aliases ?? [])]
    .some((value) => value.toLowerCase().includes(normalized)));
}

export function reduceSelector(
  state: AgentSelectorState,
  key: SelectorKey,
  items: AgentSelectorItem[],
): AgentSelectorState {
  if (typeof key === "object") {
    if (!key.value || /[\u0000-\u001f\u007f]/.test(key.value)) return state;
    return { ...state, cursor: 0, query: `${state.query}${key.value}`, error: null };
  }
  if (key === "backspace") {
    return { ...state, cursor: 0, query: [...state.query].slice(0, -1).join(""), error: null };
  }
  const visible = filterAgentSelectorItems(items, state.query);
  if (key === "submit") {
    return state.selected.size === 0
      ? { ...state, error: "Select at least one agent before continuing." }
      : { ...state, error: null };
  }
  if (visible.length === 0) return { ...state, cursor: 0, error: "No agents match this search." };
  if (key === "up") {
    return { ...state, cursor: (state.cursor - 1 + visible.length) % visible.length, error: null };
  }
  if (key === "down") {
    return { ...state, cursor: (state.cursor + 1) % visible.length, error: null };
  }
  const selected = new Set(state.selected);
  const id = visible[Math.min(state.cursor, visible.length - 1)]!.id;
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  return { ...state, selected, error: null };
}

export function selectorViewport(
  items: AgentSelectorItem[],
  state: AgentSelectorState,
  visibleRows = DEFAULT_VISIBLE_ROWS,
): { items: AgentSelectorItem[]; start: number; hiddenAbove: number; hiddenBelow: number } {
  const filtered = filterAgentSelectorItems(items, state.query);
  const size = Math.max(1, Math.floor(visibleRows));
  const cursor = Math.min(state.cursor, Math.max(0, filtered.length - 1));
  const start = Math.max(0, Math.min(cursor - Math.floor(size / 2), filtered.length - size));
  const window = filtered.slice(start, start + size);
  return {
    items: window,
    start,
    hiddenAbove: start,
    hiddenBelow: Math.max(0, filtered.length - start - window.length),
  };
}

export function renderAgentSelector(
  items: AgentSelectorItem[],
  state: AgentSelectorState,
  options: AgentSelectorRenderOptions | number = {},
): string {
  const settings = typeof options === "number" ? { columns: options } : options;
  const columns = Math.max(1, Math.floor(settings.columns ?? DEFAULT_COLUMNS));
  const viewport = selectorViewport(items, state, settings.visibleRows ?? DEFAULT_VISIBLE_ROWS);
  const filtered = filterAgentSelectorItems(items, state.query);
  const lines = [
    "◆ Empirical install",
    `│  ${items.length} compatible agent skill targets · local catalog`,
    "│",
    "◆ Which agents should receive Empirical?  (type to search)",
    `│  Search: ${state.query}█`,
    "│  ↑↓ move, space select, enter confirm, esc cancel",
    "│",
  ];
  if (viewport.hiddenAbove > 0) lines.push(`│  ↑ ${viewport.hiddenAbove} above`);
  let category: "priority" | "additional" | null = null;
  viewport.items.forEach((item, offset) => {
    const nextCategory = item.detected || item.managed || item.remembered ? "priority" : "additional";
    if (nextCategory !== category) {
      lines.push(`│  ${nextCategory === "priority" ? "Detected or installed" : "Additional agents"}`);
      category = nextCategory;
    }
    const absoluteIndex = viewport.start + offset;
    const cursor = absoluteIndex === Math.min(state.cursor, Math.max(0, filtered.length - 1)) ? "❯" : " ";
    const checked = state.selected.has(item.id) ? "●" : "○";
    const statuses = [
      item.detected ? "detected" : "",
      item.managed ? "installed" : "",
      item.remembered && !item.managed ? "remembered" : "",
    ].filter(Boolean).join(" · ");
    const hint = [statuses, displayDestination(item.destination ?? "")].filter(Boolean).join("   ");
    lines.push(`│ ${cursor} ${checked} ${item.label}${hint ? `   ${hint}` : ""}`);
  });
  if (filtered.length === 0) lines.push("│  No agents match this search.");
  if (viewport.hiddenBelow > 0) lines.push(`│  ↓ ${viewport.hiddenBelow} more`);
  const selectedLabels = items.filter((item) => state.selected.has(item.id)).map((item) => item.label);
  lines.push(
    "│",
    `│  Selected (${selectedLabels.length}): ${selectedLabels.length ? selectedLabels.join(", ") : "none"}`,
    ...(state.error ? [`│  ! ${state.error}`] : []),
    "└",
  );
  return lines.map((line) => truncateDisplay(line, columns)).join("\n");
}

export async function selectAgentsInteractive(
  items: AgentSelectorItem[],
  initiallySelected: Iterable<AgentSkillTargetId>,
  input: ReadStream = process.stdin,
  output: WriteStream = process.stdout,
): Promise<AgentSkillTargetId[]> {
  if (!input.isTTY || !output.isTTY) throw new Error("Interactive agent selection requires a TTY");
  emitKeypressEvents(input);
  const wasRaw = input.isRaw;
  let state = createSelectorState(items, initiallySelected);
  let renderedLines = 0;
  let rawChanged = false;
  let cursorHidden = false;
  const draw = (): void => {
    const frame = renderAgentSelector(items, state, { columns: output.columns ?? DEFAULT_COLUMNS });
    const prefix = renderedLines > 1
      ? `\x1b[${renderedLines - 1}F\x1b[J`
      : renderedLines === 1 ? "\r\x1b[J" : "";
    renderedLines = frame.split("\n").length;
    output.write(`${prefix}${frame}`);
  };
  try {
    input.setRawMode(true);
    rawChanged = true;
    input.resume();
    cursorHidden = true;
    output.write("\x1b[?25l");
    draw();
    return await new Promise<AgentSkillTargetId[]>((resolve, reject) => {
      const cleanup = (): void => {
        input.off("keypress", onKeypress);
        output.off("resize", onResize);
      };
      const onKeypress = (text: string, key: { name?: string; ctrl?: boolean; sequence?: string }): void => {
        try {
          if ((key.ctrl && key.name === "c") || key.name === "escape") {
            cleanup();
            reject(new Error("Agent selection cancelled"));
            return;
          }
          const action: SelectorKey | null = key.name === "up"
            ? "up"
            : key.name === "down"
              ? "down"
              : key.name === "space" || key.sequence === " "
                ? "toggle"
                : key.name === "backspace"
                  ? "backspace"
                  : key.name === "return" || key.name === "enter"
                    ? "submit"
                    : text && !key.ctrl
                      ? { type: "input", value: text }
                      : null;
          if (!action) return;
          state = reduceSelector(state, action, items);
          draw();
          if (action !== "submit" || state.selected.size === 0 || state.error) return;
          const result = items.filter((item) => state.selected.has(item.id)).map((item) => item.id);
          cleanup();
          resolve(result);
        } catch (error) {
          cleanup();
          reject(error);
        }
      };
      const onResize = (): void => {
        try {
          draw();
        } catch (error) {
          cleanup();
          reject(error);
        }
      };
      input.on("keypress", onKeypress);
      output.on("resize", onResize);
    });
  } finally {
    try {
      if (rawChanged) {
        input.setRawMode(wasRaw);
        input.pause();
      }
    } finally {
      if (cursorHidden) output.write("\x1b[?25h\n");
    }
  }
}

function displayDestination(destination: string): string {
  if (!destination) return "";
  if (destination.startsWith("~/")) return destination;
  return `~/${destination.replace(/^\.?\//, "")}`;
}

function truncateDisplay(value: string, columns: number): string {
  if (displayWidth(value) <= columns) return value;
  if (columns <= 1) return "…".slice(0, columns);
  let result = "";
  let width = 0;
  for (const character of value) {
    const next = characterWidth(character);
    if (width + next > columns - 1) break;
    result += character;
    width += next;
  }
  return `${result}…`;
}

function displayWidth(value: string): number {
  return [...value].reduce((width, character) => width + characterWidth(character), 0);
}

function characterWidth(character: string): number {
  const code = character.codePointAt(0) ?? 0;
  if (/\p{Mark}/u.test(character) || code === 0xfe0f || code === 0x200d) return 0;
  return code >= 0x1100 && (
    code <= 0x115f
    || code === 0x2329 || code === 0x232a
    || (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f)
    || (code >= 0xac00 && code <= 0xd7a3)
    || (code >= 0xf900 && code <= 0xfaff)
    || (code >= 0xfe10 && code <= 0xfe19)
    || (code >= 0xfe30 && code <= 0xfe6f)
    || (code >= 0xff00 && code <= 0xff60)
    || (code >= 0xffe0 && code <= 0xffe6)
    || (code >= 0x1f300 && code <= 0x1faff)
    || (code >= 0x20000 && code <= 0x3fffd)
  ) ? 2 : 1;
}
