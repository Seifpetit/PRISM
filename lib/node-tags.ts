import type { StrategyNode } from "@/types/strategy";
import { buildComboPalette } from "./combo-color";

/**
 * A short, human-followable reference code plus a contour accent color for a
 * canvas node. The code makes a lineage traceable without relying on color
 * (e.g. a color-blind user can still follow `A2·P1·C3·D1` back to its angle).
 */
export type NodeTag = { code: string; accent: string };

/** Product is the only node that keeps a fixed contour. Selecting the product isn't a Prism generation moment,
 * so it doesn't earn the full Prism gradient, but it's also the one node type that isn't one of the app's typed
 * ingredients (angle/offer/persona) with its own theme-defined color either — so it uses the person's own accent
 * from Personal settings (the app's "third color" for exactly this in-between case), falling back to the fixed
 * brand pink only until that accent has synced onto the document root (components/control-accent-sync.tsx). */
const PRODUCT_ACCENT = "var(--control-accent, var(--prism-pink))";
const ANGLE_ACCENT = "var(--lineage-selected)";
const AVATAR_ACCENT = "#8b93a1";
const OFFER_ACCENT = "#ffb43a";

export function buildNodeTags(
  nodes: StrategyNode[],
  links: Record<string, string[]> | undefined,
): {
  forNode: (id: string) => NodeTag | null;
  forAvatar: (avatarId: string) => NodeTag;
} {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const comboColorFor = buildComboPalette(links);

  // Angles — the first generation step: A1, A2, … in stable node order.
  const angleCode = new Map<string, string>();
  let angleIndex = 0;
  for (const node of nodes) {
    if (node.type === "angle") {
      angleIndex += 1;
      angleCode.set(node.id, `A${angleIndex}`);
    }
  }

  // Offers: O1, O2, … in stable node order — the third leg of the combo.
  const offerCode = new Map<string, string>();
  let offerIndex = 0;
  for (const node of nodes) {
    if (node.type === "offer") {
      offerIndex += 1;
      offerCode.set(node.id, `O${offerIndex}`);
    }
  }

  // Avatars (personas): P1, P2, … Seeded from the sorted link set so the code
  // is stable, then extended for any avatar that only shows up on a node.
  const avatarCode = new Map<string, string>();
  for (const avatarId of [...new Set(Object.keys(links ?? {}))].sort()) {
    avatarCode.set(avatarId, `P${avatarCode.size + 1}`);
  }
  const avatarCodeFor = (avatarId: string) => {
    if (!avatarId) return "P?";
    if (!avatarCode.has(avatarId)) avatarCode.set(avatarId, `P${avatarCode.size + 1}`);
    return avatarCode.get(avatarId) as string;
  };

  // Concepts: <angle>·<persona>·<offer>·C<n>, n counting within that combo.
  const conceptCount = new Map<string, number>();
  const conceptCode = new Map<string, string>();
  for (const node of nodes) {
    if (node.type !== "creativeConcept") continue;
    const offerPart = node.offerId ? `·${offerCode.get(node.offerId) ?? "O?"}` : "";
    const base = `${angleCode.get(node.parentId) ?? "A?"}·${avatarCodeFor(node.avatarId ?? "")}${offerPart}`;
    const next = (conceptCount.get(base) ?? 0) + 1;
    conceptCount.set(base, next);
    conceptCode.set(node.id, `${base}·C${next}`);
  }

  return {
    forNode: (id) => {
      const node = byId.get(id);
      if (!node) return null;
      if (node.type === "product") return { code: "ROOT", accent: PRODUCT_ACCENT };
      if (node.type === "angle") {
        return { code: angleCode.get(id) ?? "A?", accent: ANGLE_ACCENT };
      }
      if (node.type === "offer") {
        return { code: offerCode.get(id) ?? "O?", accent: OFFER_ACCENT };
      }
      if (node.type === "creativeConcept") {
        return {
          code: conceptCode.get(id) ?? "C?",
          accent: comboColorFor(node.avatarId ?? "", node.parentId),
        };
      }
      return null;
    },
    forAvatar: (avatarId) => ({ code: avatarCodeFor(avatarId), accent: AVATAR_ACCENT }),
  };
}
