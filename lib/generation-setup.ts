// What a generation is set up with on the client: which Context Library sources are selected for it, and the
// instructions for its next run. The pure functions are tested on their own; only the two storage functions at the end
// touch the browser, and both are guarded.

import type { ContextSource, GenerationContextRequest } from "@/api/api";

export type GeneratorId = "targetAvatars" | "angles" | "offers" | "adPlan" | "adHooks";

export interface GeneratorInfo {
  id: GeneratorId;
  /** "Target Avatars", used in headings and buttons. */
  label: string;
  /** The saved-template id the drawer edits. */
  templateId: string;
  templateTitle: string;
  templateDescription: string;
  /** For generators that run per ad set or per ad rather than from a button in the drawer: when the setup is used. */
  usedBy: string | null;
}

export const GENERATORS: Record<GeneratorId, GeneratorInfo> = {
  targetAvatars: { id: "targetAvatars", label: "Target Avatars", templateId: "creative_exploration_target_avatars", templateTitle: "Target Avatar generation input template", templateDescription: "Sent to the model on every Target Avatar generation — saved edits apply from the next run on.", usedBy: null },
  angles: { id: "angles", label: "Angles", templateId: "creative_exploration_angles", templateTitle: "Angle generation input template", templateDescription: "Sent to the model on every Angle generation — saved edits apply from the next run on.", usedBy: null },
  offers: { id: "offers", label: "Offers", templateId: "creative_exploration_offers", templateTitle: "Offer generation input template", templateDescription: "Sent to the model on every Offer generation — saved edits apply from the next run on.", usedBy: null },
  adPlan: { id: "adPlan", label: "Creative plan", templateId: "creative_exploration_ad_plan", templateTitle: "Creative plan input template", templateDescription: "Sent to the model when it plans the ads of an ad set (Generate ads, Generate more ads). Saved edits apply from the next run on.", usedBy: "Used whenever you press Generate ads on an ad set." },
  adHooks: { id: "adHooks", label: "Hook alternatives", templateId: "creative_exploration_ad_hooks", templateTitle: "Hook alternatives input template", templateDescription: "Sent to the model when it writes other ways to open one ad. Saved edits apply from the next run on.", usedBy: "Used whenever you ask for hook alternatives on an ad." },
};

/** The same limits the server enforces; the panel stops short of them so a request is never refused for size. */
export const MAX_SOURCES = 8;
export const MAX_INSTRUCTIONS = 1500;
export const MAX_NOTE = 20_000;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_TEXT_BYTES = 5 * 1024 * 1024;

export const ACCEPTED_FILES = ".pdf,.txt,.md,.markdown,.csv";
export const ACCEPTED_LABEL = "PDF, TXT, Markdown or CSV";

export type Selections = Record<string, Partial<Record<GeneratorId, string[]>>>;

/** Sources that can go into a generation: ready ones only. */
export const isUsable = (source: ContextSource) => source.status === "ready";

/** The saved selection cleaned against the library: sources that are gone or no longer ready drop out, and the cap holds. */
export function usableSelection(selected: string[], library: ContextSource[]): string[] {
  const usable = new Set(library.filter(isUsable).map((source) => source.id));
  return selected.filter((id, index) => usable.has(id) && selected.indexOf(id) === index).slice(0, MAX_SOURCES);
}

export function toggled(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((value) => value !== id);
  return selected.length >= MAX_SOURCES ? selected : [...selected, id];
}

/** What is sent with a generation: nothing at all when nothing was chosen, so the default request is unchanged. */
export function contextRequest(sourceIds: string[], instructions: string): GenerationContextRequest | undefined {
  const text = instructions.replace(/\r\n?/g, "\n").trim();
  if (!sourceIds.length && !text) return undefined;
  return { sourceIds, ...(text ? { instructions: text } : {}) };
}

/** A one-line account of what the next run will use, for the footer. */
export function setupSummary(sourceCount: number, hasInstructions: boolean): string {
  const parts = ["Product Context"];
  if (sourceCount) parts.push(`${sourceCount} source${sourceCount === 1 ? "" : "s"}`);
  if (hasInstructions) parts.push("run instructions");
  return parts.join(" + ");
}

export const instructionKey = (productId: string, generator: GeneratorId) => `${productId}:${generator}`;

/** "12 KB" / "3.4 MB" for the library list. */
export function sizeLabel(bytes: number | null): string | null {
  if (bytes === null || bytes === undefined) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const KIND_LABEL: Record<ContextSource["kind"], string> = { pdf: "PDF", text: "Text", csv: "CSV", note: "Note" };

/** The kind a file will be read as, judged by its name like the server does; null when Prism can't read it. */
export function fileKindOf(name: string): "pdf" | "csv" | "text" | null {
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? "";
  if (extension === "pdf") return "pdf";
  if (extension === "csv") return "csv";
  if (["txt", "md", "markdown", "text"].includes(extension)) return "text";
  return null;
}

/** Why a file can't be added, judged before it is sent; null when it can. */
export function fileProblem(file: { name: string; size: number }): string | null {
  const kind = fileKindOf(file.name);
  if (!kind) return `Prism can read ${ACCEPTED_LABEL} here. “${file.name}” is a different type.`;
  const limit = kind === "pdf" ? MAX_PDF_BYTES : MAX_TEXT_BYTES;
  if (file.size > limit) return `“${file.name}” is over ${limit / 1024 / 1024} MB.`;
  if (file.size === 0) return `“${file.name}” is empty.`;
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Remembering the selection per product and generator (not the instructions, which are for one run)

const KEY = "prism-generation-setup";

export function readSelections(): Selections {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
    const value = raw ? (JSON.parse(raw) as unknown) : null;
    if (!value || typeof value !== "object") return {};
    const clean: Selections = {};
    for (const [productId, byGenerator] of Object.entries(value as Record<string, unknown>)) {
      if (!byGenerator || typeof byGenerator !== "object") continue;
      for (const id of Object.keys(GENERATORS) as GeneratorId[]) {
        const ids = (byGenerator as Record<string, unknown>)[id];
        if (Array.isArray(ids)) clean[productId] = { ...clean[productId], [id]: ids.filter((entry): entry is string => typeof entry === "string").slice(0, MAX_SOURCES) };
      }
    }
    return clean;
  } catch {
    return {};
  }
}

export function saveSelections(selections: Selections) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(selections));
  } catch {
    // Nothing to do: the next visit starts with nothing selected.
  }
}
