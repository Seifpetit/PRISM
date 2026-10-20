import { randomUUID } from "node:crypto";
import { getDatabasePool } from "./client.mjs";

// Test campaigns: campaign -> concepts (ad sets) -> ads. See migration 013 for the model.

export const TEST_TYPES = ["angle", "offer", "persona"];
export const CAMPAIGN_KINDS = ["test", "scaling", "retargeting"];
const KIND_NAME = { test: "Test", scaling: "Scaling", retargeting: "Retargeting" };
export const AD_FORMATS = ["photo", "static_ad", "carousel", "video", "ugc_video", "ai_talking_head", "motion_graphic"];
export const AWARENESS_LEVELS = ["unaware", "problem_aware", "solution_aware", "product_aware"];

export const MAX_CONCEPTS_PER_CAMPAIGN = 50;
export const MAX_ADS_PER_CONCEPT = 20;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CampaignInputError extends Error {}

function fail(message) {
  throw new CampaignInputError(message);
}

function cleanText(value, label, max) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (text.length > max) fail(`${label} must be ${max} characters or fewer.`);
  return text || null;
}

function cleanDate(value, label) {
  if (value === undefined || value === null || value === "") return null;
  if (!DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) fail(`${label} must be a date like 2026-09-30.`);
  return value;
}

function cleanSpend(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) fail("Spend must be zero or more.");
  return number;
}

function cleanPosition(value, label) {
  if (value === undefined || value === null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) fail(`${label} must be a number.`);
  return number;
}

function adView(row) {
  return {
    id: row.id,
    conceptId: row.concept_id,
    order: row.ord,
    format: row.format,
    awareness: row.awareness,
    title: row.title ?? null,
    hook: row.hook ?? null,
    direction: row.direction ?? null,
    beats: parseBeats(row.beats),
    cta: row.cta ?? null,
    notes: row.notes ?? null,
    imageStatus: row.image_status ?? "none",
    imageUrl: row.image_url ?? null,
    metaPublishStatus: row.meta_publish_status ?? "none",
    metaAdId: row.meta_ad_id ?? null,
    metaPublishError: row.meta_publish_error ?? null,
  };
}

function parseBeats(value) {
  if (!value) return [];
  try {
    const list = JSON.parse(value);
    return Array.isArray(list) ? list.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function conceptView(row, ads) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    productId: row.product_id,
    avatarId: row.avatar_id,
    angleId: row.angle_id,
    offerId: row.offer_id,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    spend: row.spend ?? null,
    positionX: row.position_x ?? null,
    positionY: row.position_y ?? null,
    createdAt: row.created_at,
    metaAdSetId: row.meta_adset_id ?? null,
    ads,
  };
}

function campaignView(row, concepts) {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    kind: row.kind,
    testType: row.test_type,
    positionX: row.position_x ?? null,
    positionY: row.position_y ?? null,
    createdAt: row.created_at,
    metaCampaignId: row.meta_campaign_id ?? null,
    concepts,
  };
}

/** All campaigns for a product with their concepts and ads, oldest first. */
export function listCampaigns(workspaceId, productId) {
  const db = getDatabasePool();
  const campaigns = db.query(
    `select * from campaigns where workspace_id = $1 and product_id = $2 order by created_at, rowid`,
    [workspaceId, productId],
  ).rows;
  if (!campaigns.length) return [];
  const concepts = db.query(
    `select c.* from campaign_concepts c join campaigns k on k.id = c.campaign_id and k.workspace_id = c.workspace_id
     where c.workspace_id = $1 and k.product_id = $2 order by c.created_at, c.rowid`,
    [workspaceId, productId],
  ).rows;
  const ads = db.query(
    `select a.* from campaign_ads a join campaign_concepts c on c.id = a.concept_id and c.workspace_id = a.workspace_id
     where a.workspace_id = $1 and c.product_id = $2 order by a.ord, a.created_at, a.rowid`,
    [workspaceId, productId],
  ).rows;
  const adsByConcept = new Map();
  ads.forEach((row) => adsByConcept.set(row.concept_id, [...(adsByConcept.get(row.concept_id) ?? []), adView(row)]));
  const conceptsByCampaign = new Map();
  concepts.forEach((row) =>
    conceptsByCampaign.set(row.campaign_id, [
      ...(conceptsByCampaign.get(row.campaign_id) ?? []),
      conceptView(row, adsByConcept.get(row.id) ?? []),
    ]),
  );
  return campaigns.map((row) => campaignView(row, conceptsByCampaign.get(row.id) ?? []));
}

