import { PageClassification, UnknownReason, clamp, roundScore } from "./types.mjs";
import { calculateClassificationScores } from "./scoring.mjs";

/**
 * V1 is intentionally deterministic and inspectable. Candidate count and
 * dominance influence the isolated score calculation; they do not silently
 * force a contradictory classification.
 *
 * TODO optional future AI adjudication for low-confidence UNKNOWN pages.
 * Deterministic classification remains the primary routing layer.
 */
export function classifyPage({ evidence, signals }) {
  const scores = calculateClassificationScores(signals);
  const productMargin = scores.product - scores.listing;
  const listingMargin = scores.listing - scores.product;
  const hasSingleLandingProductEvidence =
    signals.productCandidateCount === 1 &&
    signals.strongestCandidateConfidence >= 0.6 &&
    signals.dominantProductScore >= 0.75 &&
    signals.hasPurchaseAction &&
    signals.hasProductSpecificDescription &&
    signals.hasSingleDominantGallery &&
    scores.listing < 0.3;
  const hasDeclaredOpenGraphProduct =
    hasSingleLandingProductEvidence && evidence.openGraphType?.toLowerCase() === "product";

  if (scores.product >= 0.7 && productMargin >= 0.15) {
    return {
      classification: PageClassification.PRODUCT,
      confidence: roundScore(clamp(scores.product * 0.8 + productMargin * 0.2)),
      scores,
    };
  }
  if (
    hasSingleLandingProductEvidence &&
    (scores.product >= 0.5 || (hasDeclaredOpenGraphProduct && scores.product >= 0.4)) &&
    productMargin >= 0.15
  ) {
    return {
      classification: PageClassification.PRODUCT,
      confidence: roundScore(Math.max(0.7, scores.product + 0.15)),
      scores,
    };
  }
  if (scores.listing >= 0.7 && listingMargin >= 0.15) {
    return {
      classification: PageClassification.LISTING,
      confidence: roundScore(clamp(scores.listing * 0.8 + listingMargin * 0.2)),
      scores,
    };
  }

  let unknownReason = UnknownReason.INSUFFICIENT_PRODUCT_EVIDENCE;
  if (signals.contentQualityScore < 0.25) {
    unknownReason = UnknownReason.CONTENT_TOO_THIN;
  } else if (evidence.isArticleLike) {
    unknownReason = UnknownReason.UNSUPPORTED_PAGE_TYPE;
  } else if (signals.productCandidateCount === 0) {
    unknownReason = UnknownReason.NO_PRODUCT_CANDIDATES;
  } else if (scores.product >= 0.55 && scores.listing >= 0.55) {
    unknownReason = UnknownReason.CONFLICTING_PRODUCT_AND_LISTING_EVIDENCE;
  }

  return {
    classification: PageClassification.UNKNOWN,
    confidence: roundScore(Math.max(scores.product, scores.listing)),
    scores,
    unknownReason,
  };
}
