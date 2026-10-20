// A persona has no photo of its own. Every place that shows a persona
// (the tray, the canvas node, an ad set's Persona port) renders the same deterministic mark for a given avatar
// id: a solid colour and a pair of initials. Same id, same mark, everywhere, with no request and no cost.
//
// No imports on purpose, so this runs under plain Node for tests (lib/campaign-rules.ts does the same).

/** Fixed hue stops, spaced around the wheel and kept away from the app's own role colours: angle blue (~215°),
 *  persona violet (~258°) and offer amber (~36°), so a persona's mark never reads as one of those roles. */
const MARK_HUES = [4, 26, 80, 150, 172, 192, 232, 280, 320, 342] as const;

const MARK_SATURATION = 58;
const MARK_LIGHTNESS = 45;

/** A small, fast string hash (djb2). Stable across runs and platforms; not cryptographic, doesn't need to be. */
export function hashString(value: string): number {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return hash >>> 0;
}

export interface PersonaMarkColors {
  background: string;
  foreground: string;
}

/** The mark's colour for one persona id. Deterministic: the same id always resolves to the same hue. */
export function personaMarkColors(avatarId: string): PersonaMarkColors {
  const hue = MARK_HUES[hashString(avatarId) % MARK_HUES.length];
  return {
    background: `hsl(${hue} ${MARK_SATURATION}% ${MARK_LIGHTNESS}%)`,
    foreground: "#ffffff",
  };
}

/** `personaMarkColors` as a ready-to-spread inline style ({ background, color }, not { background, foreground }). */
export function personaMarkStyle(avatarId: string): { background: string; color: string } {
  const { background, foreground } = personaMarkColors(avatarId);
  return { background, color: foreground };
}

const STOP_WORDS = new Set(["the", "a", "an", "of", "and", "or", "for", "with", "to"]);

/** "The apartment household tracking a summer cooling bill" -> "AH". Falls back to the first two letters of the
 *  label when it has no usable words (short labels, symbols-only labels, and the like). */
export function personaInitials(label: string): string {
  const words = label
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word.toLowerCase()));

  const source = words.length > 0 ? words : label.trim().split(/\s+/).filter(Boolean);
  if (source.length === 0) return "?";

  const first = source[0]?.[0] ?? "";
  const second = source.length > 1 ? (source[1]?.[0] ?? "") : (source[0]?.[1] ?? "");
  const initials = `${first}${second}`.toUpperCase();
  return initials || "?";
}