function campaignRow(workspaceId, id) {
  return getDatabasePool().query(`select * from campaigns where workspace_id = $1 and id = $2`, [workspaceId, id]).rows[0];
}

export function getCampaign(workspaceId, id) {
  const row = campaignRow(workspaceId, id);
  return row ? listCampaigns(workspaceId, row.product_id).find((campaign) => campaign.id === id) ?? null : null;
}

export function createCampaign(workspaceId, { productId, name, kind = "test", testType = "angle", positionX, positionY }) {
  if (!CAMPAIGN_KINDS.includes(kind)) fail(`Campaign kind must be one of: ${CAMPAIGN_KINDS.join(", ")}.`);
  if (!TEST_TYPES.includes(testType)) fail(`Test type must be one of: ${TEST_TYPES.join(", ")}.`);
  const now = new Date().toISOString();
  const count = getDatabasePool().query(
    `select count(*) n from campaigns where workspace_id = $1 and product_id = $2 and kind = $3`,
    [workspaceId, productId, kind],
  ).rows[0].n;
  const id = randomUUID();
  getDatabasePool().query(
    `insert into campaigns (id, workspace_id, product_id, name, kind, test_type, position_x, position_y, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
    [
      id,
      workspaceId,
      productId,
      cleanText(name, "Name", 80) ?? `${KIND_NAME[kind]} ${count + 1}`,
      kind,
      testType,
      cleanPosition(positionX, "Position"),
      cleanPosition(positionY, "Position"),
      now,
    ],
  );
  return getCampaign(workspaceId, id);
}

/** Only the fields present in `patch` change; `null` clears a nullable one. */
export function updateCampaign(workspaceId, id, patch) {
  const existing = campaignRow(workspaceId, id);
  if (!existing) return null;
  const next = {
    name: existing.name,
    kind: existing.kind,
    test_type: existing.test_type,
    position_x: existing.position_x,
    position_y: existing.position_y,
  };
  if ("name" in patch) next.name = cleanText(patch.name, "Name", 80) ?? existing.name;
  if ("kind" in patch && patch.kind !== null) {
    if (!CAMPAIGN_KINDS.includes(patch.kind)) fail(`Campaign kind must be one of: ${CAMPAIGN_KINDS.join(", ")}.`);
    next.kind = patch.kind;
  }
  if ("testType" in patch && patch.testType !== null) {
    if (!TEST_TYPES.includes(patch.testType)) fail(`Test type must be one of: ${TEST_TYPES.join(", ")}.`);
    next.test_type = patch.testType;
  }
  if ("positionX" in patch) next.position_x = cleanPosition(patch.positionX, "Position");
  if ("positionY" in patch) next.position_y = cleanPosition(patch.positionY, "Position");
  getDatabasePool().query(
    `update campaigns set name = $3, kind = $4, test_type = $5, position_x = $6, position_y = $7, updated_at = $8
     where workspace_id = $1 and id = $2`,
    [workspaceId, id, next.name, next.kind, next.test_type, next.position_x, next.position_y, new Date().toISOString()],
  );
  return getCampaign(workspaceId, id);
}

export function deleteCampaign(workspaceId, id) {
  return getDatabasePool().query(`delete from campaigns where workspace_id = $1 and id = $2`, [workspaceId, id]).rowCount > 0;
}

/**
 * Adds one concept (ad set) per persona x angle x offer combination. Combinations already in the campaign
 * are skipped, not duplicated. The caller has already checked that each id belongs to the product.
 */
export function addCampaignConcepts(workspaceId, campaignId, combos) {
  const campaign = campaignRow(workspaceId, campaignId);
  if (!campaign) fail("Campaign not found.");
  const db = getDatabasePool();
  let inserted;
  db.exec("BEGIN");
  try {
    inserted = insertConcepts(workspaceId, campaign, combos);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  const all = getCampaign(workspaceId, campaignId).concepts;
  return { created: all.filter((concept) => inserted.createdIds.includes(concept.id)), skipped: inserted.skipped };
}

/** The inserts behind addCampaignConcepts. It opens no transaction, so a caller can make it part of a larger one. */
function insertConcepts(workspaceId, campaign, combos) {
  const db = getDatabasePool();
  const existing = db.query(
    `select avatar_id, angle_id, offer_id from campaign_concepts where workspace_id = $1 and campaign_id = $2`,
    [workspaceId, campaign.id],
  ).rows;
  const keyOf = (c) => `${c.avatar_id ?? c.avatarId}|${c.angle_id ?? c.angleId}|${c.offer_id ?? c.offerId}`;
  const seen = new Set(existing.map(keyOf));
  const fresh = [];
  for (const combo of combos) {
    const key = keyOf(combo);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(combo);
  }
  if (existing.length + fresh.length > MAX_CONCEPTS_PER_CAMPAIGN) {
    fail(`A campaign can hold at most ${MAX_CONCEPTS_PER_CAMPAIGN} concepts.`);
  }
  const now = new Date().toISOString();
  const createdIds = [];
  for (const combo of fresh) {
    const id = randomUUID();
    createdIds.push(id);
    db.query(
      `insert into campaign_concepts (id, workspace_id, campaign_id, product_id, avatar_id, angle_id, offer_id, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
      [id, workspaceId, campaign.id, campaign.product_id, combo.avatarId, combo.angleId, combo.offerId, now],
    );
  }
  return { createdIds, skipped: combos.length - fresh.length };
}

