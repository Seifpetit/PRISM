import { clamp, roundScore } from "./types.mjs";

const productLinkPattern = /\/(?:products?|p|item)\//i;
const productCardPattern = /(?:product[-_ ]?card|product[-_ ]?item|product-grid-item)/i;
const collectionPattern = /(?:collection|catalog|shop[-_ ]?all|product-grid)/i;
const paginationPattern = /(?:pagination|page-numbers|next-page|previous-page)/i;
const loadMorePattern = /(?:load[-_ ]?more|show[-_ ]?more|infinite[-_ ]?scroll)/i;
const marketplaceHostPattern = /(^|\.)(?:amazon|ebay|etsy|walmart)\./i;
const purchasePattern =
  /\b(?:add to (?:cart|bag|basket)|buy now|order now|shop now|pre[- ]?order|commander(?: maintenant)?|acheter(?: maintenant)?)\b/i;
const variantPattern = /\b(?:size|colour|color|variant|option)\b/i;
const identifierPattern = /\b(?:sku|gtin|mpn)\s*[:#]?\s*([a-z0-9-]{3,})\b/gi;
const pricePattern =
  /(?:\b(USD|EUR|GBP|CAD|AUD|JPY)\s*|([$\u20ac\u00a3\u00a5])\s*)(\d{1,6}(?:[.,]\d{2})?)/gi;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeWhitespace(value = "") {
  return decodeHtml(value).replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)));
}

export function stripTags(value = "") {
  return normalizeWhitespace(value.replace(/<[^>]+>/g, " "));
}

function attributeValue(tag, name) {
  const pattern = new RegExp(
    "\\b" + escapeRegExp(name) + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'=<>`]+))",
    "i",
  );
  const match = tag.match(pattern);
  return match ? decodeHtml(match[1] ?? match[2] ?? match[3] ?? "") : null;
}

function tagContents(html, tagName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  return [...html.matchAll(pattern)].map((match) => stripTags(match[1]));
}

function metaContent(html, attribute, value) {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  const expected = value.toLowerCase();
  for (const tag of metas) {
    const actual = attributeValue(tag, attribute)?.toLowerCase();
    if (actual === expected) return attributeValue(tag, "content");
  }
  return null;
}

function absoluteUrl(value, baseUrl) {
  if (!value) return null;
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function isTemplateFragment(value) {
  return /(?:\{\{|}}|{%|%})/.test(value);
}

function jsonLdEntities(html) {
  const scripts = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) ?? [];
  const entities = [];
  const seen = new WeakSet();

  function visit(value) {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value["@type"]) entities.push(value);
    Object.values(value).forEach(visit);
  }

  for (const script of scripts) {
    const openingTag = script.slice(0, script.indexOf(">") + 1);
    const type = attributeValue(openingTag, "type")?.toLowerCase();
    if (!type?.includes("application/ld+json")) continue;
    const content = script.slice(openingTag.length, script.lastIndexOf("</script>"));
    try {
      visit(JSON.parse(content.trim()));
    } catch {
      // Invalid JSON-LD is common. Other deterministic evidence remains useful.
    }
  }
  return entities;
}

function applicationJsonText(html) {
  const scripts = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) ?? [];
  const strings = [];
  const maxStrings = 2_000;

  function collectStrings(value) {
    if (strings.length >= maxStrings || value == null) return;
    if (typeof value === "string") {
      strings.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(collectStrings);
      return;
    }
    if (typeof value === "object") Object.values(value).forEach(collectStrings);
  }

  for (const script of scripts) {
    const openingTag = script.slice(0, script.indexOf(">") + 1);
    const type = attributeValue(openingTag, "type")?.toLowerCase();
    if (type !== "application/json") continue;

    const content = script.slice(openingTag.length, script.lastIndexOf("</script>"));
    try {
      collectStrings(JSON.parse(content.trim()));
    } catch {
      // Application state is optional; malformed JSON must not stop inspection.
    }
  }

  return normalizeWhitespace(strings.join(" "));
}

function typesFor(entity) {
  const value = entity?.["@type"];
  return (Array.isArray(value) ? value : [value])
    .filter((type) => typeof type === "string")
    .map((type) => type.split("/").at(-1));
}

function imageUrls(html, baseUrl) {
  const urls = [];
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const url = absoluteUrl(attributeValue(tag, "src") ?? attributeValue(tag, "data-src"), baseUrl);
    if (url) urls.push(url);
  }
  return [...new Set(urls)];
}

function productLinks(html, baseUrl) {
  const links = [];
  const pattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const tag = `<a ${match[1]}>`;
    const url = absoluteUrl(attributeValue(tag, "href"), baseUrl);
    if (!url || !productLinkPattern.test(new URL(url).pathname)) continue;
    const name = stripTags(match[2]);
    if (isTemplateFragment(decodeURIComponent(url)) || isTemplateFragment(name)) continue;
    const imageUrl = absoluteUrl(attributeValue(match[2], "src"), baseUrl);
    if (!name && !imageUrl) continue;
    links.push({
      url,
      name,
      imageUrl,
      text: name,
    });
  }
  return links;
}

function productCardBlocks(html) {
  const blocks = [];
  const pattern = /<(article|li|div)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  for (const match of html.matchAll(pattern)) {
    const className = attributeValue(`<${match[1]} ${match[2]}>`, "class") ?? "";
    if (productCardPattern.test(className)) blocks.push(match[3]);
  }
  return blocks;
}

function parsePrice(raw, symbol) {
  const normalized =
    raw.includes(",") && !raw.includes(".")
      ? raw.replace(/,(?=\d{2}$)/, ".").replace(/,/g, "")
      : raw.replace(/,/g, "");
  const currencies = {
    $: "USD",
    "\u20ac": "EUR",
    "\u00a3": "GBP",
    "\u00a5": "JPY",
  };
  return { price: Number(normalized), currency: symbol ? currencies[symbol] : null };
}

