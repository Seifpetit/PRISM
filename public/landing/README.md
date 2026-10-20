# 🔺 prism landing page

**📋 Copy:** every string of text on this page, in page order, with an exact file/line reference, lives in [LANDING_COPY.md](LANDING_COPY.md). Update that file whenever you change copy here.

Static, single-file page: `index.html` (inline CSS and vanilla JS, no build step). Fonts load from Google Fonts (Bricolage Grotesque, Geist, Geist Mono).

## 🏃 Run

From this directory, run `python -m http.server 8000`, then open `http://localhost:8000/`.

## 🎨 Brand (v3)

- 🎯 **Audience:** 18–30 (stretching to 40), people who like order, planning then executing, learning from spend, and levelling up how they run ads.
- 💡 **Idea:** "Chaos in. Clarity out." A prism takes a messy beam and returns an ordered spectrum.
- 🔺 **Mark:** a triangle with four color bars (`assets/v3/mark.svg`). The wordmark is lowercase "prism" in Bricolage Grotesque 800.
- 🟦🟪🟥🟧 **Color is filing, not decoration:** 🔵 blue Plan · 🟣 violet Make · 🩷 pink Ship · 🟠 amber Learn. Surfaces are off-white `#f2f2ee` with graph-paper grid, plus one dark section.
- 🗣️ **Voice:** direct, a little funny, never corporate.

## 📦 Assets — current state

The live page (`index.html`) only references `assets/v3/`: `mark.svg` (header/footer logo), `favicon.svg`, and `og.svg` rendered to `og.png` (the 1200×630 social share image). Everything else visible on the page — the machine, the plates, the receipt, the charts — is live HTML/SVG, not an image.

Everything else in `assets/` is **🗄️ tracked in git but not referenced by any current page or code**, kept only as design history:
- 🖼️ `logo-name.png`, `logo-name.jpeg`, `old name logo.png` — earlier wordmark explorations
- 🎬 `prism-hero.mp4`, `prism-logo.mp4` — earlier hero/brand videos
- 🧩 `styles.css`, `script.js` — a separate, more elaborate scroll-driven page that was never wired to any `index.html`

⚠️ **Note:** `logo.png` (the diamond/crystal icon, a different asset from the above) **is** in active use — it's the app-wide favicon and header mark, referenced from `app/layout.tsx` and multiple components. It has nothing to do with this landing page's own brand mark (`assets/v3/mark.svg`); don't delete it.

🗑️ Untracked, unused snapshots from earlier landing-page iterations (previous `index.v1.html`/`index.v2.html`, the `A01–A10.png` product screenshots, `assets/v2/*`, `prism-landing.zip`) were deleted on 2026-09-28 after confirming nothing referenced them. If you need an earlier direction back, check git history or ask — they are not in this working tree.

## 🎛️ Interaction

- ⚙️ **Hero machine:** messy chips fly into the prism one at a time. Each landing checks a row in the Audiences / Angles / Offers / Ads columns. After a full sort the panel shows "Inbox zero." and the loop restarts. It only runs while visible.
- 🪜 **How it works:** a pinned figure swaps between four live plates (Plan graph, Make ads, Ship board, Learn chart with lineage trace) as the steps scroll past. On narrow screens it pins under the header. Plates sit on a fixed 712×500 canvas scaled to fit.
- 🧾 **Receipt:** prints line by line when it scrolls into view.
- 🌗 **Header:** switches to a dark variant over the dark section.
- ♿ **Reduced motion:** everything shows in its final state without animation.
- 🔗 "Open Prism" / "Start with one product" link to `/`, the app itself.
