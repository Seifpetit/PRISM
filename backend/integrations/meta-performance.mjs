import { getIntegrationConnection } from "../database/integration-connections-repository.mjs";
import { squash } from "../csv-import/resolve.mjs";
import { GRAPH_VERSION, resolveMetaAdsToken } from "./meta-ads.mjs";

// Read-only performance numbers for the Performance tab: the connected ad account's daily insights, totals for the
// range and for the range before it (for the change indicators), and its campaigns. Nothing here is saved; each
// answer is kept for a minute so switching ranges back and forth does not hit Meta's rate limits.

export const ALLOWED_DAYS = [7, 30, 90];
const CACHE_MS = 60_000;
const cache = new Map();

const ACCOUNT_STATUS = {
  1: "ACTIVE",
  2: "DISABLED",
  3: "UNSETTLED",
  7: "PENDING_RISK_REVIEW",
  8: "PENDING_SETTLEMENT",
  9: "IN_GRACE_PERIOD",
  100: "PENDING_CLOSURE",
  101: "CLOSED",
};

const DAY_MS = 86_400_000;
const ymd = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

/** The `days` days ending today, and the same number of days right before them. UTC dates. */
export function performanceRanges(days, now = new Date()) {
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const since = addDays(until, -(days - 1));
  const previousUntil = addDays(since, -1);
  const previousSince = addDays(previousUntil, -(days - 1));
  return {
    current: { since: ymd(since), until: ymd(until), days },
    previous: { since: ymd(previousSince), until: ymd(previousUntil), days },
  };
}

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Meta reports a purchase under several action types that overlap (omni_purchase includes the others). Take the
// first one present so a purchase is never counted twice.
const PURCHASE_TYPES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];
function actionTotal(list) {
  if (!Array.isArray(list)) return 0;
  for (const type of PURCHASE_TYPES) {
    const found = list.find((item) => item?.action_type === type);
    if (found) return number(found.value);
  }
  return 0;
}

/** One insights row as the numbers PRISM shows. Clicks are link clicks, the number Ads Manager calls "Link clicks". */
export function metricsFromRow(row) {
  return {
    spend: number(row.spend),
    impressions: number(row.impressions),
    reach: number(row.reach),
    clicks: number(row.inline_link_clicks),
    purchases: actionTotal(row.actions),
    revenue: actionTotal(row.action_values),
  };
}

async function graphGet(token, path, params, pages = 6) {
  let url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const rows = [];
  for (let page = 0; url && page < pages; page += 1) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
    if (Array.isArray(payload.data)) rows.push(...payload.data);
    else return payload;
    url = payload.paging?.next ? new URL(payload.paging.next) : null;
  }
  return rows;
}

const INSIGHT_FIELDS = "spend,impressions,reach,inline_link_clicks,actions,action_values";
const timeRange = (range) => JSON.stringify({ since: range.since, until: range.until });

/** Every day of the range, with zeros where Meta reported nothing, so a chart has no gaps. */
function denseDaily(rows, range) {
  const byDate = new Map(rows.map((row) => [row.date_start, metricsFromRow(row)]));
  const days = [];
  for (let day = new Date(`${range.since}T00:00:00Z`); ymd(day) <= range.until; day = addDays(day, 1)) {
    const date = ymd(day);
    const { spend = 0, impressions = 0, clicks = 0, purchases = 0, revenue = 0 } = byDate.get(date) ?? {};
    days.push({ date, spend, impressions, clicks, purchases, revenue });
  }
  return days;
}

async function resolveAccount(workspaceId, token) {
  const stored = workspaceId ? getIntegrationConnection(workspaceId, "meta-ads") : null;
  if (stored?.externalAccountId?.startsWith("act_")) return { id: stored.externalAccountId, name: stored.label ?? null };
  // The dev env token, or a connection saved before ad accounts were recorded: use the first ad account it reaches.
  const accounts = await graphGet(token, "me/adaccounts", { fields: "name,account_id", limit: "1" });
  const first = accounts[0];
  if (!first) throw new Error("This token doesn't reach any ad account. Give the system user access to one in Meta Business Settings.");
  return { id: `act_${first.account_id}`, name: first.name ?? null };
}

/** Meta's own filter: only rows of these campaigns. Without ids there is no filter, and the whole ad account counts. */
const campaignFilter = (campaignIds) =>
  campaignIds ? { filtering: JSON.stringify([{ field: "campaign.id", operator: "IN", value: campaignIds }]) } : {};