export function extractPrices(value) {
  const prices = [];
  for (const match of value.matchAll(pricePattern)) {
    const parsed = parsePrice(match[3], match[2]);
    if (Number.isFinite(parsed.price)) {
      prices.push({ ...parsed, currency: match[1]?.toUpperCase() ?? parsed.currency });
    }
  }
  return prices;
}

function structuredDescription(entities) {
  const product = entities.find((entity) => typesFor(entity).includes("Product"));
  return typeof product?.description === "string" ? normalizeWhitespace(product.description) : null;
}

function structuredImage(entity, baseUrl) {
  const image = Array.isArray(entity?.image) ? entity.image[0] : entity?.image;
  const source = typeof image === "object" ? image?.url : image;
  return absoluteUrl(source, baseUrl);
}

export function extractPageEvidence({ html, requestedUrl, finalUrl, httpStatus, contentType }) {
  const baseUrl = finalUrl ?? requestedUrl;
  const entities = jsonLdEntities(html);
  const structuredDataTypes = [...new Set(entities.flatMap(typesFor))];
  const title = tagContents(html, "title")[0] ?? null;
  const headings = tagContents(html, "h1").filter(Boolean).slice(0, 5);
  const canonicalTag = (html.match(/<link\b[^>]*>/gi) ?? []).find((tag) => {
    return attributeValue(tag, "rel")?.toLowerCase().split(/\s+/).includes("canonical");
  });
  const canonicalUrl = absoluteUrl(attributeValue(canonicalTag ?? "", "href"), baseUrl);
  const openGraphImage = absoluteUrl(metaContent(html, "property", "og:image"), baseUrl);
  const pageText = stripTags(
    html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, " "),
  );
  const applicationStateText = applicationJsonText(html);
  const discoveryText = `${pageText} ${applicationStateText}`;
  const images = imageUrls(html, baseUrl);
  if (openGraphImage) images.unshift(openGraphImage);
  const cards = productCardBlocks(html);
  const detailLinks = productLinks(html, baseUrl);
  const identifiers = [...pageText.matchAll(identifierPattern)].map((match) => match[1]);
  const productDescription =
    structuredDescription(entities) ??
    metaContent(html, "name", "description") ??
    tagContents(html, "p").find((text) => /product|material|made|designed|features?/i.test(text)) ??
    null;
  const galleryImageCount = (
    html.match(/<(?:img|source)\b[^>]*(?:gallery|product-image)[^>]*>/gi) ?? []
  ).length;
  const allClassNames = (html.match(/\bclass\s*=\s*(?:"[^"]*"|'[^']*')/gi) ?? []).join(" ");
  const pageUrl = new URL(baseUrl);
  const pathname = pageUrl.pathname;

  return {
    requestedUrl,
    finalUrl,
    canonicalUrl,
    httpStatus,
    contentType,
    title,
    headings,
    openGraphTitle: metaContent(html, "property", "og:title"),
    openGraphType: metaContent(html, "property", "og:type"),
    openGraphImage,
    structuredDataTypes,
    structuredEntities: entities,
    productDescription,
    pageText,
    pageTextLength: pageText.length,
    applicationStateTextLength: applicationStateText.length,
    hasPurchaseAction: purchasePattern.test(discoveryText),
    hasVariantSelector:
      variantPattern.test(allClassNames) ||
      /<(?:select|input)\b[^>]*(?:size|colour|color|variant|option)[^>]*>/i.test(html),
    identifiers: [...new Set(identifiers)],
    prices: extractPrices(pageText),
    imageUrls: [...new Set(images)],
    galleryImageCount,
    productDetailLinks: detailLinks,
    productCardBlocks: cards,
    hasCollectionSemantics:
      collectionPattern.test(pathname) ||
      collectionPattern.test(allClassNames) ||
      structuredDataTypes.some((type) => /ItemList|CollectionPage|CategoryCodeSet/i.test(type)),
    hasPaginationSemantics:
      paginationPattern.test(allClassNames) ||
      /<link\b[^>]*\brel\s*=\s*(?:"next"|'next')[^>]*>/i.test(html) ||
      /(?:[?&]page=\d+|\/page\/\d+)/i.test(pageUrl.href),
    hasLoadMoreSemantics:
      loadMorePattern.test(allClassNames) ||
      /\b(?:load more|show more|infinite scroll)\b/i.test(pageText),
    hasSearchSemantics:
      /^\/(?:search|s)(?:\/|$)/i.test(pathname) ||
      /[?&](?:q|query|search|k)=/i.test(pageUrl.search),
    hasMarketplaceSemantics: marketplaceHostPattern.test(pageUrl.hostname),
    isArticleLike:
      structuredDataTypes.some((type) => /Article|BlogPosting|NewsArticle/i.test(type)) ||
      metaContent(html, "property", "og:type")?.toLowerCase() === "article",
    structuredImage,
  };
}

export function contentQualityScore(evidence) {
  let score = 0;
  if (evidence.title) score += 0.1;
  if (evidence.headings.length) score += 0.1;
  if (evidence.pageTextLength >= 160) score += 0.2;
  if (evidence.pageTextLength >= 600) score += 0.1;
  if (evidence.canonicalUrl) score += 0.05;
  if (evidence.openGraphTitle || evidence.openGraphImage) score += 0.1;
  if (evidence.structuredDataTypes.length) score += 0.15;
  if (evidence.productDescription) score += 0.1;
  if (evidence.imageUrls.length) score += 0.1;
  if (evidence.prices.length) score += 0.1;
  return roundScore(score);
}
