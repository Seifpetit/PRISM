import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseCsvImport, parseCsvText } from "../csv-import/parse.mjs";
import { resolveProducts } from "../csv-import/resolve.mjs";

// The two templates, with made-up values. Only the shape is the real one: the column titles, the blank cells where
// Meta has nothing to report, the currency inside the titles, and Converty's month-first dates and percent strings.
const META_HEADERS = [
  "Reporting starts", "Reporting ends", "Ad name", "Ad delivery", "Attribution setting", "Results", "Result indicator", "Reach", "Frequency",
  "Cost per results", "Ad set budget", "Ad set budget type", "Amount spent (USD)", "Ends", "Quality ranking", "Engagement rate ranking",
  "Conversion rate ranking", "Impressions", "CPM (cost per 1,000 impressions) (USD)", "Link clicks", "shop_clicks", "CPC (cost per link click) (USD)",
  "CTR (link click-through rate)", "Clicks (all)", "CTR (all)", "CPC (all) (USD)", "Landing page views", "Cost per landing page view (USD)", "Hold Rate",
  "Hook rate", "Date created", "Results (initial)", "Results (initial) indicator",
];

function metaRow(over) {
  const base = {
    "Reporting starts": "2026-09-01", "Reporting ends": "2026-09-01", "Ad name": "ACME Hook 1", "Ad delivery": "active",
    "Attribution setting": "7-day click, 1-day view, or 1-day engaged-view", Results: "", "Result indicator": "", Reach: "1000", "Amount spent (USD)": "10",
    Impressions: "2000", "Link clicks": "", "Clicks (all)": "40", "Landing page views": "", "Hold Rate": "", "Hook rate": "", "Date created": "2026-08-20",
    "Quality ranking": "-", "Engagement rate ranking": "-", "Conversion rate ranking": "-",
  };
  const merged = { ...base, ...over };
  return META_HEADERS.map((header) => {
    const value = merged[header] ?? "";
    return /[",]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }).join(",");
}
const metaCsv = (rows) => [META_HEADERS.map((header) => (/[",]/.test(header) ? `"${header}"` : header)).join(","), ...rows.map(metaRow)].join("\r\n");

const CONVERTY_HEADERS = "adId,adName,campaign,orders,deleted,confirmed,delivered,returned,confirmRate,deliveryRate,deliveredRevenue,firstOrder,lastOrder,status: abandoned,status: delivered,status: pending,status: returned";
const convertyCsv = (rows) => [CONVERTY_HEADERS, ...rows].join("\n");

test("a Meta export is read by its column titles: the currency, blanks as zero, and same-name same-day rows added together", () => {
  const parsed = parseCsvImport(
    metaCsv([
      { "Ad name": "ACME Hook 1", Results: "2", "Result indicator": "actions:offsite_conversion.fb_pixel_purchase", "Amount spent (USD)": "10", Impressions: "1000", "Hook rate": "0.5" },
      { "Ad name": "ACME Hook 1", "Amount spent (USD)": "5", Impressions: "3000", "Hook rate": "0.1", "Link clicks": "12" },
      { "Ad name": "NV 6", "Reporting starts": "2026-09-02", "Reporting ends": "2026-09-02" },
    ]),
  );
  assert.equal(parsed.kind, "meta-ads-export");
  assert.equal(parsed.currency, "USD");
  assert.equal(parsed.rows, 3);
  assert.equal(parsed.days.length, 2, "two rows of one ad on one day are one ad-day");
  assert.equal(parsed.adNames.length, 2);
  assert.deepEqual([parsed.dateFrom, parsed.dateTo], ["2026-09-01", "2026-09-02"]);
  const merged = parsed.days.find((day) => day.adName === "ACME Hook 1");
  assert.equal(merged.spend, 15);
  assert.equal(merged.impressions, 4000);
  assert.equal(merged.results, 2);
  assert.equal(merged.linkClicks, 12);
  assert.equal(merged.resultIndicator, "actions:offsite_conversion.fb_pixel_purchase");
  assert.equal(Number(merged.hookRate.toFixed(3)), 0.2, "a rate is averaged by impressions, not added");
  assert.equal(parsed.days.find((day) => day.adName === "NV 6").results, 0, "a blank result is zero");
  assert.equal(merged.qualityRanking, null, "Meta's '-' means no ranking");
  assert.ok(parsed.warnings.some((warning) => /added together/.test(warning)));
});

test("a Meta export must be broken down by day, and a file that is neither template says what PRISM reads", () => {
  assert.throws(() => parseCsvImport(metaCsv([{ "Reporting starts": "2026-09-01", "Reporting ends": "2026-09-30" }])), /Breakdown → Time → Day/);
  assert.throws(() => parseCsvImport(metaCsv([{ "Reporting starts": "9/1/2026", "Reporting ends": "9/1/2026" }])), /reporting date/);
  assert.throws(() => parseCsvImport("a,b,c\n1,2,3"), /doesn't recognise this file/);
  assert.throws(() => parseCsvImport("a,b,c"), /no data rows/);
  const withBom = "﻿" + metaCsv([{}]);
  assert.equal(parseCsvImport(withBom).kind, "meta-ads-export", "a byte-order mark is ignored");
  assert.equal(parseCsvText('a,"b, c"\n1,"say ""hi"""')[1][1], 'say "hi"');
});

test("a Converty summary keeps each ad's order pipeline and reads month-first dates, with no currency in the file", () => {
  const parsed = parseCsvImport(convertyCsv(["111,NV 6,Acme,10,1,6,4,2,60.0%,66.7%,400,8/4/2026,9/14/2026,0,4,3,2", "222,ACME Hook 1,,5,0,3,2,1,60.0%,66.7%,200,8/5/2026,9/13/2026,0,2,1,1"]));
  assert.equal(parsed.kind, "converty-ad-summary");
  assert.equal(parsed.currency, null);
  assert.equal(parsed.ads.length, 2);
  assert.deepEqual([parsed.dateFrom, parsed.dateTo], ["2026-08-04", "2026-09-14"]);
  assert.equal(parsed.ads[0].campaign, "Acme");
  assert.equal(parsed.ads[1].campaign, null, "a blank campaign is no campaign");
  assert.deepEqual(parsed.ads[0].statuses, { delivered: 4, pending: 3, returned: 2 }, "only the statuses that occurred");
  assert.equal(parsed.ads[0].deliveredRevenue, 400);
  assert.equal(parsed.warnings.length, 0, "a 14 in second place proves month-first, so nothing to warn about");
  const ambiguous = parseCsvImport(convertyCsv(["111,A,V,1,0,1,1,0,1%,1%,10,8/4/2026,9/5/2026,0,1,0,0"]));
  assert.ok(ambiguous.warnings.some((warning) => /month-first/.test(warning)), "dates that fit either order are flagged");

  const dayFirst = parseCsvImport(convertyCsv(["111,A,V,1,0,1,1,0,1%,1%,10,25/12/2026,31/12/2026,0,1,0,0"]));
  assert.equal(dayFirst.ads[0].firstOrder, "2026-12-25", "a day above 12 in first place proves day-first");
  assert.throws(() => parseCsvImport(convertyCsv(["111,A,V,1,0,1,1,0,1%,1%,10,,,0,1,0,0", "111,B,V,1,0,1,1,0,1%,1%,10,,,0,1,0,0"])), /appears twice/);
});

test("products are placed by an assigned campaign first, then by an earlier import, then by a name; two names settle nothing", () => {
  const products = [{ id: "acme", name: "Acme" }, { id: "solar", name: "Solar Kit" }];
  const items = [
    { key: "1", adName: "NV 6", campaign: "Main CBO", rows: 3 },
    { key: "2", adName: "vx vsl7", campaign: null, rows: 2 },
    { key: "3", adName: "ACME Hook 1", campaign: null, rows: 4 },
    { key: "4", adName: "Solar Kit and Acme bundle", campaign: null, rows: 1 },
    { key: "5", adName: "Mystery", campaign: null, rows: 5 },
    { key: "6", adName: "Whatever", campaign: "ACME_SPRING", rows: 1 },
  ];
  const result = resolveProducts({
    items,
    products,
    assignments: [{ campaignName: "Main CBO", productId: "solar" }],
    knownAds: new Map([["vxvsl7", "acme"]]),
  });
  assert.deepEqual(Object.fromEntries([...result.placed].map(([key, value]) => [key, [value.productId, value.reason]])), {
    1: ["solar", "campaign"],
    2: ["acme", "earlier"],
    3: ["acme", "ad-name"],
    6: ["acme", "campaign-name"],
  });
  assert.deepEqual(result.unresolved.keys, ["4", "5"], "two products named, and no evidence at all, are both left for the person");
  assert.equal(result.unresolved.rows, 6);
  assert.equal(result.groups.get("acme").rows, 7);
});

async function withFixture(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "prism-csv-"));
  const previous = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = path.join(directory, "prism.db");
  const client = await import("../database/client.mjs");
  const auth = await import("../database/auth-repository.mjs");
  const data = await import("../database/workspace-data-repository.mjs");
  const meta = await import("../database/product-meta-campaigns-repository.mjs");
  const service = await import("../csv-import/service.mjs");
  const imports = await import("../database/csv-imports-repository.mjs");
  try {
    const alpha = (await auth.signInWithoutPassword({ displayName: "A", email: "a@example.com" })).workspace.id;
    const beta = (await auth.signInWithoutPassword({ displayName: "B", email: "b@example.com" })).workspace.id;
    const acme = await data.createWorkspaceProduct(alpha, { brandId: "brand-a", name: "Acme", description: "d" });
    const solar = await data.createWorkspaceProduct(alpha, { brandId: "brand-a", name: "Solar Kit", description: "d" });
    await run({ client, service, imports, meta, alpha, beta, acme, solar });
  } finally {
    service.clearCsvAnalyses();
    await client.closeDatabasePool();
    if (previous === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previous;
    await rm(directory, { recursive: true, force: true });
  }
}

const count = (client, table) => client.getDatabasePool().query(`select count(*) n from ${table}`).rows[0].n;

test("importing is analyse, then commit: nothing is saved until the questions are answered", async () => {
  await withFixture(async ({ client, service, alpha, acme }) => {
    const csv = metaCsv([{ "Ad name": "ACME Hook 1", "Amount spent (USD)": "10" }, { "Ad name": "NV 6", "Amount spent (USD)": "7" }, { "Ad name": "NV 7", "Amount spent (USD)": "3", "Reporting starts": "2026-09-02", "Reporting ends": "2026-09-02" }]);
    const analysis = service.analyzeCsvImport(alpha, { fileName: "Ads-export.csv", csv });
    assert.equal(count(client, "meta_ad_daily"), 0, "analysing writes nothing");
    assert.equal(analysis.kind, "meta-ads-export");
    assert.equal(analysis.currency, "USD");
    assert.equal(analysis.currencyKnown, true);
    assert.equal(analysis.adCount, 3);
    assert.deepEqual(analysis.products.map((p) => [p.productName, p.ads]), [["Acme", 1]], "one ad names the product");
    assert.equal(analysis.unresolved.ads, 2);
    assert.deepEqual(analysis.unresolved.samples.sort(), ["NV 6", "NV 7"]);
    assert.equal(analysis.suggestedProductId, acme.id, "the product the rest of the file went to is what is offered");

    assert.throws(() => service.commitCsvImport(alpha, analysis.analysisId, {}), /2 ads couldn't be matched/);
    assert.equal(count(client, "meta_ad_daily"), 0, "a refused commit writes nothing");
    assert.throws(() => service.commitCsvImport(alpha, analysis.analysisId, { assignUnresolvedTo: "nope" }), /isn't one of your products/);

    const done = service.commitCsvImport(alpha, analysis.analysisId, { assignUnresolvedTo: acme.id });
    assert.equal(done.imported, 3);
    assert.equal(done.skipped, 0);
    assert.deepEqual(done.products.map((p) => [p.productName, p.imported]), [["Acme", 3]]);
    assert.equal(count(client, "meta_ad_daily"), 3);
    assert.throws(() => service.commitCsvImport(alpha, analysis.analysisId, {}), /expired/, "an analysis is used once");
  });
});

test("unmatched ads can be skipped, and one product can be forced for a whole file", async () => {
  await withFixture(async ({ client, service, alpha, acme, solar }) => {
    const csv = metaCsv([{ "Ad name": "ACME Hook 1" }, { "Ad name": "NV 6" }]);
    const skip = service.commitCsvImport(alpha, service.analyzeCsvImport(alpha, { fileName: "a.csv", csv }).analysisId, { skipUnresolved: true });
    assert.deepEqual([skip.imported, skip.skipped], [1, 1]);
    assert.equal(client.getDatabasePool().query("select product_id from meta_ad_daily").rows[0].product_id, acme.id);

    const forced = service.commitCsvImport(alpha, service.analyzeCsvImport(alpha, { fileName: "a.csv", csv }).analysisId, { forceProductId: solar.id });
    assert.deepEqual(forced.products.map((p) => p.productName), ["Solar Kit"], "everything goes to the chosen product, whatever was detected");
    assert.equal(count(client, "meta_ad_daily"), 3, "the same ads in a second product are separate rows");
  });
});

test("importing an overlapping file again replaces its rows instead of doubling them", async () => {
  await withFixture(async ({ client, service, alpha }) => {
    const first = metaCsv([{ "Ad name": "ACME Hook 1", "Amount spent (USD)": "10" }, { "Ad name": "ACME Hook 1", "Reporting starts": "2026-09-02", "Reporting ends": "2026-09-02", "Amount spent (USD)": "20" }]);
    const one = service.commitCsvImport(alpha, service.analyzeCsvImport(alpha, { fileName: "week1.csv", csv: first }).analysisId, {});
    assert.deepEqual([one.imported, one.updated], [2, 0]);

    const second = metaCsv([{ "Ad name": "ACME Hook 1", "Reporting starts": "2026-09-02", "Reporting ends": "2026-09-02", "Amount spent (USD)": "25" }, { "Ad name": "ACME Hook 1", "Reporting starts": "2026-09-03", "Reporting ends": "2026-09-03", "Amount spent (USD)": "30" }]);
    const two = service.commitCsvImport(alpha, service.analyzeCsvImport(alpha, { fileName: "week2.csv", csv: second }).analysisId, {});
    assert.deepEqual([two.imported, two.updated], [2, 1], "one day was in both files");
    assert.equal(count(client, "meta_ad_daily"), 3);
    assert.equal(client.getDatabasePool().query("select spend from meta_ad_daily where day = '2026-09-02'").rows[0].spend, 25, "the newer file wins");
    assert.equal(count(client, "csv_imports"), 2, "each import is recorded");
  });
});

test("a Converty file asks for its currency, is placed by an assigned Meta campaign, and teaches the next Meta file", async () => {
  await withFixture(async ({ client, service, imports, meta, alpha, acme }) => {
    meta.setProductMetaCampaigns(alpha, acme.id, [{ id: "9001", name: "MAIN_CBO" }]);
    const converty = convertyCsv(["111,NV 6,MAIN_CBO,10,1,6,4,2,60.0%,66.7%,400,8/4/2026,9/14/2026,0,4,3,2", "222,vx vsl7,MAIN_CBO,5,0,3,2,1,60.0%,66.7%,200,8/5/2026,9/13/2026,0,2,1,1"]);
    const analysis = service.analyzeCsvImport(alpha, { fileName: "Acme – Converty Sync - Ad Summary.csv", csv: converty });
    assert.equal(analysis.currencyKnown, false);
    assert.deepEqual(analysis.products.map((p) => [p.productName, p.ads]), [["Acme", 2]]);
    assert.match(analysis.products[0].reason, /assigned/);
    assert.equal(analysis.unresolved.ads, 0);
    assert.throws(() => service.commitCsvImport(alpha, analysis.analysisId, {}), /which currency/);
    assert.throws(() => service.commitCsvImport(alpha, analysis.analysisId, { currency: "dinars" }), /which currency/);
    const done = service.commitCsvImport(alpha, analysis.analysisId, { currency: "tnd" });
    assert.equal(done.currency, "TND", "a currency is kept as a 3-letter capital code");
    assert.equal(count(client, "converty_ad_summary"), 2);
    assert.equal(client.getDatabasePool().query("select delivered_revenue r, first_order f from converty_ad_summary where ad_id = '111'").rows[0].f, "2026-08-04");
    assert.equal(imports.knownAdProducts(alpha).get("vxvsl7"), acme.id);

    // A Meta file that has no product name in it: its ads are placed because Converty already showed them belong to Acme.
    const next = service.analyzeCsvImport(alpha, { fileName: "export.csv", csv: metaCsv([{ "Ad name": "VX VSL7" }, { "Ad name": "NV 6" }, { "Ad name": "Unseen" }]) });
    assert.equal(next.products[0].ads, 2);
    assert.match(next.products[0].reason, /imported before/);
    assert.deepEqual(next.unresolved.samples, ["Unseen"]);
  });
});

test("coverage says what has been imported for a product, per template, and stays inside the product and workspace", async () => {
  await withFixture(async ({ service, imports, alpha, beta, acme, solar }) => {
    assert.deepEqual(imports.csvCoverage(alpha, acme.id), { meta: { rows: 0, dateFrom: null, dateTo: null, importedAt: null }, converty: { rows: 0, dateFrom: null, dateTo: null, importedAt: null } });

    const meta = metaCsv([{ "Ad name": "ACME Hook 1" }, { "Ad name": "ACME Hook 1", "Reporting starts": "2026-09-05", "Reporting ends": "2026-09-05" }]);
    service.commitCsvImport(alpha, service.analyzeCsvImport(alpha, { fileName: "a.csv", csv: meta }).analysisId, {});
    const coverage = imports.csvCoverage(alpha, acme.id);
    assert.deepEqual([coverage.meta.rows, coverage.meta.dateFrom, coverage.meta.dateTo], [2, "2026-09-01", "2026-09-05"]);
    assert.ok(coverage.meta.importedAt);
    assert.equal(coverage.converty.rows, 0, "the other template is still missing");

    const converty = convertyCsv(["111,ACME Hook 1,,5,0,3,2,1,60.0%,66.7%,200,8/5/2026,9/13/2026,0,2,1,1"]);
    service.commitCsvImport(alpha, service.analyzeCsvImport(alpha, { fileName: "b.csv", csv: converty }).analysisId, { currency: "TND" });
    assert.deepEqual([imports.csvCoverage(alpha, acme.id).converty.rows, imports.csvCoverage(alpha, acme.id).converty.dateTo], [1, "2026-09-13"]);
    assert.equal(imports.csvCoverage(alpha, solar.id).meta.rows, 0, "another product has nothing");
    assert.equal(imports.csvCoverage(beta, acme.id).meta.rows, 0, "another workspace has nothing");
  });
});

test("imported ads join the Meta export and the Converty summary by ad name, and keep unattributed orders apart", async () => {
  await withFixture(async ({ service, imports, alpha, acme, solar }) => {
    const meta = metaCsv([
      { "Ad name": "ACME Hook 1", "Amount spent (USD)": "10", Impressions: "1000", "Link clicks": "20", Results: "1", "Hook rate": "0.4" },
      { "Ad name": "ACME Hook 1", "Reporting starts": "2026-09-02", "Reporting ends": "2026-09-02", "Amount spent (USD)": "30", Impressions: "3000", "Link clicks": "40", Results: "2", "Result indicator": "actions:offsite_conversion.fb_pixel_purchase", "Hook rate": "0.2" },
      { "Ad name": "ACME Hook 2", "Amount spent (USD)": "5", Impressions: "500", "Ad delivery": "inactive" },
    ]);
    service.commitCsvImport(alpha, service.analyzeCsvImport(alpha, { fileName: "m.csv", csv: meta }).analysisId, {});
    const converty = convertyCsv([
      "111,acme hook 1,,10,1,6,4,2,60.0%,66.7%,400,8/4/2026,9/14/2026,0,4,3,2",
      "(no ad attribution),,,3,0,1,1,0,1%,1%,50,8/5/2026,9/5/2026,0,1,0,0",
    ]);
    service.commitCsvImport(alpha, service.analyzeCsvImport(alpha, { fileName: "c.csv", csv: converty }).analysisId, { currency: "TND", assignUnresolvedTo: acme.id });

    const result = imports.importedAdPerformance(alpha, acme.id);
    assert.deepEqual(result.ads.map((ad) => ad.name), ["ACME Hook 1", "ACME Hook 2"], "by spend");
    const one = result.ads[0];
    assert.deepEqual([one.hasMeta, one.hasConverty], [true, true], "a different capitalisation is the same ad");
    assert.deepEqual([one.spend, one.impressions, one.linkClicks, one.results, one.days], [40, 4000, 60, 3, 2], "added up over every imported day");
    assert.deepEqual([one.purchases, result.ads[1].purchases, result.totals.purchases], [2, 0, 2], "only the day whose result is a purchase counts, per ad and in total");
    assert.equal(Number(one.hookRate.toFixed(3)), 0.25, "the hook rate is weighted by impressions");
    assert.deepEqual([one.orders, one.deleted, one.confirmed, one.delivered, one.returned, one.deliveredRevenue], [10, 1, 6, 4, 2, 400]);
    const two = result.ads[1];
    assert.deepEqual([two.hasMeta, two.hasConverty, two.orders, two.delivery], [true, false, 0, "inactive"], "an ad with spend and no orders");
    assert.deepEqual(result.unattributed, { orders: 3, deleted: 0, confirmed: 1, delivered: 1, returned: 0, deliveredRevenue: 50 }, "orders with no ad are kept apart, not made into an ad");
    assert.equal(result.ads.length, 2);
    // The order file's days are 2026-08-04 .. 2026-09-14; the Meta export's two days (09-01, 09-02) are inside them.
    assert.deepEqual([one.spendInOrderWindow, two.spendInOrderWindow], [40, 5], "spend over the days the order file covers");
    assert.equal(result.totals.orders, 13, "but they count in the totals");
    assert.equal(result.totals.spend, 45);
    assert.deepEqual(result.daily.map((day) => [day.date, day.spend, day.impressions, day.purchases]), [["2026-09-01", 15, 1500, 0], ["2026-09-02", 30, 3000, 2]], "the export by day, added up across ads; only purchase results count as purchases");
    assert.deepEqual([result.meta.currency, result.converty.currency], ["USD", "TND"], "each file keeps its own currency");
    assert.deepEqual([result.meta.dateFrom, result.meta.dateTo], ["2026-09-01", "2026-09-02"]);

    assert.deepEqual(imports.importedAdPerformance(alpha, solar.id).ads, [], "another product has none");
    assert.equal(imports.importedAdPerformance(alpha, null).ads.length, 2, "no product means every product");
  });
});

test("an import can be removed: it takes the rows it owns and leaves rows a newer import replaced", async () => {
  await withFixture(async ({ client, service, imports, alpha, beta }) => {
    const first = service.commitCsvImport(alpha, service.analyzeCsvImport(alpha, { fileName: "one.csv", csv: metaCsv([{ "Ad name": "ACME Hook 1" }, { "Ad name": "ACME Hook 1", "Reporting starts": "2026-09-02", "Reporting ends": "2026-09-02" }]) }).analysisId, {});
    const second = service.commitCsvImport(alpha, service.analyzeCsvImport(alpha, { fileName: "two.csv", csv: metaCsv([{ "Ad name": "ACME Hook 1", "Reporting starts": "2026-09-02", "Reporting ends": "2026-09-02", "Amount spent (USD)": "99" }]) }).analysisId, {});
    assert.equal(count(client, "meta_ad_daily"), 2);
    assert.deepEqual(imports.listCsvImports(alpha).map((record) => [record.fileName, record.rowsImported, record.rowsHeld]), [["two.csv", 1, 1], ["one.csv", 2, 1]], "the older file has one row left in use");

    assert.equal(imports.deleteCsvImport(beta, first.importId), null, "another workspace cannot remove it");
    assert.equal(imports.deleteCsvImport(alpha, first.importId), 1, "only the day the newer file did not replace");
    assert.equal(count(client, "meta_ad_daily"), 1);
    assert.equal(client.getDatabasePool().query("select spend from meta_ad_daily").rows[0].spend, 99, "the newer file's row stays");
    assert.deepEqual(imports.listCsvImports(alpha).map((record) => record.fileName), ["two.csv"]);
    assert.equal(imports.deleteCsvImport(alpha, "nope"), null);
    assert.equal(imports.deleteCsvImport(alpha, second.importId), 1);
    assert.equal(count(client, "meta_ad_daily"), 0);
  });
});

test("importing the same file twice and removing the second copy leaves the data with the first import", async () => {
  await withFixture(async ({ client, service, imports, alpha }) => {
    const csv = metaCsv([{ "Ad name": "ACME Hook 1", "Amount spent (USD)": "10" }, { "Ad name": "ACME Hook 1", "Reporting starts": "2026-09-02", "Reporting ends": "2026-09-02", "Amount spent (USD)": "20" }]);
    const first = service.commitCsvImport(alpha, service.analyzeCsvImport(alpha, { fileName: "same.csv", csv }).analysisId, {});
    const again = service.commitCsvImport(alpha, service.analyzeCsvImport(alpha, { fileName: "same.csv", csv }).analysisId, {});
    assert.deepEqual([again.imported, again.updated, again.unchanged, again.importId], [0, 0, 2, null], "nothing changed, so nothing was recorded");
    assert.equal(count(client, "csv_imports"), 1, "no second record for the same file");
    assert.equal(count(client, "meta_ad_daily"), 2, "the data is still there");
    assert.deepEqual(imports.listCsvImports(alpha).map((record) => [record.fileName, record.rowsImported]), [["same.csv", 2]]);
    assert.equal(imports.deleteCsvImport(alpha, first.importId), 2, "the first import owns the rows");
    assert.equal(count(client, "meta_ad_daily"), 0);
  });
});

test("an import record remembers which products it went to", async () => {
  await withFixture(async ({ service, imports, alpha, acme }) => {
    service.commitCsvImport(alpha, service.analyzeCsvImport(alpha, { fileName: "a.csv", csv: metaCsv([{ "Ad name": "ACME Hook 1" }]) }).analysisId, {});
    const [record] = imports.listCsvImports(alpha);
    assert.deepEqual([record.products, record.productIds], [["Acme"], [acme.id]]);
  });
});

test("orders Converty could not attribute to an ad follow the rest of the file, or are asked about when the file spans products", () => {
  const products = [{ id: "acme", name: "Acme" }, { id: "solar", name: "Solar Kit" }];
  const one = resolveProducts({ items: [{ key: "1", adName: "ACME Hook 1", campaign: null, rows: 1 }, { key: "(no ad attribution)", adName: "(no ad attribution)", campaign: null, rows: 1, unattributed: true }], products });
  assert.equal(one.placed.get("(no ad attribution)").productId, "acme", "the rest of the file is one product");
  assert.deepEqual(one.unresolved.keys, []);

  const two = resolveProducts({ items: [{ key: "1", adName: "ACME Hook 1", campaign: null, rows: 1 }, { key: "2", adName: "Solar Kit ad", campaign: null, rows: 1 }, { key: "(x)", adName: "(x)", campaign: null, rows: 1, unattributed: true }], products });
  assert.deepEqual(two.unresolved.keys, ["(x)"], "with two products in the file there is no telling");

  const none = resolveProducts({ items: [{ key: "(x)", adName: "(x)", campaign: null, rows: 1, unattributed: true }], products });
  assert.deepEqual(none.unresolved.keys, ["(x)"]);
});

test("analyses and imports stay inside their workspace, and there must be a product to import into", async () => {
  await withFixture(async ({ service, imports, alpha, beta }) => {
    const csv = metaCsv([{}]);
    const analysis = service.analyzeCsvImport(alpha, { fileName: "a.csv", csv });
    assert.throws(() => service.commitCsvImport(beta, analysis.analysisId, {}), /expired/, "another workspace cannot use it");
    assert.throws(() => service.analyzeCsvImport(beta, { fileName: "a.csv", csv }), /Create a product first/);
    service.commitCsvImport(alpha, analysis.analysisId, {});
    assert.equal(imports.listCsvImports(alpha).length, 1);
    assert.deepEqual(imports.listCsvImports(beta), []);
    assert.equal(imports.listCsvImports(alpha)[0].kind, "meta-ads-export");
    assert.throws(() => service.analyzeCsvImport(alpha, { fileName: "  ", csv }), /no name/);
    assert.throws(() => service.analyzeCsvImport(alpha, { fileName: "a.csv", csv: "x".repeat(6 * 1024 * 1024) }), /over 5 MB/);
  });
});

test("spend for a cost per confirmed order only counts the days the order file covers", async () => {
  await withFixture(async ({ service, imports, alpha, acme }) => {
    const meta = metaCsv([
      { "Ad name": "ACME Hook 1", "Reporting starts": "2026-07-30", "Reporting ends": "2026-07-30", "Amount spent (USD)": "100" },
      { "Ad name": "ACME Hook 1", "Reporting starts": "2026-08-10", "Reporting ends": "2026-08-10", "Amount spent (USD)": "40" },
    ]);
    service.commitCsvImport(alpha, service.analyzeCsvImport(alpha, { fileName: "m.csv", csv: meta }).analysisId, {});
    const converty = convertyCsv(["111,acme hook 1,,10,1,6,4,2,60.0%,66.7%,400,8/4/2026,9/14/2026,0,4,3,2"]);
    service.commitCsvImport(alpha, service.analyzeCsvImport(alpha, { fileName: "c.csv", csv: converty }).analysisId, { currency: "TND" });
    const [one] = imports.importedAdPerformance(alpha, acme.id).ads;
    assert.deepEqual([one.spend, one.spendInOrderWindow], [140, 40], "the 07-30 spend is before the order file starts");
  });
});
