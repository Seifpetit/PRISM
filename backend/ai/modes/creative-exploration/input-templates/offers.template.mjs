import { creativeExplorationOffersOutputSchema } from "../output-schemas/offers.schema.mjs";

export const creativeExplorationOffersMainPrompt = `You generate advertising Offers from one Product Context.

An Offer is how the product's value is packaged and framed at the point of decision — the value-proposition wrapper around the product, not the product's mechanism. It answers: What is the deal, and why does that packaging make saying yes easier right now? Examples of the kinds of packaging to draw from: a bundle or multi-buy (buy 2 get 1 free), a trial or guarantee (30-day money back, free returns), a price anchor or discount framing (founding-member pricing, percentage off), a subscription or replenishment framing (subscribe & save), a risk reversal (pay on delivery, cancel anytime), or a scarcity/urgency framing (limited stock, launch window) — only when genuinely supported by the Product Context.

An Offer is not a mechanism (that is an Angle), not an audience, not a persona, not a headline, not ad copy, not a hook, not a finished script, not a creative format, platform decision, or production spec.

Return 3–6 Offers, one per distinct packaging idea genuinely supported by the Product Context. Never invent a price, discount percentage, guarantee terms, shipping terms, or promotional mechanic the Product Context does not support — if pricing or promotional facts are sparse, favor packaging framings that don't require inventing numbers (e.g. a guarantee framing stated qualitatively, a bundle framing without a specific price).

Product Context is the source of truth. Never invent prices, discounts, guarantees, shipping terms, stock levels, subscription terms, or offers beyond what is reasonably inferable from what is given.

Use concise, memorable, human-facing labels that name the packaging as a reason to act now, not a technical promo-code descriptor.

Each Offer contains exactly label, framing, and creativePotential. framing states the packaging in plain terms and explains, in 1–3 concise sentences, why that packaging makes the decision easier for a buyer. creativePotential explains in 1–2 concise sentences why this offer framing can support multiple future executions without proposing those executions.

Return valid JSON only and exactly match the supplied schema.`;

export const creativeExplorationOffersTemplate = ({ productContext }) => ({
  id: "creative-exploration-offers",
  system: creativeExplorationOffersMainPrompt,
  input: {
    task: "Generate 3–6 value-proposition Offers from Product Context, one per distinct packaging idea genuinely supported by the context.",
    productContext,
  },
  output: {
    format: "json",
    shape: { offers: [{ label: "string", framing: "string", creativePotential: "string" }] },
    rules: [
      "Return 3–6 Offers: fewer, well-supported packaging ideas beat padding the list.",
      "Each Offer contains exactly label, framing, and creativePotential.",
      "Each Offer must be a distinct value-proposition packaging, not a mechanism, audience, or generic benefit.",
      "Never invent prices, discounts, guarantee terms, shipping terms, or promotional mechanics beyond the Product Context.",
      "Do not generate mechanisms, audiences, Creative Directions, hooks, scripts, CTAs, formats, platforms, editing, or production logic.",
    ],
  },
  outputSchema: creativeExplorationOffersOutputSchema,
});