/**
 * Creates a campaign together with its first ad sets in one transaction: either the campaign exists with
 * all of them, or nothing was created. The caller has already checked that each id belongs to the product.
 */
export function createCampaignWithConcepts(workspaceId, { combos, ...campaignInput }) {
  if (!Array.isArray(combos) || combos.length === 0) fail("Pick at least one ad set for the campaign.");
  const db = getDatabasePool();
  db.exec("BEGIN");
  try {
    const campaign = createCampaign(workspaceId, campaignInput);
    insertConcepts(workspaceId, campaignRow(workspaceId, campaign.id), combos);
    db.exec("COMMIT");
    return getCampaign(workspaceId, campaign.id);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function conceptRow(workspaceId, id) {
  return getDatabasePool().query(`select * from campaign_concepts where workspace_id = $1 and id = $2`, [workspaceId, id]).rows[0];
}

export function getCampaignConcept(workspaceId, id) {
  const row = conceptRow(workspaceId, id);
  if (!row) return null;
  return listCampaigns(workspaceId, row.product_id)
    .flatMap((campaign) => campaign.concepts)
    .find((concept) => concept.id === id) ?? null;
}

export function updateCampaignConcept(workspaceId, id, patch) {
  const existing = conceptRow(workspaceId, id);
  if (!existing) return null;
  const next = {
    start_date: existing.start_date,
    end_date: existing.end_date,
    spend: existing.spend,
    position_x: existing.position_x,
    position_y: existing.position_y,
  };
  if ("startDate" in patch) next.start_date = cleanDate(patch.startDate, "Start date");
  if ("endDate" in patch) next.end_date = cleanDate(patch.endDate, "End date");
  if (next.start_date && next.end_date && next.end_date < next.start_date) fail("The end date can't be before the start date.");
  if ("spend" in patch) next.spend = cleanSpend(patch.spend);
  if ("positionX" in patch) next.position_x = cleanPosition(patch.positionX, "Position");
  if ("positionY" in patch) next.position_y = cleanPosition(patch.positionY, "Position");
  getDatabasePool().query(
    `update campaign_concepts set start_date = $3, end_date = $4, spend = $5, position_x = $6, position_y = $7, updated_at = $8
     where workspace_id = $1 and id = $2`,
    [workspaceId, id, next.start_date, next.end_date, next.spend, next.position_x, next.position_y, new Date().toISOString()],
  );
  return getCampaignConcept(workspaceId, id);
}

/**
 * An empty ad set: no persona, angle or offer yet. The columns are NOT NULL and unique per combination, so each
 * empty slot holds a placeholder id that points at nothing ("~<ad set id>:<slot>"). That is exactly how a removed
 * ingredient already looks (the ad set survives and the slot reads as unlinked), so linking one later is the
 * existing relink. The placeholder is unique per ad set, so any number of empty ad sets can exist.
 */
const SLOT_COLUMN = { avatar: "avatar_id", angle: "angle_id", offer: "offer_id" };
const emptySlotId = (conceptId, slot) => `~${conceptId}:${slot}`;

export function createEmptyCampaignConcept(workspaceId, campaignId, { positionX, positionY } = {}) {
  const campaign = campaignRow(workspaceId, campaignId);
  if (!campaign) fail("Campaign not found.");
  const db = getDatabasePool();
  const { n } = db.query(`select count(*) as n from campaign_concepts where workspace_id = $1 and campaign_id = $2`, [workspaceId, campaignId]).rows[0];
  if (n + 1 > MAX_CONCEPTS_PER_CAMPAIGN) fail(`A campaign can hold at most ${MAX_CONCEPTS_PER_CAMPAIGN} concepts.`);
  const id = randomUUID();
  const now = new Date().toISOString();
  db.query(
    `insert into campaign_concepts (id, workspace_id, campaign_id, product_id, avatar_id, angle_id, offer_id, position_x, position_y, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
    [
      id,
      workspaceId,
      campaignId,
      campaign.product_id,
      emptySlotId(id, "avatar"),
      emptySlotId(id, "angle"),
      emptySlotId(id, "offer"),
      positionX == null ? null : cleanPosition(positionX, "Position"),
      positionY == null ? null : cleanPosition(positionY, "Position"),
      now,
    ],
  );
  return getCampaignConcept(workspaceId, id);
}

/** Cuts one ingredient link of an ad set: the slot goes back to empty. The ad set keeps its ads and its other links. */
export function unlinkCampaignConceptSlot(workspaceId, id, slot) {
  const column = SLOT_COLUMN[slot];
  if (!column) fail("Choose persona, angle or offer.");
  if (!conceptRow(workspaceId, id)) return null;
  getDatabasePool().query(
    `update campaign_concepts set ${column} = $3, updated_at = $4 where workspace_id = $1 and id = $2`,
    [workspaceId, id, emptySlotId(id, slot), new Date().toISOString()],
  );
  return getCampaignConcept(workspaceId, id);
}

export function deleteCampaignConcept(workspaceId, id) {
  return getDatabasePool().query(`delete from campaign_concepts where workspace_id = $1 and id = $2`, [workspaceId, id]).rowCount > 0;
}

function adRow(workspaceId, id) {
  return getDatabasePool().query(`select * from campaign_ads where workspace_id = $1 and id = $2`, [workspaceId, id]).rows[0];
}

function cleanBeats(value) {
  if (value === null) return [];
  if (!Array.isArray(value)) fail("Beats must be a list of steps.");
  if (value.length > 10) fail("An ad can have at most 10 beats.");
  return value.map((beat) => cleanText(beat, "A beat", 600)).filter(Boolean);
}

function cleanAdFields({ format, awareness, title, hook, notes, direction, beats, cta }, base) {
  const out = { ...base };
  if (format !== undefined && format !== null) {
    if (!AD_FORMATS.includes(format)) fail(`Format must be one of: ${AD_FORMATS.join(", ")}.`);
    out.format = format;
  }
  if (awareness !== undefined && awareness !== null) {
    if (!AWARENESS_LEVELS.includes(awareness)) fail(`Awareness must be one of: ${AWARENESS_LEVELS.join(", ")}.`);
    out.awareness = awareness;
  }
  if (title !== undefined) out.title = cleanText(title, "Title", 120);
  if (hook !== undefined) out.hook = cleanText(hook, "Hook", 500);
  if (notes !== undefined) out.notes = cleanText(notes, "Notes", 2000);
  if (direction !== undefined) out.direction = cleanText(direction, "Direction", 1200);
  if (beats !== undefined) out.beats = cleanBeats(beats);
  if (cta !== undefined) out.cta = cleanText(cta, "Call to action", 200);
  return out;
}

const AD_DEFAULTS = { format: "video", awareness: "problem_aware", title: null, hook: null, notes: null, direction: null, beats: [], cta: null };

function insertAd(db, workspaceId, conceptId, order, values, now) {
  const id = randomUUID();
  db.query(
    `insert into campaign_ads (id, workspace_id, concept_id, ord, format, awareness, hook, notes, direction, beats, cta, title, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)`,
    [id, workspaceId, conceptId, order, values.format, values.awareness, values.hook, values.notes, values.direction, JSON.stringify(values.beats), values.cta, values.title, now],
  );
  return id;
}

export function addCampaignAd(workspaceId, conceptId, fields = {}) {
  if (!conceptRow(workspaceId, conceptId)) fail("Concept not found.");
  const count = getDatabasePool().query(
    `select count(*) n, coalesce(max(ord), -1) top from campaign_ads where workspace_id = $1 and concept_id = $2`,
    [workspaceId, conceptId],
  ).rows[0];
  if (count.n >= MAX_ADS_PER_CONCEPT) fail(`A concept can hold at most ${MAX_ADS_PER_CONCEPT} ads.`);
  const values = cleanAdFields(fields, AD_DEFAULTS);
  const id = insertAd(getDatabasePool(), workspaceId, conceptId, count.top + 1, values, new Date().toISOString());
  return adView(adRow(workspaceId, id));
}

/**
 * Adds several ads to an ad set at once (a generated plan). All of them are validated first and saved together,
 * so a bad one saves none. Returns the new ads in order.
 */
export function addCampaignAds(workspaceId, conceptId, list) {
  if (!conceptRow(workspaceId, conceptId)) fail("Concept not found.");
  if (!Array.isArray(list) || list.length === 0) fail("There are no ads to add.");
  const db = getDatabasePool();
  const count = db.query(
    `select count(*) n, coalesce(max(ord), -1) top from campaign_ads where workspace_id = $1 and concept_id = $2`,
    [workspaceId, conceptId],
  ).rows[0];
  const room = MAX_ADS_PER_CONCEPT - count.n;
  if (room <= 0) fail(`A concept can hold at most ${MAX_ADS_PER_CONCEPT} ads.`);
  const cleaned = list.slice(0, room).map((fields) => cleanAdFields(fields, AD_DEFAULTS));
  const now = new Date().toISOString();
  const ids = [];
  db.exec("BEGIN");
  try {
    cleaned.forEach((values, index) => ids.push(insertAd(db, workspaceId, conceptId, count.top + 1 + index, values, now)));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return ids.map((id) => adView(adRow(workspaceId, id)));
}

export function getCampaignAd(workspaceId, id) {
  const row = adRow(workspaceId, id);
  return row ? adView(row) : null;
}

export function updateCampaignAd(workspaceId, id, patch) {
  const existing = adRow(workspaceId, id);
  if (!existing) return null;
  const values = cleanAdFields(patch, {
    format: existing.format,
    awareness: existing.awareness,
    title: existing.title ?? null,
    hook: existing.hook,
    notes: existing.notes,
    direction: existing.direction ?? null,
    beats: parseBeats(existing.beats),
    cta: existing.cta ?? null,
  });
  getDatabasePool().query(
    `update campaign_ads set format = $3, awareness = $4, hook = $5, notes = $6, direction = $7, beats = $8, cta = $9, title = $10, updated_at = $11
     where workspace_id = $1 and id = $2`,
    [workspaceId, id, values.format, values.awareness, values.hook, values.notes, values.direction, JSON.stringify(values.beats), values.cta, values.title, new Date().toISOString()],
  );
  return adView(adRow(workspaceId, id));
}

export function deleteCampaignAd(workspaceId, id) {
  return getDatabasePool().query(`delete from campaign_ads where workspace_id = $1 and id = $2`, [workspaceId, id]).rowCount > 0;
}

const AD_IMAGE_STATUSES = ["none", "pending", "ready", "failed"];

/**
 * Records the outcome of one ad's thumbnail generation. Separate from updateCampaignAd because it is written
 * by the generation pipeline (backend/creative-exploration/ad-thumbnails.mjs), never directly by a person.
 */
export function setCampaignAdImage(workspaceId, id, { status, url = null }) {
  if (!AD_IMAGE_STATUSES.includes(status)) fail(`Image status must be one of: ${AD_IMAGE_STATUSES.join(", ")}.`);
  const existing = adRow(workspaceId, id);
  if (!existing) return null;
  getDatabasePool().query(
    `update campaign_ads set image_status = $3, image_url = $4, updated_at = $5 where workspace_id = $1 and id = $2`,
    [workspaceId, id, status, status === "ready" ? url : null, new Date().toISOString()],
  );
  return adView(adRow(workspaceId, id));
}

/** Records the Meta Campaign this PRISM campaign became, the first time any of its ad sets is published. */
export function setCampaignMetaId(workspaceId, id, metaCampaignId) {
  const result = getDatabasePool().query(
    `update campaigns set meta_campaign_id = $3, updated_at = $4 where workspace_id = $1 and id = $2`,
    [workspaceId, id, metaCampaignId, new Date().toISOString()],
  );
  return result.rowCount > 0 ? getCampaign(workspaceId, id) : null;
}

/** Records the Meta Ad Set an ad set (concept) became, and the publish inputs it was created with. */
export function setConceptMetaAdSet(workspaceId, id, { metaAdSetId, pageId, destinationUrl, dailyBudgetCents }) {
  const result = getDatabasePool().query(
    `update campaign_concepts
     set meta_adset_id = $3, meta_page_id = $4, meta_destination_url = $5, meta_daily_budget_cents = $6, updated_at = $7
     where workspace_id = $1 and id = $2`,
    [workspaceId, id, metaAdSetId, pageId, destinationUrl, dailyBudgetCents, new Date().toISOString()],
  );
  return result.rowCount > 0 ? getCampaignConcept(workspaceId, id) : null;
}

const META_PUBLISH_STATUSES = ["none", "published", "failed"];

/** Records the outcome of publishing one ad to Meta. Written by meta-publish.mjs, never directly by a person. */
export function setAdMetaPublish(workspaceId, id, { status, metaCreativeId = null, metaAdId = null, error = null }) {
  if (!META_PUBLISH_STATUSES.includes(status)) fail(`Meta publish status must be one of: ${META_PUBLISH_STATUSES.join(", ")}.`);
  const existing = adRow(workspaceId, id);
  if (!existing) return null;
  getDatabasePool().query(
    `update campaign_ads set meta_publish_status = $3, meta_creative_id = $4, meta_ad_id = $5, meta_publish_error = $6, updated_at = $7
     where workspace_id = $1 and id = $2`,
    [workspaceId, id, status, status === "published" ? metaCreativeId : null, status === "published" ? metaAdId : null, status === "failed" ? error : null, new Date().toISOString()],
  );
  return adView(adRow(workspaceId, id));
}

/**
 * Points an ad set's removed persona, angle or offer at another one. The caller has checked that the old id is
 * gone and the new one exists in the product. The ad set keeps its ads, dates and place on the canvas.
 */
export function relinkCampaignConcept(workspaceId, id, { avatarId, angleId, offerId }) {
  const existing = conceptRow(workspaceId, id);
  if (!existing) return null;
  const next = {
    avatar_id: avatarId ?? existing.avatar_id,
    angle_id: angleId ?? existing.angle_id,
    offer_id: offerId ?? existing.offer_id,
  };
  const twin = getDatabasePool().query(
    `select id from campaign_concepts
     where workspace_id = $1 and campaign_id = $2 and avatar_id = $3 and angle_id = $4 and offer_id = $5 and id <> $6`,
    [workspaceId, existing.campaign_id, next.avatar_id, next.angle_id, next.offer_id, id],
  ).rows[0];
  if (twin) fail("This campaign already has an ad set with that persona, angle and offer.");
  getDatabasePool().query(
    `update campaign_concepts set avatar_id = $3, angle_id = $4, offer_id = $5, updated_at = $6 where workspace_id = $1 and id = $2`,
    [workspaceId, id, next.avatar_id, next.angle_id, next.offer_id, new Date().toISOString()],
  );
  return getCampaignConcept(workspaceId, id);
}
