# 📋 Landing page copy inventory

Every piece of copy on `public/landing/index.html`, in page order: top to bottom, and left to right within a row. Elements that visually belong together (a card's label + heading + body, a chip's icon + filename) are grouped under one entry rather than split apart.

**Maintenance rule (append-only, no need to be perfect):** when copy is added to the page, add its entry to this file at the same rough position it occupies on the page — between whichever two existing entries it visually sits between. When copy is edited, edit its entry in place. When copy is removed, delete its entry. Don't renumber or reflow the rest of the file for this — a rough position is enough.

Format: `` `tag` "copy" `` — `file:line`

---

## 🏷️ Document metadata (`<head>`)
- `<title>` "prism — Chaos in. Clarity out." — `public/landing/index.html:7`
- `<meta name="description">` "Prism turns one product into a clear plan, ads that fit it, and results you can actually learn from. For people who'd rather have a system than a vibe." — `public/landing/index.html:8`
- `<meta property="og:title">` "prism — Chaos in. Clarity out." — `public/landing/index.html:9`
- `<meta property="og:description">` "Plan, make, ship and learn from your ads on one ordered board." — `public/landing/index.html:10`

## ⏭️ Skip link
- `<a class="skip">` "Skip to content" — `public/landing/index.html:400`

## 🧭 Page header
- `<a class="logo">` "prism" (with mark image) — `public/landing/index.html:405`
- `<nav>` "How it works" / "Receipts" / "House rules" — `public/landing/index.html:407-409`
- `<a class="btn btn--sm">` "Open Prism" — `public/landing/index.html:411`

## 🚀 Hero
- `<span class="mono tag">` "Marketing, organized" — `public/landing/index.html:421`
- `<h1>` "Chaos in." / "Clarity out." — `public/landing/index.html:422`
- `<p class="hero-side">` "Prism turns one product into a clear plan, ads that fit it, and results you can actually learn from. For people who'd rather have a system than a vibe." — `public/landing/index.html:426`
- `<a class="btn">` "Start with one product" — `public/landing/index.html:428`
- `<a class="btn btn--ghost">` "See how it works" — `public/landing/index.html:429`

## ⚙️ Hero — "the machine" (chaos → prism → order)
- `[role=img] aria-label` "Messy inputs like competitor screenshots, an old brand doc and random ad files flow into a prism and come out sorted into audiences, angles, offers and ads." — `public/landing/index.html:434`
- `<span class="machine-label">` "Your stuff" — `public/landing/index.html:435`
- `.chaos-empty` "Inbox zero." / "Everything's on the board" (shown once every chip is sorted) — `public/landing/index.html:437`
- 12 scattered input chips (`.chip-in`), left to right / top to bottom by their on-page position:
  - "competitor_ad (3).png" (PNG) — `public/landing/index.html:438`
  - "idea: tiktok??" (sticky note) — `public/landing/index.html:439`
  - "ad_v3_FINAL_final.mp4" (MP4) — `public/landing/index.html:440`
  - "37 tabs open" — `public/landing/index.html:441`
  - "boost post $50?" (sticky note) — `public/landing/index.html:442`
  - "brand_voice_2022.docx" (DOC) — `public/landing/index.html:443`
  - "reviews_export.csv" (CSV) — `public/landing/index.html:444`
  - "who even buys this" (sticky note) — `public/landing/index.html:445`
  - "notes from call.txt" — `public/landing/index.html:446`
  - "halden.co/linen-set" — `public/landing/index.html:447`
  - "discount maybe" (sticky note) — `public/landing/index.html:448`
  - "IMG_4471.heic" (IMG) — `public/landing/index.html:449`
