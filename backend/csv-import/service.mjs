import { randomUUID } from "node:crypto";
import { getDatabasePool } from "../database/client.mjs";
import { knownAdProducts, recordImport, saveConvertyAds, saveMetaAdDays } from "../database/csv-imports-repository.mjs";
import { listMetaCampaignAssignments } from "../database/product-meta-campaigns-repository.mjs";
import { listWorkspaceProducts } from "../database/workspace-data-repository.mjs";
import { CsvTemplateError, KIND_LABEL, parseCsvImport } from "./parse.mjs";
import { describeReasons, resolveProducts, squash } from "./resolve.mjs";

// Importing is two steps. "Analyze" reads the file, says what it is and which product each ad belongs to, and keeps
// the result for a while. "Commit" saves it once the person has settled what the analysis could not (a currency the
// file does not state, ads it could not place). Nothing is written by the first step.

export const MAX_CSV_BYTES = 5 * 1024 * 1024;
const ANALYSIS_TTL_MS = 30 * 60 * 1000;
const MAX_ANALYSES = 30;
const analyses = new Map();

const fail = (message) => {
  throw new Error(message);
};

function sweep() {
  const now = Date.now();
  for (const [id, entry] of analyses) if (now - entry.createdAt > ANALYSIS_TTL_MS) analyses.delete(id);
  while (analyses.size > MAX_ANALYSES) analyses.delete(analyses.keys().next().value);
}

/** What one file is and where its ads belong, without writing anything. */
export function analyzeCsvImport(workspaceId, { fileName, csv }) {
  if (typeof fileName !== "string" || !fileName.trim()) fail("The file has no name.");
  if (typeof csv !== "string" || !csv.trim()) fail("That file is empty.");
  if (Buffer.byteLength(csv) > MAX_CSV_BYTES) fail("That file is over 5 MB.");

  let parsed;
  try {
    parsed = parseCsvImport(csv);
  } catch (error) {
    if (error instanceof CsvTemplateError) fail(error.message);
    throw error;
  }

  const products = listWorkspaceProducts(workspaceId).map((product) => ({ id: product.id, name: product.name }));
  if (products.length === 0) fail("Create a product first: imported data belongs to a product.");
  const assignments = listMetaCampaignAssignments(workspaceId).map((row) => ({ campaignName: row.campaignName, productId: row.productId }));

  // What has to be placed: a Meta ad by its name (with every day it ran), a Converty row by its ad id.
  let items;
  if (parsed.kind === "meta-ads-export") {
    const rowsByName = new Map();
    for (const day of parsed.days) rowsByName.set(day.adName, (rowsByName.get(day.adName) ?? 0) + 1);
    items = [...rowsByName].map(([adName, rows]) => ({ key: adName, adName, campaign: null, rows }));
  } else {
    items = parsed.ads.map((ad) => ({ key: ad.adId, adName: ad.adName, campaign: ad.campaign, rows: 1, unattributed: /^\(.*\)$/.test(ad.adId.trim()) }));
  }
  const resolution = resolveProducts({ items, products, assignments, knownAds: knownAdProducts(workspaceId) });

  // What to offer for ads that could not be placed: the one product the rest of the file went to, or else the one
  // product the file's own name mentions. It is only a default in the question; the person still confirms.
  const named = products.filter((product) => squash(product.name).length >= 3 && squash(fileName).includes(squash(product.name)));
  const suggestedProductId = resolution.groups.size === 1 ? [...resolution.groups.keys()][0] : named.length === 1 ? named[0].id : null;

  const nameOf = new Map(products.map((product) => [product.id, product.name]));
  const itemByKey = new Map(items.map((item) => [item.key, item]));
  const analysisId = randomUUID();
  sweep();
  analyses.set(analysisId, { workspaceId, fileName: fileName.trim(), parsed, resolution, createdAt: Date.now() });

  return {
    analysisId,
    fileName: fileName.trim(),
    kind: parsed.kind,
    kindLabel: KIND_LABEL[parsed.kind],
    rows: parsed.rows,
    adCount: items.length,
    dateFrom: parsed.dateFrom ?? null,
    dateTo: parsed.dateTo ?? null,
    currency: parsed.currency,
    currencyKnown: Boolean(parsed.currency),
    products: [...resolution.groups].map(([productId, group]) => ({
      productId,
      productName: nameOf.get(productId) ?? "Unknown product",
      ads: group.keys.size,
      rows: group.rows,
      reason: describeReasons(group.reasons),
    })),
    unresolved: {
      ads: resolution.unresolved.keys.length,
      rows: resolution.unresolved.rows,
      samples: resolution.unresolved.keys.slice(0, 8).map((key) => itemByKey.get(key)?.adName ?? key),
    },
    suggestedProductId,
    warnings: parsed.warnings,
  };
}