async function load(workspaceId, token, days, campaignIds) {
  const ranges = performanceRanges(days);
  const account = await resolveAccount(workspaceId, token);
  const base = `${account.id}/insights`;
  const only = campaignFilter(campaignIds);
  const [info, dailyRows, totalRows, previousRows, campaignRows, campaignList] = await Promise.all([
    graphGet(token, account.id, { fields: "name,account_status,currency" }),
    graphGet(token, base, { fields: INSIGHT_FIELDS, time_increment: "1", time_range: timeRange(ranges.current), limit: "100", ...only }),
    graphGet(token, base, { fields: INSIGHT_FIELDS, time_range: timeRange(ranges.current), ...only }),
    graphGet(token, base, { fields: INSIGHT_FIELDS, time_range: timeRange(ranges.previous), ...only }),
    graphGet(token, base, { fields: `campaign_id,campaign_name,${INSIGHT_FIELDS}`, level: "campaign", time_range: timeRange(ranges.current), limit: "100", ...only }),
    graphGet(token, `${account.id}/campaigns`, { fields: "id,name,effective_status", limit: "100" }),
  ]);

  const scoped = campaignIds ? campaignList.filter((campaign) => campaignIds.includes(campaign.id)) : campaignList;
  const statusById = new Map(scoped.map((campaign) => [campaign.id, campaign.effective_status]));
  const campaigns = campaignRows
    .map((row) => ({ id: row.campaign_id, name: row.campaign_name, status: statusById.get(row.campaign_id) ?? "UNKNOWN", ...metricsFromRow(row) }))
    .sort((a, b) => b.spend - a.spend);
  // A campaign that is running but had no delivery in the range still belongs on the list.
  for (const campaign of scoped) {
    if (campaign.effective_status === "ACTIVE" && !campaigns.some((row) => row.id === campaign.id)) {
      campaigns.push({ id: campaign.id, name: campaign.name, status: campaign.effective_status, spend: 0, impressions: 0, reach: 0, clicks: 0, purchases: 0, revenue: 0 });
    }
  }

  return {
    connected: true,
    accountId: account.id,
    accountName: info.name ?? account.name,
    currency: info.currency ?? "USD",
    accountStatus: ACCOUNT_STATUS[info.account_status] ?? "UNKNOWN",
    range: ranges.current,
    totals: metricsFromRow(totalRows[0] ?? {}),
    previousTotals: metricsFromRow(previousRows[0] ?? {}),
    daily: denseDaily(dailyRows, ranges.current),
    campaigns,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * The Meta Ads numbers for the workspace's ad account over the last 7, 30 or 90 days. A missing or rejected token is
 * an answer, not an error: the page shows how to reconnect.
 */
export async function getMetaAdsPerformance(workspaceId, { days = 30, refresh = false, campaignIds = null } = {}) {
  if (!ALLOWED_DAYS.includes(days)) throw new Error(`Choose a range of ${ALLOWED_DAYS.join(", ")} days.`);
  if (campaignIds && campaignIds.length === 0) throw new Error("Choose at least one campaign, or read the whole account.");
  const token = resolveMetaAdsToken(workspaceId);
  if (!token) return { connected: false, error: null };
  const ids = campaignIds ? [...campaignIds].sort() : null;
  const key = `${workspaceId}|${days}|${ids ? ids.join(",") : "account"}`;
  const cached = cache.get(key);
  if (!refresh && cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  try {
    const value = { ...(await load(workspaceId, token, days, ids)), scope: ids ? "product" : "account", campaignCount: ids ? ids.length : null };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (error) {
    cache.delete(key);
    return { connected: false, error: error.message };
  }
}

/** Every campaign of the connected ad account, for choosing which ones launch a product. */
export async function listMetaCampaigns(workspaceId) {
  const token = resolveMetaAdsToken(workspaceId);
  if (!token) throw new Error("Connect Meta Ads first.");
  const account = await resolveAccount(workspaceId, token);
  const rows = await graphGet(token, `${account.id}/campaigns`, { fields: "id,name,effective_status", limit: "100" });
  return rows.map((row) => ({ id: row.id, name: row.name, status: row.effective_status ?? "UNKNOWN" }));
}

/**
 * The playable source for a set of Meta video ids, best effort and one call per video: a video whose source
 * cannot be read (no permission, still processing, deleted) is simply left out rather than failing the batch.
 */
async function resolveVideoSources(token, videoIds) {
  const result = new Map();
  await Promise.all(
    [...videoIds].map(async (videoId) => {
      try {
        const payload = await graphGet(token, videoId, { fields: "source" }, 1);
        if (payload?.source) result.set(videoId, payload.source);
      } catch {
        // No access to this video's source, or it has none yet — leave it out; the thumbnail still stands in.
      }
    }),
  );
  return result;
}

/**
 * The connected ad account's own ads and their creative assets, by (squashed) ad name — Meta's own cover
 * thumbnail, and its playable video source when the creative is a video and Meta still serves one. Best effort
 * and cached the same 60s as everything else here: neither URL is guaranteed to stay valid, so this is always
 * read live rather than saved. A missing or rejected token, or a token without ads access, is an empty map
 * rather than an error — the caller falls back to PRISM's own linked image (see pipeline-repository.mjs's
 * metaAdRefImageMap).
 */
export async function listMetaAdThumbnails(workspaceId, campaignIds = null) {
  const token = resolveMetaAdsToken(workspaceId);
  if (!token) return new Map();
  const ids = campaignIds ? [...campaignIds].sort() : null;
  const key = `${workspaceId}|thumbs|${ids ? ids.join(",") : "account"}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  try {
    const account = await resolveAccount(workspaceId, token);
    const rows = await graphGet(token, `${account.id}/ads`, {
      fields: "name,creative{thumbnail_url,video_id}",
      limit: "200",
      ...campaignFilter(ids),
    });
    const byName = new Map();
    const videoIds = new Set();
    for (const row of rows) {
      const url = row.creative?.thumbnail_url;
      const name = squash(row.name);
      if (!url || !name) continue;
      const videoId = row.creative?.video_id ?? null;
      byName.set(name, { thumbnailUrl: url, videoId });
      if (videoId) videoIds.add(videoId);
    }
    const videoSources = videoIds.size ? await resolveVideoSources(token, videoIds) : new Map();
    const value = new Map();
    for (const [name, entry] of byName) {
      value.set(name, { thumbnailUrl: entry.thumbnailUrl, videoUrl: entry.videoId ? (videoSources.get(entry.videoId) ?? null) : null });
    }
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    // Same best-effort rule as fetchMetaAdAccounts in meta-ads.mjs: no ads access, or a transient error, just
    // means no live assets this round — not a reason to break the rest of Performance.
    return new Map();
  }
}

export function clearMetaPerformanceCache() {
  cache.clear();
}
