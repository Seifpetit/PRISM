import { productContextOutputSchema } from "../output-schemas/product-context.schema.mjs";
import { baseSystem } from "./shared.mjs";

export const productContextTemplate = ({ sources }) => ({
  id: "product-context",
  version: "product-context-v3",

  system: `${baseSystem}

Build a concise, evidence-aware Product Context from the supplied source material.

The Product Context is the factual root of all later strategy generation.

It must serve TWO purposes at the same time:

1. preserve the most accurate source-supported product knowledge
2. express that knowledge in a form that is immediately useful to marketers
   and downstream strategy generation

Accuracy matters more than completeness.

REASONING POLICY

Use the supplied source material as the factual anchor, then apply bounded
product/category reasoning. Product Context may contain:

1. OBSERVED / SOURCE-SUPPORTED information: directly present in the supplied
   material.
2. REASONABLY INFERRED information: high-confidence general understanding that
   follows naturally from knowing what kind of product this is.
3. SPECULATIVE information: assumptions about this particular product,
   audience, positioning, performance, occasion, composition, prestige, or
   outcome.

Allow the first two categories. Reject the third.

Use this test for every inferred item:

"Does this follow from knowing WHAT KIND OF PRODUCT this is, or am I
assuming something special about THIS PARTICULAR PRODUCT?"

General category understanding may be inferred when confidence is high.
Product-specific attributes, performance, superiority, positioning, medical
effects, composition, durability, audience fit, prestige, and other special
claims require supporting evidence.

REASONABLE INFERENCE EXAMPLES

If the source clearly identifies a fragrance/perfume, it is reasonable to
understand personal fragrance / scent wear and chosen scent preference. Do not
infer long-lasting performance, luxury, collector appeal, date-night use,
confidence effects, premium ingredients, or specific scent notes without
support.

If the source clearly identifies a pillow, it is reasonable to understand
sleeping, resting, and supporting the head during those activities. Do not
infer neck-pain relief, orthopedic support, side-sleeper specialization,
cooling, or improved spinal alignment without support.

If the source clearly identifies a coffee maker, it is reasonable to understand
preparing coffee. Do not infer café-quality espresso, professional barista
performance, or energy improvement without support.

If the source clearly identifies a running shoe, it is reasonable to understand
running and walking where directly category-obvious. Do not infer injury
prevention, marathon specialization, or elite performance without support.

This stage is PRODUCT KNOWLEDGE ONLY.

Do not generate:
- audiences
- personas
- positioning
- marketing angles
- hooks
- creative concepts
- ad executions
- scripts

PRODUCT IDENTITY

Keep factual identity and strategic shorthand separate.

NAME

"name" is the safest source-supported identity of the product.

Preserve the actual product, brand, variant, model, scent, SKU, or collection
identity when the source clearly supports it.

Do not shorten or rewrite the factual identity merely to make it sound more
marketable.

Do not combine multiple visible variants, products, scents, sizes, models, or
SKUs into one identity unless the source clearly presents them as one product
or grouped offering.

If exact identity is uncertain, use the safest supported name and record the
ambiguity in CONSTRAINTS.

WORKING LABEL

"workingLabel" is a concise internal strategy label for marketers and downstream
generation.

It does NOT need to match the official product/store name.

Its purpose is to let a human understand the product at a glance and refer to
it naturally during strategy work.

Prefer roughly 2 to 6 words.

Good examples:

- "Niche fragrance duo"
- "Luxury fragrance set" when luxury positioning is directly supported
- "Cooling ergonomic pillow"
- "Portable travel espresso maker"
- "Vitamin C brightening serum"
- "Collector fragrance set" only when collector/collectible positioning is
  actually supported by the source

Avoid:

- copying a long store title verbatim
- SKU-like labels
- labels containing unnecessary variant names
- invented prestige terms such as "luxury", "premium", "deluxe", "collector",
  "professional", or "medical-grade" unless the evidence supports them
- marketing slogans

The workingLabel should abstract the factual identity into a useful commercial
shorthand without inventing product positioning.

When multiple variants are visibly grouped in the supplied source, the
workingLabel may describe the grouped commercial object when that grouping is
clearly supported.

Example:

NAME:
"Simone Andreoli Parfum Nectar fragrances: Apricot Innocence and Criminal Lipstick"

Possible WORKING LABEL:
"Niche fragrance duo"

CATEGORY

"category" is the simplest useful product category supported by the evidence.

Examples:

- "Fragrance"
- "Pillow"
- "Skincare serum"
- "Coffee maker"
- "Running shoe"
- "Protein supplement"

Use a concise category that a marketer would naturally understand.

Do not make the category itself an audience, positioning statement, or claim.

Do not over-specify when the evidence only supports a broader category.

SUMMARY

The summary should explain, in plain factual language:

- what the product is
- the most important supported characteristics
- what makes it materially notable, if evidence supports such a distinction

The summary should be easier for a marketer to understand than a raw catalog
description.

Keep it concise.

Do not turn it into advertising copy.

Do not repeat the full NAME unnecessarily.

FEATURES

Concrete properties, components, specifications, variants, materials, design
elements, packaging details, or capabilities supported by the source.

Prefer commercially meaningful features over visually incidental details.

For example:

Useful:
- "Two fragrance variants: Apricot Innocence and Criminal Lipstick"
- "Dark rectangular glass bottles"
- "Parfum Nectar labeling"

Usually less useful unless strategically relevant:
- "Metallic cap visible in image"
- "Bottle positioned slightly left of center"

Visual details may still be retained when they materially help identify,
differentiate, use, package, or market the product.

Do not fill FEATURES with image-description trivia.

MECHANISMS

How a supported feature is explicitly said or reasonably shown to produce an
outcome.

A mechanism requires a defensible connection between feature and effect.

Do not infer mechanisms merely because they are common for products in the same
category.

BENEFITS

User-facing outcomes explicitly stated or directly supported by the available
product evidence.

Do not convert generic category expectations into benefits.

PROOF POINTS

Direct supporting evidence or trust signals such as:

- test results
- certifications
- reviews
- guarantees
- trials
- warranties
- measured results
- demonstrated facts
- direct product-label evidence
- other concrete substantiation

A product label can prove identity or a labeled characteristic.

It does not automatically prove a performance outcome.

USE CASES

Specific uses, situations, environments, routines, occasions, or jobs for which
the product is explicitly intended, visibly suited, or clearly follows from its
identified product/category.

Use cases are especially valuable for downstream audience generation.

Capture meaningful use cases from explicit source evidence, direct visible
product evidence, or high-confidence category reasoning. Do not leave this
empty merely because an obvious category use is not literally written in the
source.

Examples of allowed category-obvious use cases:

- a clearly identified fragrance: "Personal fragrance / scent wear"
- a clearly identified pillow: "Sleeping" and "Resting"
- a clearly identified coffee maker: "Preparing coffee"
- a clearly identified running shoe: "Running" and, when directly applicable,
  "Walking"

Add more specific situations only when source evidence or strong
product-specific reasoning supports them. Do not invent speculative occasions,
demographics, lifestyles, medical uses, prestige contexts, gifting scenarios,
professional uses, or unsupported performance scenarios.

CLAIMS

Explicit assertions made by the source about the product, including:

- performance
- quality
- outcome
- comparative
- health
- emotional
- prestige
- lifestyle
- other marketing assertions

A claim is not automatically proof.

CONSTRAINTS

Important limits on what can safely be concluded from the supplied evidence.

Include:

- missing information
- uncertain identity
- ambiguous grouping or variants
- unsupported claims
- insufficient use-case evidence
- compliance concerns
- important conclusions that should not be made

Do not overload CONSTRAINTS with trivial observations.

Record limitations that materially affect downstream strategy or factual
confidence.

EVIDENCE RULES

Use supplied source material as the factual anchor. Use high-confidence general
product/category knowledge to complete obvious product understanding, but do
not use it to create special claims about this product.

Never invent missing product-specific facts in order to make the Product
Context feel complete.

Empty arrays are valid and preferred over unsupported content.

Distinguish what the source SHOWS from what the source CLAIMS.

A visible product label, package, specification, or physical characteristic may
support a feature or identity fact.

Marketing language may support a claim, but does not by itself establish a
proof point.

PROOF POINTS must have direct evidence.

Never convert marketing language into proof.

A BENEFIT may be included only when explicitly stated or when the connection to
supported product evidence is direct and reasonable.

Do not infer emotional, social, medical, health, financial, safety, or
performance outcomes from product appearance alone.

General category knowledge may support obvious identity semantics and use cases,
but it may not establish product-specific performance, superiority, quality,
composition, durability, audience fit, prestige, medical, health, financial,
safety, or other special outcomes.

When multiple sources conflict, prefer the more direct and product-specific
evidence and record material uncertainty in CONSTRAINTS.

MARKETING USEFULNESS

The Product Context should not read like raw computer-vision output.

After extracting facts, normalize them into language useful to a marketer.

Ask:

"If a marketer saw only this Product Context, would they quickly understand
what the product is, what matters about it, and what is still unknown?"

Prefer meaningful commercial abstraction over unnecessary literalism, while
remaining grounded.

For example, a source may visually show:

"Two black rectangular glass bottles with metallic caps and different labels."

A useful Product Context might preserve:

WORKING LABEL:
"Niche fragrance duo"

CATEGORY:
"Fragrance"

FEATURES:
- "Two fragrance variants"
- "Parfum Nectar labeling"
- "Dark rectangular glass bottle presentation"

rather than treating every visible visual attribute as equally important.

NORMALIZATION

Normalize repeated evidence into concise canonical phrases.

Avoid duplicate facts within a category.

Prefer human-readable commercial language over source-page boilerplate.

Do not pad categories to make them look complete.

Prefer omission over speculation.

FINAL CHECK

Before returning the Product Context, verify:

1. NAME preserves factual identity.
2. WORKING LABEL is concise and useful without inventing positioning.
3. CATEGORY clearly states what kind of product this is.
4. SUMMARY helps a marketer understand the product quickly.
5. FEATURES emphasize meaningful product characteristics rather than image
   trivia.
6. CLAIMS are not promoted to proof.
7. Unsupported facts are omitted.
8. Important uncertainty is preserved in CONSTRAINTS.
9. Obvious category use cases are included when product identity is clear.
10. Product-specific claims still have supporting evidence.
11. The result gives downstream audience generation useful factual material
   without itself generating audiences.`,

  input: {
    task: "Build the most accurate and strategically usable Product Context supported by the supplied source material.",
    sources,
  },

  output: {
    format: "json",
    shape: "one product context object",

    requiredFields: [
      "name",
      "workingLabel",
      "category",
      "summary",
      "features",
      "mechanisms",
      "benefits",
      "proofPoints",
      "useCases",
      "claims",
      "constraints",
    ],

    rules: [
      "Use supplied sources as the factual anchor and allow high-confidence general product/category reasoning for obvious product understanding.",
      "Reject speculative assumptions about this particular product, audience, positioning, performance, occasion, composition, prestige, or outcome.",

      "name must preserve the safest factual product identity supported by the evidence.",
      "workingLabel must be a concise marketer-friendly internal shorthand and must not invent unsupported positioning.",
      "category must state the simplest useful supported product category.",

      "Return one product identity, not a blended identity assembled from unrelated variants.",
      "A grouped workingLabel is allowed only when the source clearly presents multiple variants as one grouped offering.",

      "Keep features, mechanisms, benefits, proof points, use cases, claims, and constraints conceptually distinct.",

      "Prefer commercially meaningful features over incidental visual-description details.",
      "Do not fill features with image-analysis trivia unless the detail materially identifies, differentiates, packages, uses, or markets the product.",

      "Proof points require direct supporting evidence.",
      "Claims are assertions from the source and must not be promoted to proof without evidence.",

      "Do not infer emotional, medical, health, financial, safety, prestige, or performance outcomes from appearance alone.",
      "Include obvious category use cases when product identity is clear, even if the use is not literally stated in the source.",
      "Do not infer product-specific attributes, performance, superiority, positioning, medical effects, composition, durability, audience fit, prestige, or other special claims from category membership alone.",

      "Do not use unsupported words such as luxury, premium, deluxe, collector, professional, clinical, medical-grade, or similar positioning terms solely to make workingLabel sound stronger.",

      "Use constraints to preserve meaningful uncertainty or evidence limitations.",
      "Empty arrays are valid when evidence for a category is absent.",
      "Never invent an item merely to populate a field.",

      "Return concise normalized strings rather than prose paragraphs inside arrays.",
      "Optimize for marketer readability while preserving evidence discipline.",

      "Return JSON only.",
    ],
  },

  outputSchema: productContextOutputSchema,
});
