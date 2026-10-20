/**
 * Stable, distinctive color per (avatar, angle) combo so its Angle link and all
 * its Creative Concept / Direction links read as one lineage on the canvas.
 */
export const COMBO_COLORS = [
  "#1769ff", // blue
  "#f33dbb", // pink
  "#12b886", // green
  "#ffb43a", // amber
  "#7a4cff", // violet
  "#ff6b4a", // coral
  "#0bbcd6", // cyan
  "#e8590c", // burnt orange
  "#9c36b5", // magenta
  "#4263eb", // indigo
  "#2f9e44", // forest
  "#d6336c", // raspberry
] as const;

export function comboKey(avatarId: string, angleId: string): string {
  return `${avatarId}::${angleId}`;
}

/** Deterministic hash so a combo keeps a stable color even with no link map to index. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Fallback color from the combo identity alone (may collide across combos). */
export function comboColor(avatarId: string, angleId: string): string {
  return COMBO_COLORS[hashString(comboKey(avatarId, angleId)) % COMBO_COLORS.length];
}

/**
 * Build a color lookup where every combo in `links` gets a distinct color
 * (first 12 combos never collide), assigned by a stable sort of the combo keys.
 */
export function buildComboPalette(
  links: Record<string, string[]> | undefined,
): (avatarId: string, angleId: string) => string {
  const keys = new Set<string>();
  for (const [avatarId, angleIds] of Object.entries(links ?? {})) {
    for (const angleId of angleIds ?? []) keys.add(comboKey(avatarId, angleId));
  }
  const order = [...keys].sort();
  const index = new Map(order.map((key, i) => [key, i]));
  return (avatarId, angleId) => {
    const key = comboKey(avatarId, angleId);
    const i = index.get(key);
    return COMBO_COLORS[(i ?? hashString(key)) % COMBO_COLORS.length];
  };
}
