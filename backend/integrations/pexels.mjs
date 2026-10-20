// Profile banner photos from the Pexels API (https://www.pexels.com/api/documentation/). The key stays on the server:
// the browser asks this backend, never Pexels directly. Set PEXELS_API_KEY in .env (free from pexels.com/api).

const API = "https://api.pexels.com/v1";
const MAX_PER_PAGE = 40;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 200;

const ORIENTATIONS = new Set(["landscape", "portrait", "square"]);
const cache = new Map();

export const isPexelsConfigured = () => Boolean(process.env.PEXELS_API_KEY?.trim());

function clampInt(value, fallback, min, max) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function toBanner(photo) {
  return {
    id: String(photo.id),
    alt: photo.alt || null,
    photographer: photo.photographer || "Unknown",
    photographerUrl: photo.photographer_url || null,
    pageUrl: photo.url || null,
    avgColor: /^#[0-9a-f]{6}$/i.test(photo.avg_color ?? "") ? photo.avg_color : "#888888",
    // A small card for the picker, and a wide crop sized for the banner itself.
    thumbUrl: photo.src?.medium ?? photo.src?.small ?? null,
    bannerUrl: photo.src?.landscape ?? photo.src?.large ?? null,
  };
}

/** One page of landscape photos for `query` (curated picks when it is blank). Results are cached for ten minutes,
 * which Pexels asks for and which keeps repeat scrolling off its rate limit. */
export async function searchPexelsBanners({ query, page, perPage, orientation }) {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) return { configured: false, photos: [], page: 1, hasMore: false };

  const q = String(query ?? "").trim().slice(0, 80);
  const pageNumber = clampInt(page, 1, 1, 200);
  const size = clampInt(perPage, 18, 1, MAX_PER_PAGE);
  const shape = ORIENTATIONS.has(orientation) ? orientation : "landscape";
  const cacheKey = `${q.toLowerCase()}|${pageNumber}|${size}|${shape}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;

  const params = new URLSearchParams({ per_page: String(size), page: String(pageNumber) });
  if (q) {
    params.set("query", q);
    params.set("orientation", shape);
  }
  const response = await fetch(`${API}/${q ? "search" : "curated"}?${params}`, {
    headers: { Authorization: key },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 401 || response.status === 403) throw new Error("Pexels rejected the API key. Check PEXELS_API_KEY in .env.");
  if (response.status === 429) throw new Error("Pexels' rate limit was reached. Try again in a little while.");
  if (!response.ok) throw new Error(`Pexels couldn't be reached (HTTP ${response.status}).`);

  const body = await response.json();
  const value = {
    configured: true,
    photos: (body.photos ?? []).map(toBanner).filter((photo) => photo.thumbUrl && photo.bannerUrl),
    page: pageNumber,
    hasMore: Boolean(body.next_page),
  };
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(cacheKey, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}
