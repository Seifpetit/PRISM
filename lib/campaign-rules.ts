// The framework's rules for a test campaign, as pure functions (docs/creative-strategy/framework.md).
//
//   Concept = Persona x Angle x Offer, and one concept is one Meta ad set.
//   Test priority when something underperforms: Angle, then Offer, then Persona. Format is last and lives
//   inside a concept (as ads), not between concepts.
//
// A campaign has a test type: the ONE axis its concepts vary. The other two stay fixed, so the result
// isolates what was changed. No imports on purpose, so these run under plain Node for tests.

export type Axis = "avatar" | "angle" | "offer";
export type TestType = "angle" | "offer" | "persona";

export interface ConceptKey {
  avatarId: string;
  angleId: string;
  offerId: string;
}

export interface ComposePick {
  avatarIds: string[];
  angleIds: string[];
  offerIds: string[];
}

export const MAX_COMBOS_PER_ACTION = 24;

export const AXIS_LABEL: Record<Axis, string> = { avatar: "persona", angle: "angle", offer: "offer" };

export const TEST_TYPE_INFO: Record<TestType, { label: string; varies: Axis; hint: string }> = {
  angle: {
    label: "Angle test",
    varies: "angle",
    hint: "Same persona and offer, different angles. The highest-leverage test, so start here.",
  },
  offer: {
    label: "Offer test",
    varies: "offer",
    hint: "Same persona and angle, different offers. Test this once an angle is working.",
  },
  persona: {
    label: "Persona test",
    varies: "avatar",
    hint: "Same angle and offer, different personas. Use it for breadth once angle and offer are dialed in.",
  },
};

export const AXES_IN_ORDER: Axis[] = ["avatar", "angle", "offer"];

const idOf = (concept: ConceptKey, axis: Axis) =>
  axis === "avatar" ? concept.avatarId : axis === "angle" ? concept.angleId : concept.offerId;

/** Which of persona / angle / offer differ between two concepts. */
export function differingAxes(a: ConceptKey, b: ConceptKey): Axis[] {
  return AXES_IN_ORDER.filter((axis) => idOf(a, axis) !== idOf(b, axis));
}

const pickFor = (pick: ComposePick, axis: Axis) =>
  axis === "avatar" ? pick.avatarIds : axis === "angle" ? pick.angleIds : pick.offerIds;

const plural = (count: number, axis: Axis) => `${count} ${AXIS_LABEL[axis]}${count === 1 ? "" : "s"}`;

/**
 * Turns what the user picked on the canvas into the concepts (ad sets) to create, enforcing the campaign's
 * test type: exactly one of each fixed axis, at least one of the varying axis. When the campaign already has
 * concepts, the fixed axes must match its baseline (its first concept), so every ad set stays comparable.
 */
export function expandPick(
  pick: ComposePick,
  testType: TestType,
  existing: ConceptKey[] = [],
): { combos: ConceptKey[]; error: string | null } {
  const varies = TEST_TYPE_INFO[testType].varies;
  const fixed = AXES_IN_ORDER.filter((axis) => axis !== varies);
  const label = TEST_TYPE_INFO[testType].label;

  for (const axis of fixed) {
    const count = pickFor(pick, axis).length;
    if (count !== 1) {
      const need = fixed.map((a) => `one ${AXIS_LABEL[a]}`).join(" and ");
      return {
        combos: [],
        error: `${label}: pick ${need}, and any number of ${AXIS_LABEL[varies]}s. You picked ${plural(count, axis)}.`,
      };
    }
  }
  if (pickFor(pick, varies).length === 0) {
    return { combos: [], error: `${label}: pick at least one ${AXIS_LABEL[varies]} to vary.` };
  }

  const baseline = existing[0];
  if (baseline) {
    for (const axis of fixed) {
      if (pickFor(pick, axis)[0] !== idOf(baseline, axis)) {
        return {
          combos: [],
          error: `This campaign already fixes its ${AXIS_LABEL[axis]}. Pick the same ${AXIS_LABEL[axis]} as its other ad sets, or start a new campaign.`,
        };
      }
    }
  }

  const combos: ConceptKey[] = pickFor(pick, varies).map((value) => ({
    avatarId: varies === "avatar" ? value : pick.avatarIds[0],
    angleId: varies === "angle" ? value : pick.angleIds[0],
    offerId: varies === "offer" ? value : pick.offerIds[0],
  }));
  if (combos.length > MAX_COMBOS_PER_ACTION) {
    return { combos: [], error: `Add at most ${MAX_COMBOS_PER_ACTION} ad sets at a time (you picked ${combos.length}).` };
  }
  return { combos, error: null };
}