- `.core` — prism icon, no text — `public/landing/index.html:451-454`
- Order board, four columns left to right:
  - **Audiences** (`03`) — `public/landing/index.html:457`
    - "Hot sleepers" / "MOST AWARE" — `public/landing/index.html:458`
    - "First apartment" / "PROBLEM-AWARE" — `public/landing/index.html:459`
    - "Considered buyer" / "SOLUTION-AWARE" — `public/landing/index.html:460`
  - **Angles** (`03`) — `public/landing/index.html:463`
    - "Sleep that breathes" / "HOT SLEEPERS" — `public/landing/index.html:464`
    - "Looks done, day one" / "FIRST APARTMENT" — `public/landing/index.html:465`
    - "Softer every wash" / "CONSIDERED" — `public/landing/index.html:466`
  - **Offers** (`03`) — `public/landing/index.html:469`
    - "100-night trial" / "RISK REVERSAL" — `public/landing/index.html:470`
    - "Starter bundle" / "BUNDLE" — `public/landing/index.html:471`
    - "Two free cases" / "GIFT" — `public/landing/index.html:472`
  - **Ads** (`03`) — `public/landing/index.html:475`
    - "UGC video" / "9:16 · 0:07" — `public/landing/index.html:476`
    - "Carousel" / "3 CARDS" — `public/landing/index.html:477`
    - "Static" / "1:1" — `public/landing/index.html:478`
- `[data-machine-status]` "Sorting 0 / 12" (static fallback; JS cycles this text — see Script-generated copy below) — `public/landing/index.html:482`
- `<span class="mono">` "One product in · one board out" — `public/landing/index.html:483`

## 😩 "Sound familiar?" section
- `<span class="mono tag">` "Sound familiar?" — `public/landing/index.html:492`
- `<h2>` "Your marketing, right now." — `public/landing/index.html:493`
- Six pain cards, reading order left-to-right / row by row:
  - "#01 · The inspo folder" / "37 tabs of competitor ads." / "Saved "for inspo." Never opened again." — `public/landing/index.html:496`
  - "#02 · Version control" / "ad_v3_FINAL_final.mp4" / "Which one actually ran? Nobody knows." — `public/landing/index.html:497`
  - "#03 · The mystery hit" / ""It just worked."" / "Your best ad ever, and zero idea why." — `public/landing/index.html:498`
  - "#04 · The strategy" / "Boost post. $50. Pray." / "Targeting: vibes. Budget: whatever's left." — `public/landing/index.html:499`
  - "#05 · The brand doc" / "Last edited in 2022." / "By someone who doesn't work here anymore." — `public/landing/index.html:500`
  - "#06 · The funnel" / "Spend → ??? → Revenue." / "The middle part is the whole job." — `public/landing/index.html:501`
- `<p class="big-line">` "Prism is the middle part." — `public/landing/index.html:504`

## 🛠️ "How it works" section (dark)
- `<span class="mono tag">` "How it works" — `public/landing/index.html:513`
- `<h2>` "Four steps. One board. Zero guesswork." — `public/landing/index.html:514`
- `<p>` "Every step is built from the one before it and stays linked to it. Scroll through one product going the whole way." — `public/landing/index.html:515`

### 📌 Pinned figure (left column)
- `<figure> aria-label` "One product moving through Plan, Make, Ship and Learn: audiences and angles, three ads, a production board, and a results chart whose winning ad traces back to its audience." — `public/landing/index.html:520`
- Fig tabs: "Plan" / "Make" / "Ship" / "Learn" — `public/landing/index.html:523-526`
- `<span class="fig-status">` "Halden Linen Set" — `public/landing/index.html:528`

**🔵 Plate 1 — Plan** (strategy graph, SVG text nodes, left to right):
- Column headers: "INPUT" / "AUDIENCES" / "ANGLES · OFFERS" — `public/landing/index.html:535-537`
- Product node: "PRODUCT" / "Halden Linen Set" / "Link · 6 photos · notes" — `public/landing/index.html:539-541`
- Row 1: "AUDIENCE · 01" / "Considered buyer" / "Solution-aware" → "ANGLE · OFFER" / "Softer every wash" / "Two free cases" — `public/landing/index.html:545-547`
- Row 2: "AUDIENCE · 02" / "First apartment" / "Problem-aware" → "ANGLE · OFFER" / "Looks done, day one" / "Starter bundle" — `public/landing/index.html:549-551`
- Row 3: "AUDIENCE · 03" / "Hot sleepers" / "Most aware" → "ANGLE · OFFER" / "Sleep that breathes" / "100-night trial" — `public/landing/index.html:553-555`

