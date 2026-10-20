// The choices in the "Generate ads" panel: what to optimise a generation of ads for. Pure apart from the two guarded
// storage functions at the end; only types are imported, so it is tested on its own.

import type { AdPlanRequest } from "@/api/api";
import type { AdFormat, AwarenessStage } from "@/types/campaign";

/** No more ads in one ad set than this. */
export const MAX_ADS = 20;
/** The most ads one generation returns, and the fewest. */
export const MAX_COUNT = 6;
export const MIN_COUNT = 2;
/** There are four awareness stages, so no more than four ads can each be at a different one. */
export const STAGE_COUNT = 4;

/** A VSL is a long-form video: only these formats carry one. */
export const VSL_FORMATS: AdFormat[] = ["video", "ugc_video", "ai_talking_head"];

export type AwarenessChoice = "spread" | AwarenessStage | null;
export type Structure = "short" | "vsl";

export interface Choices {
  /** One format for every ad; null lets the AI choose. */
  format: AdFormat | null;
  /** A stage for every ad, "spread" for each ad at a different stage, or null to let the AI choose. */
  awareness: AwarenessChoice;
  /** How many ads; null lets the AI decide (3 or 4). */
  count: number | null;
  structure: Structure;
  /** Anything else to optimise for, in the person's words. */
  note: string;
}

export const DEFAULT_CHOICES: Choices = { format: null, awareness: null, count: null, structure: "short", note: "" };
export const MAX_NOTE = 300;

export interface Preset {
  id: "ai" | "stages" | "vsl";
  label: string;
  help: string;
  choices: Choices;
}

/** Ready-made choices for the requests people make most; any change to a field afterwards makes it "custom". */
export const PRESETS: Preset[] = [
  { id: "ai", label: "Let AI decide", help: "3 or 4 different ideas; the AI picks stages and formats.", choices: DEFAULT_CHOICES },
  { id: "stages", label: "One ad per stage", help: "Four ads, each at a different awareness stage.", choices: { ...DEFAULT_CHOICES, awareness: "spread", count: STAGE_COUNT } },
  { id: "vsl", label: "AI talking-head VSLs", help: "Long-form video sales letters told by an AI presenter.", choices: { ...DEFAULT_CHOICES, format: "ai_talking_head", structure: "vsl" } },
];

/** The fewest and most ads the panel may ask for, given how many more the ad set can take. */
export function countLimits(choices: Choices, room: number): { min: number; max: number } {
  const ceiling = choices.awareness === "spread" ? STAGE_COUNT : MAX_COUNT;
  return { min: MIN_COUNT, max: Math.max(0, Math.min(ceiling, room)) };
}

/** The choices with the ones that contradict each other resolved, so what is asked for can always be done. */
export function tidy(choices: Choices, room: number): Choices {
  const next = { ...choices, note: choices.note.slice(0, MAX_NOTE) };
  // A VSL is a video: a format that is not one is cleared rather than kept in conflict.
  if (next.structure === "vsl" && next.format && !VSL_FORMATS.includes(next.format)) next.format = null;
  if (next.count !== null) {
    const { min, max } = countLimits(next, room);
    next.count = max < min ? null : Math.min(Math.max(next.count, min), max);
  }
  return next;
}

/** What is sent to the backend: nothing at all when nothing was chosen, so the default generation is unchanged. */
export function toRequest(choices: Choices): AdPlanRequest | undefined {
  const note = choices.note.replace(/\s+/g, " ").trim();
  if (!choices.format && !choices.awareness && choices.count === null && choices.structure === "short" && !note) return undefined;
  return { format: choices.format, awareness: choices.awareness, count: choices.count, structure: choices.structure, note: note || null };
}

const same = (a: Choices, b: Choices) => a.format === b.format && a.awareness === b.awareness && a.count === b.count && a.structure === b.structure;

/** The preset these choices are, or "custom" once anything has been changed by hand (a note included). */
export function activePreset(choices: Choices): Preset["id"] | "custom" {
  if (choices.note.trim()) return "custom";
  return PRESETS.find((preset) => same(preset.choices, choices))?.id ?? "custom";
}

// ---------------------------------------------------------------------------------------------------------------------
// Remembering the last choices (not the note), so the same request is one click away next time.

const KEY = "prism-generate-ads";

export function readChoices(): Choices {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CHOICES;
    const value = JSON.parse(raw) as Partial<Choices>;
    const structure: Structure = value.structure === "vsl" ? "vsl" : "short";
    const count = typeof value.count === "number" && Number.isInteger(value.count) && value.count >= MIN_COUNT && value.count <= MAX_COUNT ? value.count : null;
    return { format: typeof value.format === "string" ? (value.format as AdFormat) : null, awareness: typeof value.awareness === "string" ? (value.awareness as AwarenessChoice) : null, count, structure, note: "" };
  } catch {
    return DEFAULT_CHOICES;
  }
}

export function saveChoices(choices: Choices) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify({ ...choices, note: "" }));
  } catch {
    // Nothing to do: the next visit starts from "Let AI decide".
  }
}