/** What the campaign composer has ticked, per axis. `multi` stays undefined for an axis until the user touches it. */
export interface ComposerChoices {
  single: Partial<Record<Axis, string>>;
  multi: Partial<Record<Axis, string[]>>;
}

/** How many of the varying axis start ticked, before the user touches anything. */
export const DEFAULT_VARYING = 4;

const pickKey: Record<Axis, keyof ComposePick> = { avatar: "avatarIds", angle: "angleIds", offer: "offerIds" };

/**
 * The composer's selection as a pick. The user's choices count where they still exist; otherwise defaults
 * apply, so a fresh composer is already a valid campaign: each fixed axis takes its first item, and the
 * varying axis takes its first few until the user changes it.
 */
export function resolveComposerPick(
  available: Record<Axis, string[]>,
  testType: TestType,
  choices: ComposerChoices,
  defaultVarying = DEFAULT_VARYING,
): ComposePick {
  const varies = TEST_TYPE_INFO[testType].varies;
  const pick: ComposePick = { avatarIds: [], angleIds: [], offerIds: [] };
  for (const axis of AXES_IN_ORDER) {
    const ids = available[axis];
    if (axis === varies) {
      const ticked = choices.multi[axis];
      pick[pickKey[axis]] = ticked ? ticked.filter((id) => ids.includes(id)) : ids.slice(0, defaultVarying);
    } else {
      // An axis that was varying a moment ago hands over its first ticked item as the single choice.
      const chosen = [choices.single[axis], ...(choices.multi[axis] ?? [])].find((id) => id !== undefined && ids.includes(id));
      pick[pickKey[axis]] = chosen ? [chosen] : ids.slice(0, 1);
    }
  }
  return pick;
}

/**
 * The composer's free selection: every persona, angle and offer ticked becomes an ad set, in every combination,
 * minus the ad sets the campaign already has. The test type does not restrict it; it only shapes the defaults and
 * the guidance (see testDrift).
 */
export function resolveFreePick(
  available: Record<Axis, string[]>,
  testType: TestType,
  ticks: Partial<Record<Axis, string[]>>,
  baseline?: ConceptKey,
  defaultVarying = DEFAULT_VARYING,
): ComposePick {
  const varies = TEST_TYPE_INFO[testType].varies;
  const pick: ComposePick = { avatarIds: [], angleIds: [], offerIds: [] };
  for (const axis of AXES_IN_ORDER) {
    const ids = available[axis];
    const touched = ticks[axis];
    let ticked: string[];
    if (touched) ticked = touched.filter((id) => ids.includes(id));
    else if (axis === varies) ticked = baseline ? ids : ids.slice(0, defaultVarying);
    else {
      const own = baseline ? idOf(baseline, axis) : undefined;
      ticked = own !== undefined && ids.includes(own) ? [own] : ids.slice(0, 1);
    }
    pick[pickKey[axis]] = ticked;
  }
  return pick;
}

const HARD_LIMIT = 10_000;

export function expandFreePick(
  pick: ComposePick,
  existing: ConceptKey[] = [],
): { combos: ConceptKey[]; skipped: number; error: string | null } {
  for (const axis of AXES_IN_ORDER) {
    if (pickFor(pick, axis).length === 0) return { combos: [], skipped: 0, error: `Tick at least one ${AXIS_LABEL[axis]}.` };
  }
  const size = pick.avatarIds.length * pick.angleIds.length * pick.offerIds.length;
  if (size > HARD_LIMIT) return { combos: [], skipped: 0, error: `That is ${size} combinations. Add at most ${MAX_COMBOS_PER_ACTION} ad sets at a time.` };
  const taken = new Set(existing.map((concept) => `${concept.avatarId}|${concept.angleId}|${concept.offerId}`));
  const combos: ConceptKey[] = [];
  let skipped = 0;
  for (const avatarId of pick.avatarIds) {
    for (const angleId of pick.angleIds) {
      for (const offerId of pick.offerIds) {
        if (taken.has(`${avatarId}|${angleId}|${offerId}`)) skipped += 1;
        else combos.push({ avatarId, angleId, offerId });
      }
    }
  }
  if (combos.length > MAX_COMBOS_PER_ACTION) {
    return { combos: [], skipped, error: `Add at most ${MAX_COMBOS_PER_ACTION} ad sets at a time (you ticked ${combos.length}).` };
  }
  if (combos.length === 0) return { combos, skipped, error: "Everything you ticked is already an ad set in this campaign." };
  return { combos, skipped, error: null };
}

