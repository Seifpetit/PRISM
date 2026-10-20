# Integrations and performance

Connecting Meta Ads, Shopify and Converty, importing CSV exports, and reading the Performance tab. Back to the [README](../README.md).

## Integrations

Open the profile menu (top right) → **Integrations**. Connections are stored **per workspace**, with the
access token encrypted using `INTEGRATION_ENCRYPTION_KEY`. Without that key the backend refuses to save one.

- **Meta Ads:** you connect with your own Marketing API token, so no Meta app is needed. Click Connect and paste
  it. Create one in Meta Business Settings → Users → System users: add your ad account to a system user, then
  Generate token with the `ads_read` permission (choose "Never" for expiry if offered). PRISM checks the token with
  Meta, saves it encrypted for the workspace only, and shows a badge with the name of the ad account it reaches
  ("Acme Ads", or "Acme Ads +2 more"; a token that reaches no ad account is named after its owner). A token that
  expires shows "Token expired": connect again with a new one. (The "Log in with Facebook" flow, with `META_APP_ID`
  and `META_APP_SECRET`, is still in the backend but the Connect button no longer uses it.)
- **Performance → Meta Ads:** once Meta is connected, the Performance tab shows spend, purchases, ROAS, cost per
  purchase, impressions, link CTR, cost per link click and CPM for the last 7, 30 or 90 days, each against the same
  number of days before it, a spend-by-day chart with a second metric as a line, and the campaigns by spend. An ad
  account can run several products, so choose which campaigns launch a product with **Assign campaigns** (names that
  contain the product's name are suggested; a campaign belongs to one product). "This product" then counts only
  those campaigns and "Whole account" counts everything. The numbers are read live from Meta (kept for a minute,
  refresh button to re-read); only the assignment is stored, never Meta's data.
- **Shopify:** click Connect and approve in Shopify. The token is saved encrypted for the workspace.
  It needs a Shopify app (Dev Dashboard) with the "legacy install flow" enabled, scopes
  `read_orders,read_products`, and `http://localhost:4000/shopify/callback` listed under allowed redirection
  URLs (Shopify accepts `http://localhost` for development apps). Set `SHOPIFY_OAUTH_REDIRECT_BASE=http://localhost:4000`
  and `SHOPIFY_SHOP_DOMAIN` (the default store, so Connect is one click). No tunnel is needed for the login,
  because your own browser follows the redirect. A public tunnel would only be needed later for webhooks.
  With no default store set, the Connect button asks which store to connect.
- **TikTok Ads:** not connected yet.
- **CSV import (Settings → Integrations → CSV import):** two templates are understood, recognised by their column
  titles rather than their names or column order: a **Meta Ads Manager export** (level Ad, Breakdown → Time → Day; one
  row per ad per day, the currency in the column titles) and a **Converty "Ad Summary"** (one row per ad with its order
  pipeline: orders, confirmed, delivered, returned and delivered revenue; no currency in the file). You can choose several
  files at once. Each is read first, and nothing is saved until you press Import. PRISM works out which product each ad
  belongs to: a Meta campaign you assigned to a product in Performance, the same ad in a file you imported before, or a
  product's name in the campaign or ad name. A file that covers several products says so; ads it can't place are listed
  and you choose a product for them (offered by default: the one the rest of the file went to) or skip them; a currency
  the file doesn't state is asked for; and you can put a whole file in one product. Rows are stored per product and an
  overlapping export replaces the same ad-days instead of doubling them. Performance has a slim **Data sources** strip at the top (Meta Ads → Shopify + the ad export and the
  Converty summary for the open product): a part that is missing, expired or out of date is amber or red, says what to
  do, and pressing it does it; the Import button is there too.
  Once something is imported, Performance shows an **Ads · from your imports** section: spend, link CTR, hook and hold
  rate per ad from the Meta export, joined by ad name with the Converty order pipeline (orders, confirmed, delivered,
  cost per delivered order, delivered revenue). It uses every imported day, not the 7/30/90 day range, because Converty
  has no days; money stays in each file's currency and nothing is converted. Imported files are listed in your profile's
  **Data** section, where an import can also be removed.
- **Performance → Shopify and the whole picture:** the range (7, 30 or 90 days) and the scope ("This product" or
  "Whole account") are chosen once at the top and apply to everything. **The whole picture** shows revenue, orders and ad
  spend, blended ROAS (revenue divided by ad spend), cost per order, and the ad platform's own ROAS beside it so the
  gap is visible, with a day-by-day chart marked with what you did in PRISM (campaigns created, ad sets added). The
  cards are about the figure, not the method: each one takes the best source there is (Shopify, the Meta API, the
  imported Meta ad export, the imported Converty file) and names it. Live connections come first, then files; a source
  with days follows the 7, 30 or 90 day range, while a file with one total (Converty) says which days it covers and
  the ratios are then worked out over those same days, from a source that has all of them. Recorded sales (Shopify, the Converty file) come first; when there are none, revenue and
  orders fall back to the purchases and purchase value Meta attributes to its ads (from the API, or the purchases in the
  imported ad export), named "Meta Ads · reported" so they are not mistaken for sales. A new source is one adapter
  in `lib/business-figures.ts`. The Data sources strip also shows a small chip per imported file (pressing it opens
  Data), amber when none of the file's rows are in use. The **data check chip** in the toolbar says whether the data is up to date for the period you chose: green ("Up to
  date through Sep 20") when ad spend and recorded orders (Shopify or the order file, not Meta's own purchase claims) both
  cover the range through yesterday, amber with the missing days ("Orders Sep 12 – Sep 20") and the source that ends
  early when they do not. Pressing it lists what covers each stream. A live connection covers the whole range; a file
  covers the days it has, and a single-total file is not blamed for days before its first order.
  The **currency button** in the Performance toolbar shows the current currency (USD, EUR, GBP...); it opens a panel
  to show every amount in one currency. Rates are live: the backend reads them once a day from the free
  open.er-api.com service (no key; jsDelivr's currency dataset is the fallback) and caches them, so the browser never
  calls a third party. Type a rate in the panel to use your own instead; an amount with no rate stays in its own currency. It converts the data itself, so charts, ratios and tables agree; blended ROAS then
  works across currencies. The **By ad** table shows nine columns by default: the ad, spend, hook %, hold %, link CTR, Meta orders (Meta's claim),
  then, from the order file, confirmed % (confirmed over orders not cancelled before confirmation), confirmed orders and
  cost per confirmed order (spend over the days the order file covers, divided by that ad's own confirmed orders). Until an
  order file is imported those cells show a dash that says why, and Meta's cost per order stands in. The **Columns**
  button offers four views (Overview, Creative diagnostics, Order quality, Economics) and every column grouped by
  topic; the choice is kept per product in this browser. The Ad column stays pinned and every header sorts.
  **The app reopens on the page you left** (Strategy, Creatives,
  Performance, a settings section) and the same product, remembered in this browser. The **Shopify** section shows revenue, orders, units, average order value, the latest orders and
  (whole store) the top products. "This product" counts only the orders that contain the Shopify product linked to
  the open PRISM product. Blended ROAS needs Meta and Shopify in the same currency. With the `read_orders` permission
  Shopify returns only the last 60 days of orders, so 90 days is cut there. Read live, never stored.

If you lose or change `INTEGRATION_ENCRYPTION_KEY`, saved connections become unreadable and must be
reconnected.
