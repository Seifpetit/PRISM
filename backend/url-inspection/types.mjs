export const PageClassification = Object.freeze({
  PRODUCT: "PRODUCT",
  LISTING: "LISTING",
  UNKNOWN: "UNKNOWN",
});

export const ListingScope = Object.freeze({
  SELECTABLE: "SELECTABLE",
  BROAD_CATALOG: "BROAD_CATALOG",
  UNAVAILABLE: "UNAVAILABLE",
});

export const FetchStatus = Object.freeze({
  SUCCESS: "SUCCESS",
  UNREACHABLE: "UNREACHABLE",
});

export const RenderMode = Object.freeze({
  STATIC_HTML: "STATIC_HTML",
  RENDERED_DOM: "RENDERED_DOM",
});

export const UnknownReason = Object.freeze({
  INSUFFICIENT_PRODUCT_EVIDENCE: "INSUFFICIENT_PRODUCT_EVIDENCE",
  CONFLICTING_PRODUCT_AND_LISTING_EVIDENCE: "CONFLICTING_PRODUCT_AND_LISTING_EVIDENCE",
  NO_PRODUCT_CANDIDATES: "NO_PRODUCT_CANDIDATES",
  CONTENT_TOO_THIN: "CONTENT_TOO_THIN",
  UNSUPPORTED_PAGE_TYPE: "UNSUPPORTED_PAGE_TYPE",
});

export const FetchFailureReason = Object.freeze({
  TIMEOUT: "TIMEOUT",
  HTTP_4XX: "HTTP_4XX",
  HTTP_5XX: "HTTP_5XX",
  DNS_FAILURE: "DNS_FAILURE",
  BLOCKED: "BLOCKED",
  INVALID_URL: "INVALID_URL",
  UNSUPPORTED_CONTENT_TYPE: "UNSUPPORTED_CONTENT_TYPE",
  CONTENT_TOO_LARGE: "CONTENT_TOO_LARGE",
});

export const classificationPolicyVersion = "page-classifier-v1";

export function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function roundScore(value) {
  return Math.round(clamp(value) * 1000) / 1000;
}