/**
 * Which axes, other than the one the campaign tests, this selection also changes. Nothing here blocks anything:
 * it is how the composer says "this stops being a clean test". Against a baseline (the campaign's first ad set)
 * an axis changes when it is not that baseline's value; without one, when more than one value is ticked.
 */
export function testDrift(pick: ComposePick, testType: TestType, baseline?: ConceptKey): Axis[] {
  const varies = TEST_TYPE_INFO[testType].varies;
  return AXES_IN_ORDER.filter((axis) => {
    if (axis === varies) return false;
    const ticked = pickFor(pick, axis);
    return ticked.length > 1 || (baseline !== undefined && ticked.length === 1 && ticked[0] !== idOf(baseline, axis));
  });
}

export type ConceptBadge =
  | { kind: "baseline"; label: string }
  | { kind: "variant"; label: string; axes: Axis[] }
  | { kind: "off-test"; label: string; axes: Axis[] };

/**
 * How each concept relates to the campaign's baseline (its first concept): the baseline itself, a clean
 * variant that changes only the axis under test, or an "off-test" concept that also changes something else.
 */
export function conceptBadges(concepts: ConceptKey[], testType: TestType): ConceptBadge[] {
  const varies = TEST_TYPE_INFO[testType].varies;
  const baseline = concepts[0];
  return concepts.map((concept, index) => {
    if (index === 0 || !baseline) return { kind: "baseline", label: "Baseline" };
    const axes = differingAxes(baseline, concept);
    if (axes.length === 0) return { kind: "baseline", label: "Same as baseline" };
    const onlyVaries = axes.every((axis) => axis === varies);
    return onlyVaries
      ? { kind: "variant", label: `${capitalize(AXIS_LABEL[varies])} variant`, axes }
      : { kind: "off-test", label: `Also changes ${axes.filter((a) => a !== varies).map((a) => AXIS_LABEL[a]).join(" + ")}`, axes };
  });
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Plain-language problems with a campaign, most important first. Empty means it is a clean test. */
export function campaignWarnings(concepts: ConceptKey[], testType: TestType): string[] {
  const warnings: string[] = [];
  const varies = TEST_TYPE_INFO[testType].varies;
  if (concepts.length < 2) {
    warnings.push(`Add at least 2 ad sets: a test compares ${AXIS_LABEL[varies]}s, so one ad set has nothing to compare against.`);
    return warnings;
  }
  const offTest = conceptBadges(concepts, testType).filter((badge) => badge.kind === "off-test").length;
  if (offTest > 0) {
    warnings.push(
      `${offTest} ad set${offTest === 1 ? "" : "s"} change more than the ${AXIS_LABEL[varies]}, so the result won't show what caused the difference.`,
    );
  }
  return warnings;
}

const needsQuoting = /[",\r\n]/;

/** One CSV cell. Cells that start with = + - @ get a leading apostrophe so spreadsheets don't run them as formulas. */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text))) text = `'${text}`;
  return needsQuoting.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface ExportAd {
  format: string;
  awareness: string;
  hook: string | null;
  notes: string | null;
}
export interface ExportConcept extends ConceptKey {
  startDate: string | null;
  endDate: string | null;
  spend: number | null;
  ads: ExportAd[];
}

/** A campaign as a spreadsheet: one row per ad (or one row for an ad set that has no ads yet). */
export function campaignToCsv(
  campaign: { name: string; testType: TestType; concepts: ExportConcept[] },
  labels: { avatar: (id: string) => string; angle: (id: string) => string; offer: (id: string) => string },
): string {
  const header = [
    "Campaign", "Test type", "Ad set", "Persona", "Angle", "Offer", "Start", "End", "Spend",
    "Ad", "Format", "Awareness", "Hook", "Notes",
  ];
  const rows: Array<Array<string | number | null>> = [];
  campaign.concepts.forEach((concept, index) => {
    const base = [
      campaign.name,
      TEST_TYPE_INFO[campaign.testType].label,
      index + 1,
      labels.avatar(concept.avatarId),
      labels.angle(concept.angleId),
      labels.offer(concept.offerId),
      concept.startDate,
      concept.endDate,
      concept.spend,
    ];
    if (!concept.ads.length) rows.push([...base, null, null, null, null, null]);
    concept.ads.forEach((ad, adIndex) => rows.push([...base, adIndex + 1, ad.format, ad.awareness, ad.hook, ad.notes]));
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
