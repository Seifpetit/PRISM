// The merger rule: when several ad sets share two of their three ingredients and differ only on the third, the two
// shared ingredients are drawn once, into a merger node, and the merger fans out to each of those ad sets.
//
// The rule, stated in full (the canvas implements exactly this, nothing else):
//   1. An ad set is a joint of three ingredients: a persona, an angle and an offer (its "axes").
//   2. Take every pair of axes. Ad sets that hold the SAME ingredient on BOTH axes of a pair form a group for that
//      pair; the one remaining axis is where they differ (or coincide, for a duplicate ad set).
//   3. A group with at least MERGE_MIN_OUTPUTS ad sets becomes one merger: two inputs (the two shared ingredients),
//      one output per ad set. Those ad sets then take the two shared ingredients through the merger and keep their
//      third ingredient as an ordinary direct link.
//   4. An ad set belongs to at most one merger. When groups overlap, the largest group wins (ties break by pair
//      order: persona+offer, persona+angle, angle+offer), its ad sets are taken out of play, and the groups are
//      formed again from what is left, so the result never depends on input order beyond that tie-break.
//   5. A pair can only be merged if both shared ingredients can be drawn as wires (an ingredient that is gone or
//      not on the canvas has no wire to merge); ad sets outside any merger keep all their direct links.
//   6. Mergers never cross campaigns: call this once per campaign page.

export type MergeAxis = "persona" | "angle" | "offer";

/** Ordered pairs tried by the tie-break, first to last. */
export const MERGE_PAIRS: ReadonlyArray<readonly [MergeAxis, MergeAxis]> = [
  ["persona", "offer"],
  ["persona", "angle"],
  ["angle", "offer"],
];

/** The fewest ad sets that justify a merger (a merger of one would just be a detour). */
export const MERGE_MIN_OUTPUTS = 2;

export interface MergeableConcept {
  id: string;
  avatarId: string;
  angleId: string;
  offerId: string;
}

export interface MergerPlan {
  /** Stable for the same pair and the same shared ingredients. */
  id: string;
  /** The two shared axes, in MERGE_PAIRS order. */
  axes: readonly [MergeAxis, MergeAxis];
  /** The shared ingredient ids, in the same order as `axes`. */
  sharedIds: readonly [string, string];
  /** The axis the grouped ad sets differ on. */
  freeAxis: MergeAxis;
  /** The ad sets fed by this merger, in input order. */
  conceptIds: string[];
}

const ingredientOf = (concept: MergeableConcept, axis: MergeAxis) =>
  axis === "persona" ? concept.avatarId : axis === "angle" ? concept.angleId : concept.offerId;

const freeAxisOf = (pair: readonly [MergeAxis, MergeAxis]): MergeAxis =>
  (["persona", "angle", "offer"] as const).find((axis) => !pair.includes(axis)) as MergeAxis;

export function planMergers(
  concepts: MergeableConcept[],
  canDraw: (axis: MergeAxis, ingredientId: string) => boolean = () => true,
  minOutputs: number = MERGE_MIN_OUTPUTS,
): MergerPlan[] {
  const plans: MergerPlan[] = [];
  const taken = new Set<string>();
  for (;;) {
    let best: { pairIndex: number; key: string; members: MergeableConcept[] } | null = null;
    MERGE_PAIRS.forEach((pair, pairIndex) => {
      const groups = new Map<string, MergeableConcept[]>();
      for (const concept of concepts) {
        if (taken.has(concept.id)) continue;
        const a = ingredientOf(concept, pair[0]);
        const b = ingredientOf(concept, pair[1]);
        if (!a || !b || !canDraw(pair[0], a) || !canDraw(pair[1], b)) continue;
        const key = `${a}\u0000${b}`;
        groups.set(key, [...(groups.get(key) ?? []), concept]);
      }
      for (const [key, members] of groups) {
        if (members.length < minOutputs) continue;
        if (!best || members.length > best.members.length || (members.length === best.members.length && pairIndex < best.pairIndex)) {
          best = { pairIndex, key, members };
        }
      }
    });
    if (!best) break;
    const { pairIndex, key, members } = best as { pairIndex: number; key: string; members: MergeableConcept[] };
    const pair = MERGE_PAIRS[pairIndex];
    const [a, b] = key.split("\u0000");
    plans.push({
      id: `merger:${pair[0]}-${pair[1]}:${a}:${b}`,
      axes: pair,
      sharedIds: [a, b],
      freeAxis: freeAxisOf(pair),
      conceptIds: members.map((member) => member.id),
    });
    for (const member of members) taken.add(member.id);
  }
  return plans;
}
