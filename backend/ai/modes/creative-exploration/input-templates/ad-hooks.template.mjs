import { creativeExplorationAdHooksOutputSchema } from "../output-schemas/ad-hooks.schema.mjs";

export const creativeExplorationAdHooksMainPrompt = `You write alternative hooks for one ad.

An ad set is one strategic concept: a Persona (who it is for), an Angle (the mechanism, framed and sold) and an Offer (how the deal is packaged). The ad you are given is one execution of that concept, with its own awareness stage, format, direction (the scenario that carries the angle), current hook and message sequence. All of that is FIXED. Only the hook changes.

The hook is the first 2-3 seconds of a video, or the first frame and headline of a still or carousel: exactly what is seen and/or said first. Write hooks for THIS ad's format: a spoken or seen moment for video formats, a headline for a static ad or photo, the first card for a carousel.

A strong hook is:
- clear: a stranger understands it instantly, with no context;
- relevant: it agitates the persona's specific problem or situation instead of calling out who they are ("Attention apartment renters" is a callout, not a hook);
- specific: a concrete detail beats a vague claim or generic curiosity. Use numbers only when the Product Context supplies them.

Respect the ad's awareness stage. For unaware and problem_aware ads the hook must not name the product or the offer. For solution_aware ads it may point at the kind of solution, not the product. Only product_aware hooks may mention the product or the offer.

Return several alternatives that are genuinely different approaches to opening THIS same ad, not rewordings of one sentence. For example: a concrete scene, a spoken line, a blunt statement of the problem, a question, a surprising detail. Keep each one true to the direction and the message sequence, so the rest of the ad still follows from it. Do not repeat the current hook.

Ground everything in the Product Context, the Angle, the Offer and the Persona. Never invent product capabilities, performance or scientific claims, results, testimonials, guarantees, prices or discounts.

Return valid JSON only and exactly match the supplied schema.`;

export const creativeExplorationAdHooksTemplate = ({ productContext, angle, offer, avatar, ad } = {}) => ({
  id: "creative-exploration-ad-hooks",
  system: creativeExplorationAdHooksMainPrompt,
  input: {
    task: "Write 5 alternative hooks for this one ad. Keep its awareness stage, format, direction and message sequence. Change only how it opens.",
    productContext,
    angle,
    offer,
    targetAvatar: avatar,
    ad,
  },
  output: {
    format: "json",
    shape: { hooks: ["string"] },
    rules: [
      "Return 5 hooks. Each is a different approach, not a rewording.",
      "Write for the ad's format; do not change the format, direction or awareness stage.",
      "A hook agitates a specific problem; it is not a persona callout and not generic curiosity.",
      "Do not mention the product or the offer unless the ad is product_aware.",
      "Do not repeat the current hook.",
      "Do not invent prices, discounts, guarantees, results, testimonials or product capabilities.",
    ],
  },
  outputSchema: creativeExplorationAdHooksOutputSchema,
});
