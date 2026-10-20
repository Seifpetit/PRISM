import { clamp, roundScore } from "./types.mjs";
import { extractPrices, normalizeWhitespace, stripTags } from "./html.mjs";

function hasType(entity, expectedType) {
  const types = Array.isArray(entity?.["@type"]) ? entity["@type"] : [entity?.["@type"]];
  return types.some((type) => String(type).split("/").at(-1) === expectedType);
}

function asUrl(value, baseUrl) {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return null;
  }
}

function firstImage(value, baseUrl) {
  const image = Array.isArray(value) ? value[0] : value;
  const source = typeof image === "object" ? image?.url : image;
  return asUrl(source, baseUrl);
}

function offerFor(product) {
  const offers = Array.isArray(product?.offers) ? product.offers : [product?.offers];
  return offers.find((offer) => offer && typeof offer === "object") ?? null;
}

function structuredCandidate(product, baseUrl) {
  const offer = offerFor(product);
  const price = Number(offer?.price);
  return {
    name: normalizeWhitespace(product.name ?? "") || null,
    url: asUrl(product.url, baseUrl),
    imageUrl: firstImage(product.image, baseUrl),
    price: Number.isFinite(price) ? price : null,
    currency: offer?.priceCurrency ?? null,
    sku: product.sku ?? product.gtin ?? product.mpn ?? null,
    evidence: {
      structuredProduct: true,
      offer: Boolean(offer || price),
      purchaseAction: false,
      productHeading: false,
      productDescription: Boolean(product.description),
      productGallery: Boolean(product.image),
      variantSelector: false,
    },
  };
}

function emptyEvidence() {
  return {
    structuredProduct: false,
    offer: false,
    purchaseAction: false,
    productHeading: false,
    productDescription: false,
    productGallery: false,
    variantSelector: false,
  };
}

function candidateKey(candidate) {
  return candidate.url?.toLowerCase() ?? candidate.name?.toLowerCase() ?? null;
}

function sameCandidate(left, right) {
  if (left.url && right.url && left.url === right.url) return true;
  if (!left.name || !right.name) return false;
  return left.name.toLowerCase() === right.name.toLowerCase();
}

function mergeCandidate(target, incoming) {
  target.name ??= incoming.name;
  target.url ??= incoming.url;
  target.imageUrl ??= incoming.imageUrl;
  target.price ??= incoming.price;
  target.currency ??= incoming.currency;
  target.sku ??= incoming.sku;
  for (const [key, value] of Object.entries(incoming.evidence)) {
    target.evidence[key] ||= Boolean(value);
  }
}

function confidenceFor(candidate) {
  const evidence = candidate.evidence;
  let score = 0;
  if (evidence.structuredProduct) score += 0.45;
  if (evidence.offer) score += 0.12;
  if (evidence.purchaseAction) score += 0.15;
  if (evidence.productHeading) score += 0.18;
  if (evidence.productDescription) score += 0.12;
  if (evidence.productGallery) score += 0.1;
  if (evidence.variantSelector) score += 0.05;
  if (candidate.sku) score += 0.08;
  if (candidate.price !== null) score += 0.1;
  if (candidate.url && candidate.name) score += 0.05;
  if (candidate.url && candidate.name && candidate.price !== null) score += 0.1;
  return roundScore(score);
}

function candidateFromCard(cardHtml, baseUrl) {
  const linkMatch = cardHtml.match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
  if (!linkMatch) return null;
  const hrefMatch = linkMatch[1].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i);
  const url = asUrl(hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3], baseUrl);
  const name = stripTags(linkMatch[2]);
  if (!url || !name) return null;
  const prices = extractPrices(stripTags(cardHtml));
  const imageMatch = cardHtml.match(/<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i);
  const imageUrl = asUrl(imageMatch?.[1] ?? imageMatch?.[2] ?? imageMatch?.[3], baseUrl);
  return {
    name,
    url,
    imageUrl,
    price: prices[0]?.price ?? null,
    currency: prices[0]?.currency ?? null,
    sku: null,
    evidence: {
      ...emptyEvidence(),
      productHeading: true,
      productDescription: stripTags(cardHtml).length >= 28,
      productGallery: Boolean(imageUrl),
    },
  };
}

function candidateFromLink(link) {
  if (!link.name && !link.imageUrl) return null;
  const prices = extractPrices(link.text);
  return {
    name: link.name || null,
    url: link.url,
    imageUrl: link.imageUrl,
    price: prices[0]?.price ?? null,
    currency: prices[0]?.currency ?? null,
    sku: null,
    evidence: {
      ...emptyEvidence(),
      productHeading: Boolean(link.name),
      productGallery: Boolean(link.imageUrl),
    },
  };
}

