# Creative Strategy Framework — 2026 Meta Ads Playbook

Source: [YouTube — the 2026 Meta ads creative playbook](https://www.youtube.com/watch?v=vUbLw80KTpo) (agency owner, ~9 years media buying). Saved 2026-09-17 as the frameworks reference behind PRISM's Creative Exploration prompts (`backend/ai/modes/creative-exploration/input-templates/`).

Timestamped link: [39:43 — testing priority / concept architecture section](https://www.youtube.com/watch?v=vUbLw80KTpo&t=2383s)

## Why creative is the growth lever

Media-buying arbitrage has compressed — Andromeda auto-targets off creative content rather than interest targeting, so creative quality, volume, and diversity are now the main lever available to advertisers, not audience/bid tricks.

## How Andromeda actually works

You no longer pick an audience and load creative into it — you load creative and Meta finds the audience from the creative's content (transcript, copy, historical conversion patterns).

**Practical implication: the creative IS the targeting.** Similar creatives get bundled to the same audience (raises frequency, caps reach); diverse creatives reach diverse audiences. Keep one concept per ad set — mixing concepts under one ad set confuses targeting and destroys attribution/learning.

## Concept architecture: Persona × Angle × Offer

A **concept** is the combination of:
- **Persona** — who is this, specifically (not a demographic bracket)
- **Angle** — the mechanism/argument, framed and sold
- **Offer** — the product and its value-proposition packaging

Changing any one of the three reaches a different pool of people.

**Testing priority when something underperforms** (highest leverage first):

1. **Angle** — the message/argument. Highest priority: you can sell to any persona that's already proven to buy, so if it's not working it's usually an angle or offer problem, not the persona.
2. **Offer** — the product + value-prop framing. Important, but limited: you only have so many ways to repackage one or two products.
3. **Persona** — switching who you target. Gives breadth and volume once angle/offer are dialed in.
4. **Format** — lowest leverage. Format alone rarely fixes a bad ad; the script/argument does. Most teams test in the *reverse* of this order (format first, angle last) — that's backwards.

## Persona specificity

The #1 mistake in concept building. Broad demographic buckets ("women 25-45", "busy professional", "health-conscious parent") produce forgettable, unscalable creative because nobody feels personally addressed.

Good personas are hyper-specific situations defined by **problem, desire, buying trigger, language, and proof needed**:
- ❌ "busy professional" → ✅ "a consultant who flies twice a week and needs a carry-on wardrobe that works for boardrooms and bars"
- ❌ "health-conscious parent" → ✅ "a mom who's tried six different supplements because her toddler won't eat vegetables"

*Applied in PRISM*: `target-avatars.template.mjs` explicitly rejects broad-bracket avatars in favor of specific, scriptable situations.

## Angle: the persuasion-technique toolkit

Distinct from "format," an angle's persuasive approach can draw from:

- **Problem agitation** — lead with the pain until the viewer feels seen, then relieve it
- **Contrarian truth** — challenge a common assumption, then reframe
- **Curiosity gap** — open a question the creative only answers at the end
- **Social proof / authority** — credibility from people or data like this persona
- **Comparison / objection handling** — this vs. what they've already tried
- **Transformation** — a concrete before/after (best-performing, but Meta restricts it)

**Persona callouts underperform problem agitation.** "If you're a busy mom, listen up" converts worse than simply agitating her exact problem — people don't want to be labeled, they want to feel understood.

*Applied in PRISM*: `creative-concepts.template.mjs` asks for a mix of these approaches across concepts for one angle × avatar combo, and to lead with the problem, not a callout.

## Hook quality rubric

The first 2–3 seconds decide ~80% of drop-off. Grade a hook on:

| Criterion | What it means |
|---|---|
| **Clarity** | A stranger understands it instantly |
| **Relevance** | Problem-agitation, not a persona callout |
| **Novelty** | Says something not done a million times (purple-ocean positioning) |
| **Specificity** | Numbers, names, or concrete outcomes beat vague claims |
| **Credibility** | A visual authority marker (relevant expert, famous name, hard data) |

You don't need a 10/10 on every axis — a couple done well is enough.

*Applied in PRISM*: `creative-directions.template.mjs` grades the `hook` field against clarity/relevance/specificity.

## The bridge (hook → body → product)

Don't jump straight from hook to product pitch — an abrupt step-change in product-awareness kills otherwise-good ads.

Move the viewer through **unaware → problem-aware → solution-aware → product-aware** progressively. Introduce the product as late as reasonable for top-of-funnel/educational formats (this is why VSLs work so well) — it produces higher-intent viewers at the point of pitch, even though total reach of the pitch is smaller.

*Applied in PRISM*: `creative-directions.template.mjs` requires the `beats` field to bridge gradually rather than jumping straight to the pitch.

## Format: the lowest-leverage diversity axis

Format is priority #4 (after persona/angle/offer) — changing format alone reaches a different audience only weakly if persona/angle/offer stay the same.

Pick format by:
- Does the concept need **education**? → longer form / video
- Can the value prop fit in **one frame**? → image / carousel (cheap to produce, often outperforms video on cost-adjusted return)
- What **awareness stage** is this for? Bottom-of-funnel can be images/DPA; top-of-funnel unaware benefits from longer educational formats

Static image ads are underrated — "statics don't work" is a skill issue, not a format limitation.

## Other concepts (not yet built into PRISM)

Noted for future iterations:

- **Portfolio management** — many ads holding spend beats one/two ads holding everything; de-risks fatigue.
- **Volume target** — roughly 1 new ad per $1,000/month spend, or better: `(new-customer revenue target) / (avg ROAS × avg spend-per-ad)`.
- **Amount spent > ROAS as a proxy** — Meta's attribution is multi-touch, not last-click, so amount-spent is a better ad-level performance signal than ROAS; trust ad-set/campaign-level ROAS over ad-level ROAS.
- **Content-type allocation** — winning-content replication (highest leverage) > iterative fixes > net-new concepts (lowest, but must not be zero).

## The campaign builder (2026-09-19)

Strategy Lineage mode and the AI "Creative Concept" step were removed. PRISM now works only in the model above:

- A **concept is the filled equation** (persona x angle x offer), created by the user, not by the AI, and **one
  concept is one Meta ad set**.
- A **campaign** is a test plan with a test type (angle, offer or persona: the one axis its ad sets vary, in the
  framework's priority order). The test type steers rather than blocks: the composer starts on the campaign's
  own axis in the framework's testing order (angle, then offer, then persona), and anything else you change is
  flagged as off-test. The first ad set is the baseline the others are measured against.
- **Ads** live inside a concept as slots with six dimensions: awareness stage, direction (the concrete execution
  idea), format, hook, beats (the bridge from hook to product and offer) and a call to action, plus notes. The
  persona, angle and offer are fixed by the ad set; an ad only chooses how to execute them. Format and awareness
  vary inside a concept, not between concepts, because format is the lowest-leverage axis. Awareness shapes the
  bridge: less-aware ads bring the product and the offer in late, and never open with the offer.
- Ads are planned in the ad-set drawer and developed in the Creatives workspace (a track per ad set, ads as cards, a drawer per ad; one ad set at a time, the concept
  read-only). "Generate ads" opens a small panel asking what to optimise for (a format to fix, VSLs, how many ads, one ad per awareness stage) and then asks the AI for executions of the concept (`ad-plan.template.mjs`,
  editable like the other prompts); it is a plan, not a Format x Awareness grid. Strategy defines the argument,
  Creatives explores how to express it, and production (assets, scripts, platform versions) comes after.
- Each ad carries a short title naming its creative idea, and the plan prompt asks for a different idea per ad (two
  ads may share an awareness stage when their ideas differ). The selected ad in Creatives reads as a brief (idea, hook,
  message sequence, CTA) and is edited in place. "Hook alternatives" (`ad-hooks.template.mjs`) writes other ways to
  open one ad and saves nothing until one is picked. Both prompts are editable from the Prompt button in Creatives.
- Deleting a persona, angle or offer does not delete the ad sets built from it. The ad set keeps its ads, its ad-set
  card shows that ingredient as removed (no wire, a dead port), and the ad-set drawer lets you link another persona,
  angle or offer in its place. Only a removed ingredient can be relinked, and never into a duplicate of another ad
  set in the same campaign.
- The older Creative Directions prompt (`creative-directions.template.mjs`, production-level briefs with b-roll and
  editing notes) is kept in the repo, unused, for that later production step.
- Each ad set can carry start/end dates and spend, so a sales window can later trace back to it.

Code: `lib/campaign-rules.ts` (pure rules, tested), `backend/database/campaigns-repository.mjs` (migration
`013_campaigns.sql`), `store/campaign-slice.ts`, and `components/campaign/`.

## What shipped in PRISM off this

All changes below are prompt-text only — no schema or field changes:

- `backend/ai/modes/creative-exploration/input-templates/target-avatars.template.mjs` — persona specificity mandate
- `backend/ai/modes/creative-exploration/input-templates/creative-concepts.template.mjs` — persuasive-approach diversity + problem-agitation-over-callout
- `backend/ai/modes/creative-exploration/input-templates/creative-directions.template.mjs` — hook rubric + bridge sequencing
- `store/use-app-store.ts` — Target Avatars now auto-generate on product creation (`createProduct` / `createProductFromContext`) instead of requiring a manual first click; Regenerate/Reset are unchanged.
