import { GRAPH_VERSION } from "./meta-ads.mjs";

// Marketing API write operations: turning one PRISM ad set (a "concept", migration 013) into a Meta
// Campaign -> Ad Set -> Ad Creative -> Ad. Orchestration (which ads, naming, persistence) lives in
// meta-publish.mjs; this module only knows how to call the Graph API.
//
// Everything created here is status PAUSED. PRISM never turns spend on by itself — a person reviews and
// activates it in Ads Manager, where targeting can also be refined past the broad default set below.

async function graphCall(token, method, path, body) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${path}`;
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body ? new URLSearchParams(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
  return payload;
}

const edge = (adAccountId, name) => `${adAccountId}/${name}`;

/** Facebook Pages the token can run ads as. Needs the pages_show_list permission. */
export async function listMetaPages(token) {
  const payload = await graphCall(token, "GET", "me/accounts?fields=id,name&limit=100");
  return Array.isArray(payload.data) ? payload.data.map((page) => ({ id: page.id, name: page.name })) : [];
}

/** Uploads one ad's cover image (a data: URI) to the ad account's image library. Returns its image hash. */
export async function uploadAdImage(token, adAccountId, dataUri) {
  const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/.exec(dataUri ?? "");
  if (!match) throw new Error("This ad has no image to publish.");
  const payload = await graphCall(token, "POST", edge(adAccountId, "adimages"), { bytes: match[1] });
  const hash = Object.values(payload.images ?? {})[0]?.hash;
  if (!hash) throw new Error("Meta accepted the image but returned no image hash.");
  return hash;
}

/** Creates the parent Campaign. Always PAUSED. */
export async function createMetaCampaign(token, adAccountId, { name }) {
  const payload = await graphCall(token, "POST", edge(adAccountId, "campaigns"), {
    name,
    objective: "OUTCOME_TRAFFIC",
    status: "PAUSED",
    special_ad_categories: JSON.stringify([]),
  });
  return payload.id;
}

/**
 * Creates one ad set under a campaign. Targeting defaults broad (US, 18-65, Meta's Advantage+ audience) because
 * PRISM has no targeting UI yet; refine it in Ads Manager before activating.
 */
export async function createMetaAdSet(token, adAccountId, { name, campaignId, pageId, dailyBudgetCents }) {
  const payload = await graphCall(token, "POST", edge(adAccountId, "adsets"), {
    name,
    campaign_id: campaignId,
    daily_budget: String(dailyBudgetCents),
    billing_event: "IMPRESSIONS",
    optimization_goal: "LINK_CLICKS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    status: "PAUSED",
    promoted_object: JSON.stringify({ page_id: pageId }),
    targeting: JSON.stringify({
      geo_locations: { countries: ["US"] },
      age_min: 18,
      age_max: 65,
      targeting_automation: { advantage_audience: 1 },
    }),
  });
  return payload.id;
}

const CTA_TYPES = {
  "shop now": "SHOP_NOW",
  "buy now": "SHOP_NOW",
  "learn more": "LEARN_MORE",
  "sign up": "SIGN_UP",
  subscribe: "SUBSCRIBE",
  "get offer": "GET_OFFER",
  "book now": "BOOK_TRAVEL",
  download: "DOWNLOAD",
  "apply now": "APPLY_NOW",
  "contact us": "CONTACT_US",
  "watch more": "WATCH_MORE",
};

/** PRISM's ad.cta is free text ("Shop now"); Meta's call_to_action.type is a fixed enum. Unrecognized text
 * falls back to the safest generic button rather than failing the whole publish over a label mismatch. */
function ctaType(cta) {
  return CTA_TYPES[(cta ?? "").trim().toLowerCase()] ?? "LEARN_MORE";
}

/** Creates one ad creative from an already-uploaded image and the ad's copy. */
export async function createMetaAdCreative(token, adAccountId, { pageId, imageHash, name, message, link, cta }) {
  const linkData = {
    image_hash: imageHash,
    link,
    call_to_action: { type: ctaType(cta), value: { link } },
  };
  if (message) linkData.message = message;
  if (name) linkData.name = name;
  const payload = await graphCall(token, "POST", edge(adAccountId, "adcreatives"), {
    name,
    object_story_spec: JSON.stringify({ page_id: pageId, link_data: linkData }),
  });
  return payload.id;
}

/** Creates the ad itself, pointing at an ad set and a creative. PAUSED like everything above it. */
export async function createMetaAd(token, adAccountId, { name, adsetId, creativeId }) {
  const payload = await graphCall(token, "POST", edge(adAccountId, "ads"), {
    name,
    adset_id: adsetId,
    creative: JSON.stringify({ creative_id: creativeId }),
    status: "PAUSED",
  });
  return payload.id;
}
