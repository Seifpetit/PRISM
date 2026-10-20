import { setCampaignMetaId, setConceptMetaAdSet, setAdMetaPublish } from "../database/campaigns-repository.mjs";
import { createMetaCampaign, createMetaAdSet, uploadAdImage, createMetaAdCreative, createMetaAd } from "./meta-ads-write.mjs";

const MAX_AD_NAME = 60;

function shorten(text, max) {
  const trimmed = (text ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/** What an ad becomes as its Meta creative/ad name, mirroring types/campaign.ts's adDisplayTitle fallback order. */
function adName(ad) {
  return shorten(ad.title, MAX_AD_NAME) ?? shorten(ad.hook, MAX_AD_NAME) ?? `PRISM ad ${ad.order + 1}`;
}

/**
 * Publishes one PRISM ad set (concept, migration 013) to Meta: the campaign it belongs to becomes, or reuses, a
 * Meta Campaign; the concept becomes a Meta Ad Set; every one of its ads with a ready cover image becomes an Ad
 * Creative + Ad. Everything Meta-side is created PAUSED (meta-ads-write.mjs) — publishing never turns on spend.
 *
 * Each step is persisted (campaigns-repository) as soon as Meta accepts it, so a failure partway through never
 * loses the objects already created, and re-publishing the same concept reuses its campaign/ad set instead of
 * duplicating them. Ads without a ready image are skipped, not failed — they are simply not publishable yet.
 */
export async function publishConceptToMeta({
  workspaceId,
  token,
  adAccountId,
  campaign,
  concept,
  conceptName,
  ads,
  pageId,
  destinationUrl,
  dailyBudgetCents,
}) {
  let metaCampaignId = campaign.metaCampaignId;
  if (!metaCampaignId) {
    metaCampaignId = await createMetaCampaign(token, adAccountId, { name: campaign.name });
    setCampaignMetaId(workspaceId, campaign.id, metaCampaignId);
  }

  let metaAdSetId = concept.metaAdSetId;
  if (!metaAdSetId) {
    metaAdSetId = await createMetaAdSet(token, adAccountId, { name: conceptName, campaignId: metaCampaignId, pageId, dailyBudgetCents });
    setConceptMetaAdSet(workspaceId, concept.id, { metaAdSetId, pageId, destinationUrl, dailyBudgetCents });
  }

  const alreadyPublished = ads.filter((ad) => ad.metaPublishStatus === "published").length;
  const eligible = ads.filter((ad) => ad.imageStatus === "ready" && ad.imageUrl && ad.metaPublishStatus !== "published");
  const published = [];
  for (const ad of eligible) {
    const name = adName(ad);
    try {
      const imageHash = await uploadAdImage(token, adAccountId, ad.imageUrl);
      const creativeId = await createMetaAdCreative(token, adAccountId, {
        pageId,
        imageHash,
        name,
        message: ad.hook,
        link: destinationUrl,
        cta: ad.cta,
      });
      const metaAdId = await createMetaAd(token, adAccountId, { name, adsetId: metaAdSetId, creativeId });
      published.push(setAdMetaPublish(workspaceId, ad.id, { status: "published", metaCreativeId: creativeId, metaAdId }));
    } catch (error) {
      published.push(setAdMetaPublish(workspaceId, ad.id, { status: "failed", error: error.message }));
    }
  }

  return {
    metaCampaignId,
    metaAdSetId,
    published,
    // Ads with no ready cover image yet: not failures, just not publishable this round.
    notReadyCount: ads.length - alreadyPublished - eligible.length,
  };
}
