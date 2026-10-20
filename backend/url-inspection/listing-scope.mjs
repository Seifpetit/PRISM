import { ListingScope, PageClassification } from "./types.mjs";

export const selectableListingCandidateLimit = 24;

/**
 * Listing scope answers whether the current page is small enough to present
 * for selection. It never crawls further pages or infinite-scroll results.
 */
export function determineListingScope({ classification, signals, candidates }) {
  if (classification !== PageClassification.LISTING) return null;
  if (!candidates.length) return ListingScope.UNAVAILABLE;
  const exceedsCandidateLimit = candidates.length > selectableListingCandidateLimit;
  const hasBroadCatalogSemantics =
    signals.hasPaginationSemantics ||
    signals.hasLoadMoreSemantics ||
    signals.hasSearchSemantics ||
    signals.hasMarketplaceSemantics;
  return exceedsCandidateLimit || hasBroadCatalogSemantics
    ? ListingScope.BROAD_CATALOG
    : ListingScope.SELECTABLE;
}
