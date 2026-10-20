// What the person asked for when generating ads for an ad set: a format to fix (AI talking head), VSLs, how many ads,
// one ad per awareness stage, or a stage to fix, and a free note to optimise for. Validated here, written into the
// prompt as constraints, and checked against what the model returned, so a plan that ignores the request is asked for
// again instead of being saved. The persona, angle and offer are never options: they stay fixed.

import { AD_PLAN_AWARENESS, AD_PLAN_FORMATS } from "./output-schemas/ad-plan.schema.mjs";

export const AD_PLAN_STRUCTURES = ["short", "vsl"];
/** The stage value that means "each ad at a different stage". */
export const AWARENESS_SPREAD = "spread";
export const MAX_NOTE_LENGTH = 300;
/** A VSL is a long-form video: only these formats carry one. */
export const VSL_FORMATS = ["video", "ugc_video", "ai_talking_head"];
const MIN_COUNT = 2;
const MAX_COUNT = 6;
const MIN_VSL_BEATS = 5;

function invalid(message) {
  const error = new Error(message);
  error.code = "INVALID_AD_PLAN_OPTIONS";
  return error;
}

/**
 * The options as the client sent them, checked and tidied. Returns null when nothing was asked for, so the default
 * plan is exactly what it was before options existed. Throws (INVALID_AD_PLAN_OPTIONS) on a value that makes no sense.
 */
export function normalizeAdPlanOptions(raw) {
  if (!raw) return null;
  const format = raw.format ? String(raw.format) : null;
  if (format && !AD_PLAN_FORMATS.includes(format)) throw invalid(`"${format}" is not an ad format.`);

  const awareness = raw.awareness ? String(raw.awareness) : null;
  if (awareness && awareness !== AWARENESS_SPREAD && !AD_PLAN_AWARENESS.includes(awareness)) throw invalid(`"${awareness}" is not an awareness stage.`);

  const structure = raw.structure ? String(raw.structure) : "short";
  if (!AD_PLAN_STRUCTURES.includes(structure)) throw invalid(`"${structure}" is not an ad structure.`);
  if (structure === "vsl" && format && !VSL_FORMATS.includes(format)) throw invalid("A VSL is a video: choose a video, UGC video or AI talking head format, or let the AI choose.");

  let count = raw.count === undefined || raw.count === null ? null : Number(raw.count);
  if (count !== null && (!Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT)) throw invalid(`Ask for between ${MIN_COUNT} and ${MAX_COUNT} ads.`);
  if (awareness === AWARENESS_SPREAD) {
    // One ad per stage: there are only four stages, so no more than four ads, and four when no number was given.
    if (count !== null && count > AD_PLAN_AWARENESS.length) throw invalid(`There are only ${AD_PLAN_AWARENESS.length} awareness stages, so at most ${AD_PLAN_AWARENESS.length} ads can each be at a different one.`);
    count ??= AD_PLAN_AWARENESS.length;
  }

  const note = typeof raw.note === "string" ? raw.note.replace(/\s+/g, " ").trim().slice(0, MAX_NOTE_LENGTH) : "";
  const options = { format, awareness, count, structure, note: note || null };
  const nothing = !format && !awareness && count === null && structure === "short" && !note;
  return nothing ? null : options;
}

/** Plain sentences the model must follow, one per thing asked for. */
export function adPlanConstraints(options) {
  if (!options) return [];
  const sentences = [];
  if (options.count) sentences.push(`Return exactly ${options.count} ads.`);
  if (options.format) sentences.push(`Every ad's format must be "${options.format}". Use no other format.`);
  if (options.awareness === AWARENESS_SPREAD) {
    sentences.push(
      `Put every ad at a different awareness stage (${options.count} different stages out of ${AD_PLAN_AWARENESS.join(", ")}). This is what the person chose, so it overrides the guidance about not spreading ads across stages: still make each ad a different creative idea whose bridge to the product fits its own stage.`,
    );
  } else if (options.awareness) {
    sentences.push(`Every ad must be at the "${options.awareness}" awareness stage.`);
  }
  if (options.structure === "vsl") {
    sentences.push(
      `Every ad is a VSL: a long-form video sales letter, told to camera or in voice-over, that moves from the hook through the problem and the mechanism to the solution, the offer and the call to action. Write 6 to 8 beats, each one concrete section of the script, and say in the direction that it is a VSL.${options.format ? "" : ` Use a video format (${VSL_FORMATS.join(", ")}).`}`,
    );
  }
  if (options.note) {
    sentences.push(`Also optimise the plan for this, in the person's words: "${options.note}". It must not change the persona, angle or offer, and must not invent facts.`);
  }
  return sentences;
}

/** A short line for the person, and for logs: what was asked. */
export function describeAdPlanOptions(options) {
  if (!options) return "the AI's own choice";
  return adPlanConstraints(options).join(" ");
}

/**
 * Throws (AD_PLAN_OPTIONS_NOT_MET) when the plan does not do what was asked. Thrown inside the parse step, so the
 * generation is retried rather than saved. Deterministic things are checked exactly; what a note means is not.
 */
export function checkAdPlanAgainstOptions(output, options) {
  if (!options) return output;
  const fail = (message) => {
    const error = new Error(`The generated ad plan did not follow the request: ${message}`);
    error.code = "AD_PLAN_OPTIONS_NOT_MET";
    throw error;
  };
  const ads = output.ads;
  if (options.count && ads.length !== options.count) fail(`expected ${options.count} ads, got ${ads.length}.`);
  if (options.format && ads.some((ad) => ad.format !== options.format)) fail(`every ad should be ${options.format}.`);
  if (options.awareness === AWARENESS_SPREAD && new Set(ads.map((ad) => ad.awareness)).size !== ads.length) fail("the ads should each be at a different awareness stage.");
  if (options.awareness && options.awareness !== AWARENESS_SPREAD && ads.some((ad) => ad.awareness !== options.awareness)) fail(`every ad should be ${options.awareness}.`);
  if (options.structure === "vsl") {
    if (ads.some((ad) => !VSL_FORMATS.includes(ad.format))) fail("a VSL needs a video format.");
    if (ads.some((ad) => ad.beats.length < MIN_VSL_BEATS)) fail(`a VSL needs at least ${MIN_VSL_BEATS} beats.`);
  }
  return output;
}
