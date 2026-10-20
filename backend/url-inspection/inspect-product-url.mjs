import { discoverProductCandidates } from "./candidates.mjs";
import { classifyPage } from "./classification-policy.mjs";
import { fetchFailureFrom, fetchWebsiteHtml } from "./fetch-page.mjs";
import { extractPageEvidence } from "./html.mjs";
import { determineListingScope } from "./listing-scope.mjs";
import { renderWebsiteHtml } from "./render-page.mjs";
import { normalizeSignals } from "./signals.mjs";
import {
  FetchStatus,
  PageClassification,
  RenderMode,
  classificationPolicyVersion,
} from "./types.mjs";

function publicEvidence(evidence) {
  return {
    title: evidence.title,
    headings: evidence.headings,
    canonicalUrl: evidence.canonicalUrl,
    openGraphTitle: evidence.openGraphTitle,
    openGraphType: evidence.openGraphType,
    openGraphImage: evidence.openGraphImage,
    structuredDataTypes: evidence.structuredDataTypes,
    productDescription: evidence.productDescription,
    prices: evidence.prices,
    imageUrls: evidence.imageUrls,
    productDetailLinkCount: evidence.productDetailLinks.length,
    pageTextLength: evidence.pageTextLength,
    applicationStateTextLength: evidence.applicationStateTextLength,
    pageTextExcerpt: evidence.pageText.slice(0, 12_000),
  };
}

function logInspectionResult(result) {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const diagnosticsEnabled = process.env.URL_INSPECTION_DEBUG === "true";
  if (!isDevelopment && !diagnosticsEnabled) return;
  console.log("[url-inspection]", JSON.stringify(result, null, 2));
}

/**
 * Inspect an already-fetched HTML page. This pure boundary is used by fixtures
 * and keeps extraction, scoring, and classification testable without network
 * access or any AI dependency.
 */
export function inspectFetchedPage(page) {
  const evidence = extractPageEvidence(page);
  const candidates = discoverProductCandidates(evidence);
  const signals = normalizeSignals(evidence, candidates);
  const decision = classifyPage({ evidence, signals });
  const listingScope = determineListingScope({
    classification: decision.classification,
    signals,
    candidates,
  });
  return {
    fetch: {
      status: FetchStatus.SUCCESS,
      failureReason: null,
      httpStatus: page.httpStatus,
      requestedUrl: page.requestedUrl,
      finalUrl: page.finalUrl,
      renderMode: page.renderMode ?? RenderMode.STATIC_HTML,
    },
    classification: decision.classification,
    listingScope,
    confidence: decision.confidence,
    scores: decision.scores,
    unknownReason: decision.unknownReason ?? null,
    signals,
    candidates,
    evidence: publicEvidence(evidence),
    classificationPolicyVersion,
  };
}

/**
 * Public URL-inspection entry point. Fetch failure is intentionally separate
 * from UNKNOWN: an unreachable page is never sent through classification.
 */
export async function inspectProductUrl(url, dependencies = {}) {
  try {
    const page = await fetchWebsiteHtml(url, dependencies);
    let result = inspectFetchedPage(page);
    if (result.classification === PageClassification.UNKNOWN) {
      const renderPage = dependencies.renderPage ?? renderWebsiteHtml;
      const renderedPage = await renderPage(page, dependencies).catch(() => null);
      if (renderedPage) result = inspectFetchedPage(renderedPage);
    }
    logInspectionResult(result);
    return result;
  } catch (error) {
    const failure = fetchFailureFrom(error, url);
    const result = {
      fetch: {
        status: FetchStatus.UNREACHABLE,
        ...failure,
        renderMode: null,
      },
      classification: null,
      listingScope: null,
      confidence: null,
      scores: null,
      unknownReason: null,
      signals: null,
      candidates: [],
      evidence: null,
      classificationPolicyVersion,
    };
    logInspectionResult(result);
    return result;
  }
}
