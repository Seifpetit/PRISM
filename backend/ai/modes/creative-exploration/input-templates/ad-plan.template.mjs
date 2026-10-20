import {
  AD_PLAN_AWARENESS,
  AD_PLAN_FORMATS,
  creativeExplorationAdPlanOutputSchema,
} from "../output-schemas/ad-plan.schema.mjs";
import { adPlanConstraints } from "../ad-plan-options.mjs";

export const creativeExplorationAdPlanMainPrompt = `You plan the ads inside one ad set.

An ad set is one strategic concept: a Persona (who it is for), an Angle (the mechanism, framed and sold) and an Offer (how the deal is packaged). Those three are FIXED. Your job is to propose several different ways to execute that same concept as ads, without changing the persona, the angle or the offer. Two ads in this plan must never be two different arguments; they are two executions of one argument.

Each ad is one slot with a title and six dimensions:

- title: a short name for the creative idea this ad expresses, 2-6 words, like a chapter title ("The Electricity Bill Mystery", "No-Rewiring Demonstration"). It names the scenario, not the format and not the persona.
- awareness: where the viewer is before the ad, one of: ${AD_PLAN_AWARENESS.join(", ")}.
  - unaware: does not recognize the problem yet. The ad's job is to make the situation recognizable. Do not mention the product early.
  - problem_aware: knows the problem but not the solution. The ad's job is to explain why the problem happens or persists.
  - solution_aware: knows solution approaches. The ad's job is to show why this kind of solution, and this mechanism, matters.
  - product_aware: knows the product. The ad's job is to demonstrate it and answer objections; the offer can carry more weight.
- direction: the concrete execution idea in 1-3 sentences: the scenario, device or situation that communicates the angle to this persona. It is not a restatement of the angle and not a mood.
- format: exactly one of: ${AD_PLAN_FORMATS.join(", ")}.
  - photo / static_ad: one still image. carousel: a swipe sequence. video: a produced short video. ugc_video: creator-style and unpolished on purpose. ai_talking_head: a synthetic presenter to camera. motion_graphic: type, shapes and data in motion, no filmed footage.
  - Choose the format by how much education the concept needs at that awareness stage. Longer, more educational formats suit less aware viewers; short or still formats suit more aware viewers.
- hook: the first 2-3 seconds, or the first frame: exactly what is seen and/or said. A strong hook is clear (a stranger understands it instantly), relevant (it agitates the persona's specific problem instead of calling out who they are) and specific (a concrete detail beats a vague claim). It is not a persona callout and not generic curiosity.
- beats: 3-6 ordered beats from the hook to the end, one concrete sentence each. Bridge gradually: build the viewer's awareness of the problem and the mechanism first, and introduce the product only once that awareness is earned. For unaware and problem_aware ads, the product and the offer come late. Never open a less-aware ad with the offer. Only product_aware ads can compress the jump from hook to offer, and even then it must not feel abrupt. The last beat presents the offer as it is packaged, without inventing terms.
- cta: one short call to action grounded in the offer, for example "Explore the 3-for-2 bundle". No platform button names.

Across the ads, each one must be a different creative idea: a different scenario, device or situation in its direction. Vary awareness and format where it serves the ideas, but do not spread ads across awareness stages just to fill them. Two ads may share an awareness stage when their ideas differ, and that is often better than a different stage each. This is a plan, not a grid: never one ad for every awareness and format combination, and never the same idea twice. If existing ads are given, propose ideas that are different from theirs.

Ground everything in the Product Context, the Angle, the Offer and the Persona. Never invent product capabilities, performance or scientific claims, results, testimonials, guarantees, prices, discounts or facts about the persona.

Return valid JSON only and exactly match the supplied schema.`;

export const creativeExplorationAdPlanTemplate = ({ productContext, angle, offer, avatar, existingAds = [], options = null } = {}) => {
  // What the person asked for (a format, VSLs, how many ads, a stage per ad, a note). It rides in the input, not the
  // system prompt, so an edited prompt in Settings keeps working and the request is always the latest.
  const request = adPlanConstraints(options);
  const asked = request.length > 0;
  return {
  id: "creative-exploration-ad-plan",
  system: creativeExplorationAdPlanMainPrompt,
  input: {
    task: options?.count ? `Plan ${options.count} ads that execute this one ad set. Keep the persona, angle and offer fixed.` : "Plan 3-4 ads that execute this one ad set, each a different creative idea. Keep the persona, angle and offer fixed.",
    productContext,
    angle,
    offer,
    targetAvatar: avatar,
    existingAds,
    ...(asked ? { personRequest: request } : {}),
  },
  output: {
    format: "json",
    shape: {
      ads: [
        {
          title: "string, 2-6 words naming the creative idea",
          awareness: `one of: ${AD_PLAN_AWARENESS.join(" | ")}`,
          format: `one of: ${AD_PLAN_FORMATS.join(" | ")}`,
          direction: "string",
          hook: "string",
          beats: ["string"],
          cta: "string",
        },
      ],
    },
    rules: [
      asked ? "Follow personRequest exactly. It overrides the default number of ads and the default variety between them; everything else below still applies." : "Return 3-4 ads. Fewer, well-differentiated ads beat padding.",
      "Every ad executes the same persona, angle and offer. Never change them.",
      "Every ad is a different creative idea, named by its title. Awareness and format may vary, and two ads may share a stage when their ideas differ. Never a full grid.",
      "The hook agitates a specific problem; it is not a persona callout and not generic curiosity.",
      "Bridge from hook to product deliberately. Less-aware ads introduce the product and the offer late; never offer-first.",
      "Do not invent prices, discounts, guarantees, results, testimonials or product capabilities.",
      "Do not choose platforms and do not write production specs. Plan the execution, not the media buy.",
    ],
  },
  outputSchema: creativeExplorationAdPlanOutputSchema,
  };
};
