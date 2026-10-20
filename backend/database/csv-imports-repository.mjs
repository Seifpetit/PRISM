import { randomUUID } from "node:crypto";
import { squash } from "../csv-import/resolve.mjs";
import { getDatabasePool } from "./client.mjs";

/** Ad names that earlier imports already placed with a product (squashed name -> product id). A name in two products is left out. */
export function knownAdProducts(workspaceId) {
  const rows = getDatabasePool().query(
    `select ad_name, product_id from meta_ad_daily where workspace_id = $1
     union select ad_name, product_id from converty_ad_summary where workspace_id = $1`,
    [workspaceId],
  ).rows;
  const known = new Map();
  for (const row of rows) {
    const key = squash(row.ad_name);
    known.set(key, known.has(key) && known.get(key) !== row.product_id ? null : row.product_id);
  }
  for (const [key, value] of known) if (value === null) known.delete(key);
  return known;
}

export function recordImport(workspaceId, record) {
  const id = randomUUID();
  getDatabasePool().query(
    `insert into csv_imports (id, workspace_id, kind, file_name, currency, date_from, date_to, rows_total, rows_imported, rows_updated, rows_skipped, summary_json, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [id, workspaceId, record.kind, record.fileName, record.currency ?? null, record.dateFrom ?? null, record.dateTo ?? null, record.rowsTotal, record.rowsImported, record.rowsUpdated, record.rowsSkipped, JSON.stringify(record.summary ?? {}), new Date().toISOString()],
  );
  return id;
}

/** True when a stored row already holds exactly these values. A file imported twice must not take its rows from the first import. */
const holdsSame = (stored, next) => Object.entries(next).every(([column, value]) => (stored[column] ?? null) === (value ?? null));

/** Adds or replaces each ad-day of one product. Returns how many were new, how many replaced an earlier import's row with different numbers, and how many were already there exactly as they are. */
export function saveMetaAdDays(workspaceId, importId, currency, productId, days) {
  const db = getDatabasePool();
  const now = new Date().toISOString();
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  for (const day of days) {
    const stored = db.query(
      `select * from meta_ad_daily where workspace_id = $1 and product_id = $2 and ad_name = $3 and day = $4`,
      [workspaceId, productId, day.adName, day.day],
    ).rows[0];
    const exists = Boolean(stored);
    // The same numbers again change nothing, and the row stays with the import that first brought it.
    if (exists && holdsSame(stored, {
      ad_delivery: day.adDelivery, spend: day.spend, impressions: day.impressions, reach: day.reach, link_clicks: day.linkClicks,
      clicks_all: day.clicksAll, landing_page_views: day.landingPageViews, results: day.results, result_indicator: day.resultIndicator,
      hook_rate: day.hookRate, hold_rate: day.holdRate, quality_ranking: day.qualityRanking, engagement_ranking: day.engagementRanking,
      conversion_ranking: day.conversionRanking, date_created: day.dateCreated, currency,
    })) {
      unchanged += 1;
      continue;
    }
    db.query(
      `insert into meta_ad_daily (
         id, workspace_id, product_id, ad_name, day, ad_delivery, spend, impressions, reach, link_clicks, clicks_all,
         landing_page_views, results, result_indicator, hook_rate, hold_rate, quality_ranking, engagement_ranking,
         conversion_ranking, date_created, currency, import_id, updated_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
       on conflict (workspace_id, product_id, ad_name, day) do update set
         ad_delivery = excluded.ad_delivery, spend = excluded.spend, impressions = excluded.impressions, reach = excluded.reach,
         link_clicks = excluded.link_clicks, clicks_all = excluded.clicks_all, landing_page_views = excluded.landing_page_views,
         results = excluded.results, result_indicator = excluded.result_indicator, hook_rate = excluded.hook_rate,
         hold_rate = excluded.hold_rate, quality_ranking = excluded.quality_ranking, engagement_ranking = excluded.engagement_ranking,
         conversion_ranking = excluded.conversion_ranking, date_created = excluded.date_created, currency = excluded.currency,
         import_id = excluded.import_id, updated_at = excluded.updated_at`,
      [
        randomUUID(), workspaceId, productId, day.adName, day.day, day.adDelivery, day.spend, day.impressions, day.reach, day.linkClicks,
        day.clicksAll, day.landingPageViews, day.results, day.resultIndicator, day.hookRate, day.holdRate, day.qualityRanking,
        day.engagementRanking, day.conversionRanking, day.dateCreated, currency, importId, now,
      ],
    );
    if (exists) updated += 1;
    else inserted += 1;
  }
  return { inserted, updated, unchanged };
}

/** Adds or replaces each ad of one product (by ad id) from a Converty summary. */
export function saveConvertyAds(workspaceId, importId, currency, productId, ads) {
  const db = getDatabasePool();
  const now = new Date().toISOString();
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  for (const ad of ads) {
    const stored = db.query(`select * from converty_ad_summary where workspace_id = $1 and product_id = $2 and ad_id = $3`, [workspaceId, productId, ad.adId]).rows[0];
    const exists = Boolean(stored);
    if (exists && holdsSame(stored, {
      ad_name: ad.adName, campaign: ad.campaign, orders: ad.orders, deleted: ad.deleted, confirmed: ad.confirmed, delivered: ad.delivered,
      returned: ad.returned, delivered_revenue: ad.deliveredRevenue, first_order: ad.firstOrder, last_order: ad.lastOrder,
      statuses_json: JSON.stringify(ad.statuses), currency,
    })) {
      unchanged += 1;
      continue;
    }
    db.query(
      `insert into converty_ad_summary (
         id, workspace_id, product_id, ad_id, ad_name, campaign, orders, deleted, confirmed, delivered, returned,
         delivered_revenue, first_order, last_order, statuses_json, currency, import_id, updated_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       on conflict (workspace_id, product_id, ad_id) do update set
         ad_name = excluded.ad_name, campaign = excluded.campaign, orders = excluded.orders, deleted = excluded.deleted,
         confirmed = excluded.confirmed, delivered = excluded.delivered, returned = excluded.returned,
         delivered_revenue = excluded.delivered_revenue, first_order = excluded.first_order, last_order = excluded.last_order,
         statuses_json = excluded.statuses_json, currency = excluded.currency, import_id = excluded.import_id, updated_at = excluded.updated_at`,
      [randomUUID(), workspaceId, productId, ad.adId, ad.adName, ad.campaign, ad.orders, ad.deleted, ad.confirmed, ad.delivered, ad.returned, ad.deliveredRevenue, ad.firstOrder, ad.lastOrder, JSON.stringify(ad.statuses), currency, importId, now],
    );
    if (exists) updated += 1;
    else inserted += 1;
  }
  return { inserted, updated, unchanged };
}

/**
 * What has been imported for one product, per template: how many rows, the days they cover, and when they last
 * changed. Read from the data itself, so it stays true if an import record is ever removed.
 */
export function csvCoverage(workspaceId, productId) {
  const db = getDatabasePool();
  const meta = db.query(
    `select count(*) rows, min(day) date_from, max(day) date_to, max(updated_at) imported_at from meta_ad_daily where workspace_id = $1 and product_id = $2`,
    [workspaceId, productId],
  ).rows[0];
  const converty = db.query(
    `select count(*) rows, min(first_order) date_from, max(last_order) date_to, max(updated_at) imported_at from converty_ad_summary where workspace_id = $1 and product_id = $2`,
    [workspaceId, productId],
  ).rows[0];
  const view = (row) => ({ rows: row.rows, dateFrom: row.rows ? row.date_from : null, dateTo: row.rows ? row.date_to : null, importedAt: row.rows ? row.imported_at : null });
  return { meta: view(meta), converty: view(converty) };
}

/** The most recent imports, newest first, for the "already imported" list. */
export function listCsvImports(workspaceId, limit = 10) {
  return getDatabasePool()
    .query(
      `select c.*,
         case c.kind
           when 'meta-ads-export' then (select count(*) from meta_ad_daily m where m.workspace_id = c.workspace_id and m.import_id = c.id)
           else (select count(*) from converty_ad_summary v where v.workspace_id = c.workspace_id and v.import_id = c.id)
         end as rows_held
       from csv_imports c where c.workspace_id = $1 order by c.created_at desc limit $2`,
      [workspaceId, Math.min(Math.max(limit, 1), 50)],
    )
    .rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      fileName: row.file_name,
      currency: row.currency,
      dateFrom: row.date_from,
      dateTo: row.date_to,
      rowsTotal: row.rows_total,
      rowsImported: row.rows_imported,
      rowsUpdated: row.rows_updated,
      rowsSkipped: row.rows_skipped,
      rowsHeld: row.rows_held,
      products: summaryOf(row).products ?? [],
      productIds: summaryOf(row).productIds ?? [],
      createdAt: row.created_at,
    }));
}

function summaryOf(row) {
  try {
    return JSON.parse(row.summary_json ?? "{}");
  } catch {
    return {};
  }
}

/**
 * Removes one import: the rows it still owns (rows a newer import replaced belong to that newer import and stay) and
 * its record. Returns how many data rows were removed, or null when there is no such import in the workspace.
 */
export function deleteCsvImport(workspaceId, importId) {
  const db = getDatabasePool();
  const record = db.query(`select kind from csv_imports where workspace_id = $1 and id = $2`, [workspaceId, importId]).rows[0];
  if (!record) return null;
  db.exec("BEGIN");
  try {
    const table = record.kind === "meta-ads-export" ? "meta_ad_daily" : "converty_ad_summary";
    const removed = db.query(`delete from ${table} where workspace_id = $1 and import_id = $2`, [workspaceId, importId]).rowCount;
    db.query(`delete from csv_imports where workspace_id = $1 and id = $2`, [workspaceId, importId]);
    db.exec("COMMIT");
    return removed;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

const HIDDEN_ROW_COLUMNS = new Set(["id", "workspace_id", "import_id", "updated_at", "product_id"]);

/**
 * The rows one import still provides to Performance, as a plain table, for read-only inspection. The original file
 * was never stored, so these rows (after any later import replaced some) are all there is to show.
 */
export function csvImportTable(workspaceId, importId, limit = 2000) {
  const db = getDatabasePool();
  const record = db.query(`select kind, file_name from csv_imports where workspace_id = $1 and id = $2`, [workspaceId, importId]).rows[0];
  if (!record) return null;
  const table = record.kind === "meta-ads-export" ? "meta_ad_daily" : "converty_ad_summary";
  const order = record.kind === "meta-ads-export" ? "ad_name, day" : "ad_name";
  const rows = db.query(`select * from ${table} where workspace_id = $1 and import_id = $2 order by ${order} limit $3`, [workspaceId, importId, limit + 1]).rows;
  const columns = rows.length ? Object.keys(rows[0]).filter((key) => !HIDDEN_ROW_COLUMNS.has(key)) : [];
  return {
    id: importId,
    fileName: record.file_name,
    columns,
    rows: rows.slice(0, limit).map((row) => columns.map((column) => (row[column] === null || row[column] === undefined ? "" : String(row[column])))),
    truncated: rows.length > limit,
  };
}

const isUnattributed = (row) => /^\(.*\)$/.test(String(row.ad_id ?? "").trim()) || /^\(no ad attribution\)$/i.test(String(row.ad_name ?? "").trim());

/**
 * The imported ads of one product (or, with no product, of every product), the Meta export and the Converty summary
 * joined by ad name. Meta's rows are added up over every imported day. Converty has no days, only each ad's whole
 * life in the file, so the two are compared over the same span only in that sense: the caller says so. Money stays in
 * each file's own currency; nothing is converted.
 */
export function importedAdPerformance(workspaceId, productId = null) {
  const db = getDatabasePool();
  const filter = productId ? "and product_id = $2" : "";
  const params = productId ? [workspaceId, productId] : [workspaceId];
  const metaRows = db.query(
    `select ad_name, day, ad_delivery, spend, impressions, link_clicks, clicks_all, landing_page_views, results, result_indicator, hook_rate, hold_rate, currency
     from meta_ad_daily where workspace_id = $1 ${filter}`,
    params,
  ).rows;
  const convertyRows = db.query(
    `select ad_id, ad_name, orders, deleted, confirmed, delivered, returned, delivered_revenue, first_order, last_order, currency
     from converty_ad_summary where workspace_id = $1 ${filter}`,
    params,
  ).rows;

  const ads = new Map();
  const entry = (name) => {
    const key = squash(name);
    if (!ads.has(key)) ads.set(key, { name, meta: null, converty: null });
    return ads.get(key);
  };

  // The days the order file covers. Cost per confirmed or delivered order divides only the spend of those days, so
  // spend and orders are for the same period.
  const orderDays = convertyRows.flatMap((row) => [row.first_order, row.last_order]).filter(Boolean).sort();
  const orderFrom = orderDays[0] ?? null;
  const orderTo = orderDays.at(-1) ?? null;

  const metaCurrencies = new Set();
  // The export's days added up across ads: the figures on Performance follow the chosen range with these.
  const byDay = new Map();
  for (const row of metaRows) {
    metaCurrencies.add(row.currency);
    const day = byDay.get(row.day) ?? byDay.set(row.day, { date: row.day, spend: 0, impressions: 0, linkClicks: 0, results: 0, purchases: 0 }).get(row.day);
    day.spend += row.spend;
    day.impressions += row.impressions;
    day.linkClicks += row.link_clicks;
    day.results += row.results;
    // Meta's "results" is whatever the campaign optimises for; only when that is a purchase is it an order count.
    if (/purchase/i.test(row.result_indicator ?? "")) day.purchases += row.results;
    const ad = entry(row.ad_name);
    ad.name = row.ad_name;
    const m = (ad.meta ??= { spend: 0, spendInOrderWindow: 0, impressions: 0, linkClicks: 0, clicksAll: 0, landingPageViews: 0, results: 0, purchases: 0, hookWeighted: 0, hookImpressions: 0, holdWeighted: 0, holdImpressions: 0, days: 0, firstDay: row.day, lastDay: row.day, delivery: row.ad_delivery });
    m.spend += row.spend;
    if (orderFrom && row.day >= orderFrom && row.day <= orderTo) m.spendInOrderWindow += row.spend;
    m.impressions += row.impressions;
    m.linkClicks += row.link_clicks;
    m.clicksAll += row.clicks_all;
    m.landingPageViews += row.landing_page_views;
    m.results += row.results;
    if (/purchase/i.test(row.result_indicator ?? "")) m.purchases += row.results;
    if (row.hook_rate !== null) {
      m.hookWeighted += row.hook_rate * row.impressions;
      m.hookImpressions += row.impressions;
    }
    if (row.hold_rate !== null) {
      m.holdWeighted += row.hold_rate * row.impressions;
      m.holdImpressions += row.impressions;
    }
    m.days += 1;
    if (row.day < m.firstDay) m.firstDay = row.day;
    if (row.day >= m.lastDay) {
      m.lastDay = row.day;
      m.delivery = row.ad_delivery;
    }
  }

  const convertyCurrencies = new Set();
  const unattributed = { orders: 0, deleted: 0, confirmed: 0, delivered: 0, returned: 0, deliveredRevenue: 0 };
  let unattributedRows = 0;
  for (const row of convertyRows) {
    convertyCurrencies.add(row.currency);
    if (isUnattributed(row)) {
      unattributedRows += 1;
      for (const [field, column] of [["orders", "orders"], ["deleted", "deleted"], ["confirmed", "confirmed"], ["delivered", "delivered"], ["returned", "returned"], ["deliveredRevenue", "delivered_revenue"]]) unattributed[field] += row[column];
      continue;
    }
    const ad = entry(row.ad_name);
    const c = (ad.converty ??= { orders: 0, deleted: 0, confirmed: 0, delivered: 0, returned: 0, deliveredRevenue: 0 });
    c.orders += row.orders;
    c.deleted += row.deleted;
    c.confirmed += row.confirmed;
    c.delivered += row.delivered;
    c.returned += row.returned;
    c.deliveredRevenue += row.delivered_revenue;
  }

  const list = [...ads.values()].map((ad) => ({
    name: ad.name,
    delivery: ad.meta?.delivery ?? null,
    hasMeta: Boolean(ad.meta),
    hasConverty: Boolean(ad.converty),
    days: ad.meta?.days ?? 0,
    spend: ad.meta?.spend ?? 0,
    spendInOrderWindow: ad.meta?.spendInOrderWindow ?? 0,
    impressions: ad.meta?.impressions ?? 0,
    linkClicks: ad.meta?.linkClicks ?? 0,
    landingPageViews: ad.meta?.landingPageViews ?? 0,
    results: ad.meta?.results ?? 0,
    purchases: ad.meta?.purchases ?? 0,
    hookRate: ad.meta && ad.meta.hookImpressions > 0 ? ad.meta.hookWeighted / ad.meta.hookImpressions : null,
    holdRate: ad.meta && ad.meta.holdImpressions > 0 ? ad.meta.holdWeighted / ad.meta.holdImpressions : null,
    orders: ad.converty?.orders ?? 0,
    deleted: ad.converty?.deleted ?? 0,
    confirmed: ad.converty?.confirmed ?? 0,
    delivered: ad.converty?.delivered ?? 0,
    returned: ad.converty?.returned ?? 0,
    deliveredRevenue: ad.converty?.deliveredRevenue ?? 0,
  }));
  list.sort((a, b) => b.spend - a.spend || b.orders - a.orders);

  const sum = (field) => list.reduce((total, ad) => total + ad[field], 0);
  const metaDays = metaRows.map((row) => row.day).sort();
  return {
    meta: { rows: metaRows.length, currency: [...metaCurrencies][0] ?? null, mixedCurrency: metaCurrencies.size > 1, dateFrom: metaDays[0] ?? null, dateTo: metaDays.at(-1) ?? null },
    converty: { rows: convertyRows.length, currency: [...convertyCurrencies][0] ?? null, mixedCurrency: convertyCurrencies.size > 1, dateFrom: orderDays[0] ?? null, dateTo: orderDays.at(-1) ?? null },
    ads: list,
    daily: [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
    totals: {
      spend: sum("spend"),
      impressions: sum("impressions"),
      linkClicks: sum("linkClicks"),
      results: sum("results"),
      purchases: sum("purchases"),
      orders: sum("orders") + unattributed.orders,
      deleted: sum("deleted") + unattributed.deleted,
      confirmed: sum("confirmed") + unattributed.confirmed,
      delivered: sum("delivered") + unattributed.delivered,
      returned: sum("returned") + unattributed.returned,
      deliveredRevenue: sum("deliveredRevenue") + unattributed.deliveredRevenue,
    },
    unattributed: unattributedRows ? unattributed : null,
  };
}