function addCandidate(candidates, incoming) {
  if (!candidateKey(incoming)) return;
  const existing = candidates.find((candidate) => sameCandidate(candidate, incoming));
  if (existing) mergeCandidate(existing, incoming);
  else candidates.push(incoming);
}

function applyPageEvidence(candidates, evidence) {
  const heading = evidence.headings[0]?.toLowerCase();
  const matching = candidates.find((candidate) => candidate.name?.toLowerCase() === heading);
  const target = matching ?? (candidates.length === 1 ? candidates[0] : null);
  if (!target) return;
  target.evidence.purchaseAction ||= evidence.hasPurchaseAction;
  target.evidence.variantSelector ||= evidence.hasVariantSelector;
  target.evidence.productHeading ||= Boolean(heading);
  target.evidence.productDescription ||= Boolean(evidence.productDescription);
  target.evidence.productGallery ||=
    evidence.galleryImageCount > 0 || Boolean(evidence.openGraphImage);
  target.sku ??= evidence.identifiers[0] ?? null;
  if (target.price === null && evidence.prices.length === 1) {
    target.price = evidence.prices[0].price;
    target.currency = evidence.prices[0].currency;
  }
}

function canInferOpenGraphProductCandidate(evidence, candidates) {
  const openGraphType = evidence.openGraphType?.toLowerCase();
  const hasProductFacts =
    Boolean(evidence.productDescription) &&
    Boolean(evidence.openGraphImage) &&
    evidence.hasPurchaseAction;
  return (
    candidates.length === 0 &&
    openGraphType === "product" &&
    Boolean(normalizeWhitespace(evidence.openGraphTitle ?? "")) &&
    hasProductFacts &&
    !evidence.hasCollectionSemantics &&
    evidence.productDetailLinks.length < 3
  );
}

/**
 * Returns only credible candidates. A weak product link alone is not enough
 * evidence to become a user-selectable candidate.
 */
export function discoverProductCandidates(evidence) {
  const baseUrl = evidence.canonicalUrl ?? evidence.finalUrl ?? evidence.requestedUrl;
  const candidates = [];
  for (const entity of evidence.structuredEntities) {
    if (hasType(entity, "Product")) addCandidate(candidates, structuredCandidate(entity, baseUrl));
  }
  for (const card of evidence.productCardBlocks) {
    const candidate = candidateFromCard(card, baseUrl);
    if (candidate) addCandidate(candidates, candidate);
  }
  for (const link of evidence.productDetailLinks) {
    const candidate = candidateFromLink(link);
    if (candidate) addCandidate(candidates, candidate);
  }
  const isListingWithProductLinks =
    evidence.hasCollectionSemantics && evidence.productDetailLinks.length >= 3;
  if (evidence.headings[0] && !isListingWithProductLinks) {
    addCandidate(candidates, {
      name: evidence.headings[0],
      url: evidence.canonicalUrl ?? evidence.finalUrl,
      imageUrl: evidence.openGraphImage,
      price: null,
      currency: null,
      sku: null,
      evidence: {
        ...emptyEvidence(),
        productHeading: true,
      },
    });
  }
  if (canInferOpenGraphProductCandidate(evidence, candidates)) {
    // Some storefronts expose their page title only as OpenGraph metadata.
    // This remains narrow: it requires product metadata plus visible commerce
    // facts, and never runs for an apparent collection.
    addCandidate(candidates, {
      name: normalizeWhitespace(evidence.openGraphTitle),
      url: evidence.canonicalUrl ?? evidence.finalUrl,
      imageUrl: evidence.openGraphImage,
      price: null,
      currency: null,
      sku: null,
      evidence: {
        ...emptyEvidence(),
        productHeading: true,
        productDescription: true,
        productGallery: true,
      },
    });
  }
  applyPageEvidence(candidates, evidence);
  return candidates
    .map((candidate) => ({ ...candidate, confidence: confidenceFor(candidate) }))
    .filter((candidate) => candidate.confidence >= 0.4)
    .sort((left, right) => right.confidence - left.confidence);
}

/**
 * The strongest credible candidate is compared with the total credible
 * candidate attention. One strong candidate is intentionally treated as a
 * product page rather than a 1 / 1 mathematical tie.
 */
export function calculateDominantProductScore(candidates) {
  if (!candidates.length) return 0;
  const total = candidates.reduce((sum, candidate) => sum + candidate.confidence, 0);
  const strongest = candidates[0].confidence;
  if (candidates.length === 1) return roundScore(0.78 + strongest * 0.2);
  return roundScore(clamp(strongest / total));
}
