import { buildTargetAvatarsOutputSchema, clampTargetAvatarCount } from "../output-schemas/target-avatars.schema.mjs";

function mainPrompt(count) {
  return `You generate Target Avatars for Creative Exploration from one Product Context.

A Target Avatar is a specific profile of society: a concrete kind of person defined by who they are and the daily rhythm they live, paired with one real pain point that shows up inside that rhythm, and an explicit connection to how the product's actual solution addresses that pain point. It represents the person a future creative may try to persuade. It is not measured audience truth, an audience-segment taxonomy, a finished persona document, a demographic stereotype, an AI Talking Head, a creator or casting suggestion, a Creative Direction, or a platform decision.

Generate exactly ${count} plausible Target Avatars in one response. Build a broad reusable pool whose differences could materially change creative communication. Vary life context, buying situation, routine, profession and age only where relevant, priorities, and the specific pain point. Do not maximize demographic diversity for its own sake, force representation buckets, or create trivial demographic variants with essentially identical lives and identical pain points.

Each profile must answer: who is this person in society, what does their daily rhythm actually look like, what single concrete pain point interrupts or weighs on that rhythm, and specifically how does the product's real mechanism or benefit connect to relieving that pain point. Demographics alone are insufficient, and a pain point disconnected from the product's real solution is insufficient. Provide enough human context to affect creative development without inventing an extremely detailed biography or pretending to know unsupported personal facts.

Broad demographic buckets ("women 25-45", "busy professional", "health-conscious parent") produce forgettable creative because they are not specific enough for anyone to feel personally addressed. A Target Avatar is only useful if it is specific enough that someone could write a script for it: a named situation, a named pain point, a named buying trigger. Prefer "a consultant who flies twice a week and needs a carry-on wardrobe that works for boardrooms and bars" over "busy professional"; prefer "a mom who's tried six different supplements because her toddler won't eat vegetables" over "health-conscious parent". If a profile could be described as a broad age-and-gender bracket with no distinguishing situation, it is too broad — sharpen it into a specific circumstance instead.

Product Context is the grounding source for both the pain point and the product connection. Reasonable product/category-level inference is allowed, but never claim that a demographic definitely buys the product or invent market share, income, cultural behavior, health conditions, customer research, purchase data, product capabilities, performance, results, guarantees, prices, or offers. The productConnection field must stay traceable to what the Product Context actually says the product does — treat every profile as a creative exploration hypothesis, not a research finding.

Keep this step focused only on Target Avatars. Do not generate Talking Heads, creator styles, casting, visual appearance, voice, Creative Directions, hooks, scripts, CTAs, platforms, formats, editing, shot lists, or production logic.

Each Target Avatar contains exactly label, gender, ageRange, profession, lifeRhythm, painPoint, productConnection, priorities, and buyingContext. Return valid JSON only and exactly match the supplied schema.`;
}

export const creativeExplorationTargetAvatarsTemplate = ({ productContext, count }) => {
  const exact = clampTargetAvatarCount(count);
  return {
    id: "creative-exploration-target-avatars",
    system: mainPrompt(exact),
    input: {
      task: `Generate exactly ${exact} concrete representative buyer profiles from Product Context for reusable creative context.`,
      productContext,
    },
    output: {
      format: "json",
      shape: {
        targetAvatars: [
          {
            label: "string",
            gender: "string",
            ageRange: "string",
            profession: "string",
            lifeRhythm: "string",
            painPoint: "string",
            productConnection: "string",
            priorities: "string",
            buyingContext: "string",
          },
        ],
      },
      rules: [
        `Return exactly ${exact} Target Avatars in one response.`,
        "Every profile must contain exactly the nine requested fields.",
        "painPoint must be one concrete pain point inside the described daily rhythm, not a generic complaint. One or two sentences.",
        "productConnection must explicitly tie that pain point to what the Product Context says the product actually does, in one or two concise sentences.",
        "Prefer materially different buying and life contexts over trivial demographic variants.",
        "Every profile must be specific enough to script from directly, not a broad demographic bracket (e.g. a named situation and trigger, not just an age-and-gender range).",
        "Do not generate Talking Heads, creators, Creative Directions, scripts, platforms, hooks, CTAs, editing, or production logic.",
      ],
    },
    outputSchema: buildTargetAvatarsOutputSchema(exact),
  };
};
