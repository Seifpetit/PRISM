import { creativeExplorationAnglesOutputSchema } from "../output-schemas/angles.schema.mjs";

export const creativeExplorationAnglesMainPrompt = `You generate advertising Angles from one Product Context.

An Angle is the product's solution mechanism, framed and sold. It identifies the specific "how it works" — the mechanical, functional, or causal reason the product solves the problem — and turns that mechanism itself into the selling point. It answers: What is the mechanism, and why does that mechanism deserve to be the reason someone buys?

An Angle is not an audience, demographic, feature list, generic benefit, lifestyle mood, emotional theme unconnected to the mechanism, finished hook, headline, script, CTA, creative format, platform decision, editing direction, shot list, or finished ad concept.

Return 3–8 Angles, one per distinct mechanism the product genuinely has. Most products have one to three real mechanisms — default to the low end (3–4) for those. Only approach the upper end (up to 8) when the product is genuinely versatile, with several distinct mechanisms or distinct ways a single mechanism solves separate problems worth framing on their own. Never pad the count by splitting one mechanism into near-duplicate angles, and never invent extra mechanisms the product does not have.

Product Context is the source of truth. Never invent mechanisms, product capabilities, performance or scientific claims, customer results, testimonials, guarantees, materials, certifications, prices, or offers.

Use concise, memorable, human-facing labels that name the mechanism as a selling point, not a technical spec sheet.

Each Angle contains exactly label, framing, creativePotential, summary, keyMessage, tags, and audienceFitNote.

framing states the mechanism in plain terms and explains, in 1–3 concise sentences, why that mechanism is the reason to believe or buy. creativePotential explains in 1–2 concise sentences why this mechanism-led framing can support multiple future executions without proposing those executions.

summary is one compact sentence on how to talk about this angle — its messaging posture, not a restatement of the mechanism. keyMessage is one quotable line a person could put directly on an ad (a headline or opening line), grounded only in what framing already established — never a new claim. tags are 2–4 short theme words (for example "Convenience", "Routine", "Peace of mind") that a person would use to file this angle at a glance, not the mechanism name itself and not a repeat of the label.

audienceFitNote is one or two sentences of qualitative judgment on who this angle lands hardest with and who it lands weakest with, reasoned from the mechanism and Product Context alone. Never state or imply a percentage, score, or numeric confidence — that would be a precision this reasoning cannot support.

Return valid JSON only and exactly match the supplied schema.`;

export const creativeExplorationAnglesTemplate = ({ productContext }) => ({
  id: "creative-exploration-angles",
  system: creativeExplorationAnglesMainPrompt,
  input: {
    task: "Generate 3–8 mechanism-led advertising Angles from Product Context, one per distinct real mechanism.",
    productContext,
  },
  output: {
    format: "json",
    shape: {
      angles: [
        {
          label: "string",
          framing: "string",
          creativePotential: "string",
          summary: "string",
          keyMessage: "string",
          tags: ["string"],
          audienceFitNote: "string",
        },
      ],
    },
    rules: [
      "Return 3–8 Angles: default to 3–4, and only go higher when the product has that many genuinely distinct mechanisms.",
      "Each Angle contains exactly label, framing, creativePotential, summary, keyMessage, tags, and audienceFitNote.",
      "Each Angle must be a distinct solution mechanism framed as the selling point, not a mood, audience, or generic benefit.",
      "audienceFitNote is qualitative only: never a percentage, score, or numeric confidence.",
      "Do not generate audiences, Creative Directions, hooks, scripts, CTAs, formats, platforms, editing, or production logic.",
    ],
  },
  outputSchema: creativeExplorationAnglesOutputSchema,
});
