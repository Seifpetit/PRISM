import { contentQualityScore } from "./html.mjs";
import { calculateDominantProductScore } from "./candidates.mjs";
import { clamp, roundScore } from "./types.mjs";

function includesType(types, pattern) {
  return types.some((type) => pattern.test(type));
}

function pageCommerceScore(signals) {
  const weights = [
    [signals.hasProductStructuredData, 0.2],
    [signals.hasOfferStructuredData, 0.1],
    [signals.hasPurchaseAction, 0.2],
    [signals.hasVariantSelector, 0.1],
    [signals.hasSingleDominantPrice, 0.15],
    [signals.hasSkuOrProductIdentifier, 0.1],
    [signals.hasSingleDominantGallery, 0.15],
  ];
  return roundScore(
    clamp(
      weights.reduce((sum, [condition, weight]) => {
        return sum + (condition ? weight : 0);
      }, 0),
    ),
  );
}

export function normalizeSignals(evidence, candidates) {
  const types = evidence.structuredDataTypes;
  const productCandidateCount = candidates.length;
  const distinctProductLinkCount = new Set(evidence.productDetailLinks.map((link) => link.url))
    .size;
  const distinctProductPriceCount = new Set(
    evidence.prices.map(({ price, currency }) => `${currency ?? ""}:${price}`),
  ).size;
  const repeatedCandidateCount = candidates.filter((candidate) => {
    return (
      Boolean(candidate.url && candidate.name) &&
      (candidate.price !== null || Boolean(candidate.imageUrl))
    );
  }).length;
  const signals = {
    hasProductStructuredData: includesType(types, /^Product$/i),
    hasItemListStructuredData: includesType(types, /^ItemList$/i),
    hasOfferStructuredData: includesType(types, /^Offer$/i),
    hasSingleDominantHeading: evidence.headings.length === 1 && evidence.headings[0].length <= 120,
    hasProductSpecificDescription: Boolean(evidence.productDescription),
    hasPurchaseAction: evidence.hasPurchaseAction,
    hasVariantSelector: evidence.hasVariantSelector,
    hasSingleDominantGallery:
      productCandidateCount <= 1 &&
      (evidence.galleryImageCount > 0 ||
        Boolean(evidence.openGraphImage) ||
        Boolean(candidates[0]?.evidence.productGallery)),
    hasSkuOrProductIdentifier: evidence.identifiers.length > 0,
    hasSingleDominantPrice: productCandidateCount <= 1 && distinctProductPriceCount === 1,
    productCandidateCount,
    repeatedProductCardCount: Math.max(evidence.productCardBlocks.length, repeatedCandidateCount),
    distinctProductLinkCount,
    distinctProductPriceCount,
    hasCollectionSemantics: evidence.hasCollectionSemantics,
    hasPaginationSemantics: evidence.hasPaginationSemantics,
    hasLoadMoreSemantics: evidence.hasLoadMoreSemantics,
    hasSearchSemantics: evidence.hasSearchSemantics,
    hasMarketplaceSemantics: evidence.hasMarketplaceSemantics,
    hasMultipleProductNamesAndPrices: productCandidateCount >= 2 && distinctProductPriceCount >= 2,
    hasSinglePurchaseFlowOnly: evidence.hasPurchaseAction && productCandidateCount <= 1,
    strongestCandidateConfidence: candidates[0]?.confidence ?? 0,
    dominantProductScore: calculateDominantProductScore(candidates),
    contentQualityScore: contentQualityScore(evidence),
    pageCommerceScore: 0,
  };
  signals.pageCommerceScore = pageCommerceScore(signals);
  return signals;
}
