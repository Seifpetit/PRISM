import { clamp, roundScore } from "./types.mjs";

const productMaximum = 31;
const listingMaximum = 28;

/** All V1 classification weights live here, separate from HTML extraction. */
export function calculateClassificationScores(signals) {
  let rawProduct = 0;
  if (signals.hasProductStructuredData) rawProduct += 5;
  if (signals.hasPurchaseAction) rawProduct += 4;
  if (signals.hasSingleDominantHeading) rawProduct += 3;
  if (signals.hasSingleDominantPrice) rawProduct += 3;
  if (signals.hasProductSpecificDescription) rawProduct += 3;
  if (signals.hasSingleDominantGallery) rawProduct += 3;
  if (signals.hasOfferStructuredData) rawProduct += 2;
  if (signals.hasVariantSelector) rawProduct += 2;
  if (signals.hasSkuOrProductIdentifier) rawProduct += 2;
  if (signals.dominantProductScore >= 0.75) rawProduct += 4;
  else if (signals.dominantProductScore >= 0.5) rawProduct += 2;
  if (signals.productCandidateCount >= 5 && signals.dominantProductScore < 0.5) {
    rawProduct -= 5;
  }
  if (signals.dominantProductScore < 0.4) rawProduct -= 4;
  if (signals.hasItemListStructuredData && signals.repeatedProductCardCount >= 5) {
    rawProduct -= 3;
  }

  let rawListing = 0;
  if (signals.hasItemListStructuredData) rawListing += 5;
  if (signals.productCandidateCount >= 3) rawListing += 5;
  if (signals.repeatedProductCardCount >= 5) rawListing += 4;
  if (signals.distinctProductLinkCount >= 3) rawListing += 4;
  if (signals.hasMultipleProductNamesAndPrices) rawListing += 3;
  if (signals.hasCollectionSemantics) rawListing += 2;
  if (signals.distinctProductLinkCount >= 10) rawListing += 2;
  if (signals.dominantProductScore < 0.5) rawListing += 3;
  if (signals.dominantProductScore >= 0.85) rawListing -= 5;
  if (signals.hasProductStructuredData) rawListing -= 3;
  if (signals.hasSinglePurchaseFlowOnly) rawListing -= 3;

  return {
    product: roundScore(clamp(rawProduct / productMaximum)),
    listing: roundScore(clamp(rawListing / listingMaximum)),
    rawProduct,
    rawListing,
  };
}