**🟣 Plate 2 — Make** (three ad mockups, left to right):
- Static ad: "HALDEN" / "Softer in year three than on day one." / "Shop the set →" — caption "Static · Considered buyer" — `public/landing/index.html:562-563`
- Carousel ad, 3 slides: "HALDEN" / "Your first bed that feels grown-up."; "01 / THE SET" / "Duvet. Sheet. Two cases. Done."; "02 / DELIVERY" / "One box. Made up by Friday." — caption "Carousel · First apartment" — `public/landing/index.html:566-572`
- UGC video ad: handle "@maya.sleeps" / captions "I stopped kicking off the duvet." / timestamp "0:07" — caption "UGC video · Hot sleepers" — `public/landing/index.html:575-576`

**🩷 Plate 3 — Ship** (production board):
- Columns: "Brief" (01) / "In review" (01) / "Live" (02) — `public/landing/index.html:583-585`
- Card: "Static · Hot sleepers" / "Cool side, all night." / "Due Fri" / "Brief" — `public/landing/index.html:587`
- Card: "Carousel · First apartment" / "Your first bed that feels…" / "2 comments" / "In review" — `public/landing/index.html:588`
- Card: "Static · Considered" / "Softer in year three…" / "Meta" / "Live" — `public/landing/index.html:589`
- Moving card: "UGC video · Hot sleepers" / "I stopped kicking off the…" / "0:07 · 9:16" / status cycles Brief → In review → Live — `public/landing/index.html:590`
- Activity log: "09:12 — Script drafted from angle "Sleep that breathes"" / "11:40 — Footage submitted · review requested" / "14:05 — Approved · published to Meta" — `public/landing/index.html:592-594`

**🟠 Plate 4 — Learn** (results chart):
- Headline stat: "3.8×" / "ROAS · UGC video" / "Last 14 days" — `public/landing/index.html:599`
- Side stats: "Spend" $1,240 / "Revenue" $4,712 / "Account avg" 1.4× — `public/landing/index.html:600`
- Chart axis: "4×" "3×" "2×" "1×" / "DAY 1" "DAY 14" — `public/landing/index.html:604-605`
- Chart end labels: "UGC 3.8×" / "Static 1.6×" / "Carousel 1.1×" — `public/landing/index.html:612-614`
- Lineage caption: "Traced from the result back to the audience" — `public/landing/index.html:618`
- Lineage chain: "Hot sleepers" → "Sleep that breathes" → "100-night trial" → "UGC video" → "3.8× ROAS" — `public/landing/index.html:620-624`

### 🪜 Scroll steps (right column, paired with the plates above)
- Step 01: "Plan · Strategy" / "Map who it's for before you spend a cent." / "Drop in a product link, photos, your notes. Prism lays out the audiences, the angle that reaches each one, and the offer that closes. One board, zero sticky notes." — `public/landing/index.html:636-638`
- Step 02: "Make · Creatives" / "Every angle becomes an ad." / "UGC scripts, statics, carousels, written for the person they're meant for, not for "everyone 18–65."" — `public/landing/index.html:641-643`
- Step 03: "Ship · Pipeline" / "Brief to live, minus the group chat." / "Production runs on the same board, so nothing drifts from the plan and nobody asks "wait, which version?"" — `public/landing/index.html:646-648`
- Step 04: "Learn · Performance" / "Every result traces back." / "When an ad wins, you see which audience and angle made it win. Your next move stops being a guess." — `public/landing/index.html:651-653`