/**
 * Saves an analysed file. `decisions` settles what the analysis could not: `currency` when the file does not state one,
 * `assignUnresolvedTo` or `skipUnresolved` for ads that could not be placed, and `forceProductId` to put the whole
 * file in one product regardless of what was detected. Re-importing an overlapping file replaces the same rows.
 */
export function commitCsvImport(workspaceId, analysisId, decisions = {}) {
  sweep();
  const entry = analyses.get(analysisId);
  if (!entry || entry.workspaceId !== workspaceId) fail("That file's analysis has expired. Choose the file again.");
  const { parsed, resolution, fileName } = entry;

  const products = new Map(listWorkspaceProducts(workspaceId).map((product) => [product.id, product.name]));
  const known = (id, what) => {
    if (!products.has(id)) fail(`${what} isn't one of your products.`);
    return id;
  };

  const currency = parsed.currency ?? (typeof decisions.currency === "string" ? decisions.currency.trim().toUpperCase() : "");
  if (!/^[A-Z]{3}$/.test(currency)) fail("Say which currency this file's amounts are in (a 3-letter code such as USD, EUR or TND).");

  const forced = decisions.forceProductId ? known(decisions.forceProductId, "The product you chose for this file") : null;
  const fallback = decisions.assignUnresolvedTo ? known(decisions.assignUnresolvedTo, "The product you chose for the unmatched ads") : null;
  if (!forced && resolution.unresolved.keys.length > 0 && !fallback && !decisions.skipUnresolved) {
    fail(`${resolution.unresolved.keys.length} ads couldn't be matched to a product. Choose a product for them, or skip them.`);
  }
  const productFor = (key) => forced ?? resolution.placed.get(key)?.productId ?? fallback ?? null;

  const byProduct = new Map();
  const bucket = (productId) => byProduct.get(productId) ?? byProduct.set(productId, []).get(productId);
  let skipped = 0;
  if (parsed.kind === "meta-ads-export") {
    for (const day of parsed.days) {
      const productId = productFor(day.adName);
      if (productId) bucket(productId).push(day);
      else skipped += 1;
    }
  } else {
    for (const ad of parsed.ads) {
      const productId = productFor(ad.adId);
      if (productId) bucket(productId).push(ad);
      else skipped += 1;
    }
  }

  const db = getDatabasePool();
  let importId;
  let imported = 0;
  let updated = 0;
  let unchanged = 0;
  const perProduct = [];
  db.exec("BEGIN");
  try {
    importId = recordImport(workspaceId, { kind: parsed.kind, fileName, currency, dateFrom: parsed.dateFrom, dateTo: parsed.dateTo, rowsTotal: parsed.kind === "meta-ads-export" ? parsed.days.length : parsed.ads.length, rowsImported: 0, rowsUpdated: 0, rowsSkipped: skipped });
    for (const [productId, rows] of byProduct) {
      const saved = parsed.kind === "meta-ads-export" ? saveMetaAdDays(workspaceId, importId, currency, productId, rows) : saveConvertyAds(workspaceId, importId, currency, productId, rows);
      imported += saved.inserted + saved.updated;
      updated += saved.updated;
      unchanged += saved.unchanged;
      perProduct.push({ productId, productName: products.get(productId), imported: saved.inserted + saved.updated, updated: saved.updated, unchanged: saved.unchanged });
    }
    // A file whose every row is already stored exactly as it is changes nothing, so it leaves no record: a record
    // that owns no rows would be listed in Data while Performance has nothing behind it.
    const nothingNew = imported === 0 && unchanged > 0;
    if (nothingNew) db.query(`delete from csv_imports where id = $1`, [importId]);
    else db.query(`update csv_imports set rows_imported = $2, rows_updated = $3, summary_json = $4 where id = $1`, [importId, imported, updated, JSON.stringify({ products: perProduct.map((row) => row.productName), productIds: perProduct.map((row) => row.productId) })]);
    if (nothingNew) importId = null;
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  analyses.delete(analysisId);
  return { importId, fileName, kind: parsed.kind, currency, imported, updated, unchanged, skipped, products: perProduct };
}

export function clearCsvAnalyses() {
  analyses.clear();
}
