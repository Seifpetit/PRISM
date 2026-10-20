// Pure helper for assigning Meta campaigns to a product: which campaign names look like they belong to it.

const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The ids of the campaigns whose name contains the product's name, ignoring case, spaces and punctuation
 * ("ACME_MAIN_CBO_0916" and "Acme - retargeting" both match "Acme"). A product name shorter than three
 * letters matches nothing: it would tick everything.
 */
export function suggestCampaigns(campaigns: Array<{ id: string; name: string }>, productName: string): string[] {
  const needle = squash(productName);
  if (needle.length < 3) return [];
  return campaigns.filter((campaign) => squash(campaign.name).includes(needle)).map((campaign) => campaign.id);
}
