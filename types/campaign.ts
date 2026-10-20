import type { TestType } from "@/lib/campaign-rules";

// Test campaigns (docs/creative-strategy/framework.md): a campaign is a test plan for a product, its
// concepts are ad sets (persona x angle x offer), and each concept holds ads that vary inside that one idea.

/** What a campaign is for. Scaling and retargeting are labels for now; they use the same ad set builder as a test. */
export const CAMPAIGN_KINDS = ["test", "scaling", "retargeting"] as const;
export type CampaignKind = (typeof CAMPAIGN_KINDS)[number];

export const CAMPAIGN_KIND_LABEL: Record<CampaignKind, string> = {
  test: "Test",
  scaling: "Scaling",
  retargeting: "Retargeting",
};

export const AWARENESS_STAGES = ["unaware", "problem_aware", "solution_aware", "product_aware"] as const;
export type AwarenessStage = (typeof AWARENESS_STAGES)[number];

export const AWARENESS_LABEL: Record<AwarenessStage, string> = {
  unaware: "Unaware",
  problem_aware: "Problem-aware",
  solution_aware: "Solution-aware",
  product_aware: "Product-aware",
};

/** What the viewer already understands at each stage, and so what the ad's job is. It shapes the bridge to the product. */
export const AWARENESS_HELP: Record<AwarenessStage, string> = {
  unaware: "Doesn't see the problem yet. The ad makes the situation recognizable and holds the product back.",
  problem_aware: "Knows the problem, not the solution. The ad explains why it happens or persists.",
  solution_aware: "Knows ways to solve it. The ad shows why this kind of solution, and this mechanism, matters.",
  product_aware: "Knows the product. The ad demonstrates it and answers objections; the offer can carry more weight.",
};

export const AD_FORMATS = [
  "photo",
  "static_ad",
  "carousel",
  "video",
  "ugc_video",
  "ai_talking_head",
  "motion_graphic",
] as const;
export type AdFormat = (typeof AD_FORMATS)[number];

export const AD_FORMAT_LABEL: Record<AdFormat, string> = {
  photo: "Photo",
  static_ad: "Static ad",
  carousel: "Carousel",
  video: "Video",
  ugc_video: "UGC video",
  ai_talking_head: "AI talking head",
  motion_graphic: "Motion graphic",
};

/** Formats with motion, wherever a cover image gets a play affordance instead of just sitting still. */
export const VIDEO_FORMATS: ReadonlySet<AdFormat> = new Set(["video", "ugc_video", "ai_talking_head", "motion_graphic"]);

/**
 * One ad in an ad set: a slot with six dimensions. The persona, angle and offer are fixed by the ad set; an ad
 * only chooses how to execute them: awareness, direction, format, hook, beats and a call to action.
 */
export interface CampaignAd {
  id: string;
  conceptId: string;
  order: number;
  format: AdFormat;
  awareness: AwarenessStage;
  /** A short name for the creative idea this ad expresses. */
  title: string | null;
  /** The concrete scenario or device that carries the angle. */
  direction: string | null;
  hook: string | null;
  /** The bridge from the hook to the product and the offer, one step each. */
  beats: string[];
  cta: string | null;
  notes: string | null;
  /** "none" until a "Generate ads" run requests a cover image for this ad; then "pending" briefly, then "ready" or "failed". */
  imageStatus: "none" | "pending" | "ready" | "failed";
  /** A data: URI when imageStatus is "ready"; null otherwise. */
  imageUrl: string | null;
  /** "none" until this ad's ad set is published to Meta; then "published" or "failed" for this ad specifically. */
  metaPublishStatus: "none" | "published" | "failed";
  metaAdId: string | null;
  metaPublishError: string | null;
}

/** The fields of an ad a person can edit. */
export type CampaignAdFields = Partial<
  Pick<CampaignAd, "format" | "awareness" | "title" | "hook" | "notes" | "direction" | "cta"> & { beats: string[] | null }
>;

const MAX_DERIVED_TITLE = 60;

function shorten(text: string, max: number): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/**
 * What an ad's card should read as its title: what was written, or — the same fallback order the pipeline's own
 * task title already uses (backend/pipeline/service.mjs) — a short line taken from the hook when nothing was
 * written, so a card never sits on the generic "Untitled idea" while a real hook exists to read from. Only an ad
 * with neither gets a placeholder, and it says so honestly (`isFallback`) rather than pretending to be a title.
 */
export function adDisplayTitle(ad: Pick<CampaignAd, "title" | "hook" | "format">): { text: string; isFallback: boolean } {
  const title = ad.title?.trim();
  if (title) return { text: title, isFallback: false };
  const hook = ad.hook?.trim();
  if (hook) return { text: shorten(hook.replace(/^[“"']+|[”"']+$/g, ""), MAX_DERIVED_TITLE), isFallback: false };
  return { text: `New ${AD_FORMAT_LABEL[ad.format].toLowerCase()}`, isFallback: true };
}

/** "3 ads · 1 static ad, 2 video": what an ad set holds, in a line. */
export function adSummary(ads: CampaignAd[]): string {
  if (!ads.length) return "No ads yet";
  const counts = new Map<AdFormat, number>();
  for (const ad of ads) counts.set(ad.format, (counts.get(ad.format) ?? 0) + 1);
  const groups = [...counts.entries()].map(([format, count]) => `${count} ${AD_FORMAT_LABEL[format].toLowerCase()}`);
  return `${ads.length} ad${ads.length === 1 ? "" : "s"} · ${groups.slice(0, 2).join(", ")}${groups.length > 2 ? "…" : ""}`;
}

/** One ad set: persona x angle x offer. */
export interface CampaignConcept {
  id: string;
  campaignId: string;
  productId: string;
  avatarId: string;
  angleId: string;
  offerId: string;
  startDate: string | null;
  endDate: string | null;
  spend: number | null;
  positionX: number | null;
  positionY: number | null;
  createdAt: string;
  /** The Meta Ad Set this ad set was published as, once published. */
  metaAdSetId: string | null;
  ads: CampaignAd[];
}

export interface Campaign {
  id: string;
  productId: string;
  name: string;
  kind: CampaignKind;
  testType: TestType;
  positionX: number | null;
  positionY: number | null;
  createdAt: string;
  /** The Meta Campaign this campaign became, the first time any of its ad sets was published. */
  metaCampaignId: string | null;
  concepts: CampaignConcept[];
}