## 🧾 Receipts section
- `<span class="mono tag">` "Learn from every dollar" — `public/landing/index.html:663`
- `<h2>` "Every dollar comes back with notes." — `public/landing/index.html:664`
- `<p>` "Most dashboards tell you what happened. Prism tells you why, and what to try next. Even the AI's own cost is itemized, to the fraction of a cent." — `public/landing/index.html:665`
- `[role=img] aria-label` "A results receipt: $1,240 spent, $4,712 revenue, 3.8 times return. What worked, what didn't, the next move, and the AI cost of $0.4182." — `public/landing/index.html:668`
- Receipt body, top to bottom:
  - "prism" — `public/landing/index.html:669`
  - "RESULT RECEIPT · #0042" — `public/landing/index.html:670`
  - "Halden Linen Set · 14 days" — `public/landing/index.html:671`
  - "Spend" $1,240.00 — `public/landing/index.html:673`
  - "Revenue" $4,712.00 — `public/landing/index.html:674`
  - "Return" 3.8× — `public/landing/index.html:675`
  - "WHAT WORKED" / "✓ Hot sleepers × "Sleep that breathes"" / "✓ UGC beat static by 2.4×" — `public/landing/index.html:677-679`
  - "WHAT DIDN'T" / "× Carousel for first apartment · 1.1×" — `public/landing/index.html:680-681`
  - "NEXT MOVE" / "→ Same angle, new hook, Reels 9:16" — `public/landing/index.html:682-683`
  - "AI cost, itemized" $0.4182 — `public/landing/index.html:685`
  - "THANK YOU FOR LEARNING" — `public/landing/index.html:687`

## 📈 "Level up" / scale section
- `<span class="mono tag">` "Level up" — `public/landing/index.html:696`
- `<h2>` "Start with one product. Scale to all of them." — `public/landing/index.html:697`
- Four cards, left to right:
  - Visual "halden.co/linen-set" / "01 · Start" / "One link is enough." / "Paste a product page, add photos and notes. Confirm what Prism found, then build the board." — `public/landing/index.html:701-704`
  - Visual four-color grid / "02 · Grow" / "A board for every product." / "Your whole catalog in one workspace, each product with its own plan and its own history." — `public/landing/index.html:708-710`
  - Visual "Shopify" → "prism" → "Meta" / "03 · Connect" / "Results flow back in." / "Shopify and Meta data land on the board that made the ad, so it learns as you spend." — `public/landing/index.html:713-716`
  - Visual "OpenAI" "Anthropic" (selected) "Gemini" "DeepSeek" "Perplexity" / "04 · Tune" / "Pick your models." / "Choose the AI provider per task. Prism only offers the ones that can read what you gave it." — `public/landing/index.html:719-722`

## 📜 House rules section
- `<span class="mono tag">` "House rules" — `public/landing/index.html:731`
- `<h2>` "How Prism behaves." — `public/landing/index.html:732`
- Rules list, in order:
  - "01" / "Every ad has a reason you can read." — `public/landing/index.html:735`
  - "02" / "You confirm the product before anything gets built." — `public/landing/index.html:736`
  - "03" / "Spend is itemized. Including ours." — `public/landing/index.html:737`
  - "04" / "Results go back into the plan." — `public/landing/index.html:738`

## 📣 Final call to action
- `<span class="mono tag">` "Your move" — `public/landing/index.html:745`
- `<h2>` "Get your marketing in order." — `public/landing/index.html:746`
- `<p>` "Bring one product. Leave with a plan, the ads, and a way to learn from every dollar." — `public/landing/index.html:748`
- `<a class="btn">` "Start with one product" — `public/landing/index.html:750`

## 🦶 Footer
- `<a class="logo">` "prism" — `public/landing/index.html:758`
- `<span class="mono">` "Plan → Make → Ship → Learn" — `public/landing/index.html:759`
- `<span class="mono">` "© 2026" — `public/landing/index.html:760`

## 🤖 Script-generated copy (`<script>`)
Text written into the DOM at runtime rather than present in the markup:
- Hero machine status line, cycles through: "Sorting 1 / 12" … "Sorting 12 / 12" → "Sorted 12 / 12 · board ready" → back to "Sorting 0 / 12" — template at `public/landing/index.html:807,811,821`
