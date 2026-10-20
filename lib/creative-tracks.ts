import type { Campaign, CampaignAd, CampaignConcept } from "@/types/campaign";

/**
 * Track colours for the Creatives workspace. Chosen to stay clear of the persona (violet), angle (blue) and
 * offer (amber) colours, which already mean something on the canvas, and to read on both themes.
 */
export const TRACK_COLORS = ["#14b8a6", "#f43f5e", "#84cc16", "#d946ef", "#06b6d4", "#f97316", "#8b5cf6", "#eab308"] as const;

export interface CreativeTrack {
  concept: CampaignConcept;
  campaign: Campaign;
  /** "AS-01": the ad set's reference, by its place in the product's campaigns. */
  ref: string;
  color: string;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** One track per ad set, across every campaign of the product, in canvas order. */
export function buildTracks(campaigns: Campaign[]): CreativeTrack[] {
  let index = 0;
  return campaigns.flatMap((campaign) =>
    campaign.concepts.map((concept) => {
      const track = { concept, campaign, ref: `AS-${pad(index + 1)}`, color: TRACK_COLORS[index % TRACK_COLORS.length] };
      index += 1;
      return track;
    }),
  );
}

/** Every ad set's colour and reference by id, so the canvas and the Creatives workspace wear the same ones. */
export function trackLooks(campaigns: Campaign[]): Map<string, { color: string; ref: string }> {
  return new Map(buildTracks(campaigns).map((track) => [track.concept.id, { color: track.color, ref: track.ref }]));
}

export const adRef = (track: Pick<CreativeTrack, "ref">, adIndex: number) => `${track.ref}.${adIndex + 1}`;

/** How much of an ad is written down: direction, hook, bridge and call to action. */
export function adCompleteness(ad: Pick<CampaignAd, "direction" | "hook" | "beats" | "cta">): { done: number; total: 4 } {
  const done = [ad.direction, ad.hook, ad.beats.length ? "beats" : null, ad.cta].filter(Boolean).length;
  return { done, total: 4 };
}
