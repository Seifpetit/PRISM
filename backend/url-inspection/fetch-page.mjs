import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { FetchFailureReason } from "./types.mjs";

const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const defaultTimeoutMs = 8_000;
const defaultMaximumBytes = 3_000_000;

class WebsiteFetchError extends Error {
  constructor(message, { failureReason, httpStatus, finalUrl } = {}) {
    super(message);
    this.name = "WebsiteFetchError";
    this.failureReason = failureReason;
    this.httpStatus = httpStatus;
    this.finalUrl = finalUrl;
  }
}

function isPrivateIpv4(address) {
  const octets = address.split(".").map(Number);
  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function isPrivateIp(address) {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version !== 6) return true;
  const lower = address.toLowerCase();
  return (
    lower === "::1" ||
    lower === "::" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80:") ||
    lower.startsWith("::ffff:127.") ||
    lower.startsWith("::ffff:10.") ||
    lower.startsWith("::ffff:192.168.")
  );
}

export function validateWebsiteUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new WebsiteFetchError("The URL is invalid.", {
      failureReason: FetchFailureReason.INVALID_URL,
    });
  }
  if (!/^https?:$/.test(url.protocol) || !url.hostname) {
    throw new WebsiteFetchError("Only public HTTP(S) URLs can be inspected.", {
      failureReason: FetchFailureReason.INVALID_URL,
    });
  }
  return url;
}

export async function assertSafeWebsiteTarget(url, resolveHostname = lookup) {
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new WebsiteFetchError("Local addresses cannot be inspected.", {
      failureReason: FetchFailureReason.BLOCKED,
      finalUrl: url.href,
    });
  }
  let addresses;
  try {
    addresses = isIP(hostname)
      ? [{ address: hostname }]
      : await resolveHostname(hostname, { all: true, verbatim: true });
  } catch (error) {
    throw new WebsiteFetchError("The hostname could not be resolved.", {
      failureReason: FetchFailureReason.DNS_FAILURE,
      finalUrl: url.href,
    });
  }
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new WebsiteFetchError("Private or unsafe network targets are blocked.", {
      failureReason: FetchFailureReason.BLOCKED,
      finalUrl: url.href,
    });
  }
}

async function readResponseText(response, maximumBytes) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new WebsiteFetchError("The page is too large to inspect.", {
      failureReason: FetchFailureReason.CONTENT_TOO_LARGE,
    });
  }
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maximumBytes) {
      await reader.cancel();
      throw new WebsiteFetchError("The page is too large to inspect.", {
        failureReason: FetchFailureReason.CONTENT_TOO_LARGE,
      });
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function failureForResponse(response, finalUrl) {
  const status = response.status;
  const failureReason =
    status === 401 || status === 403 || status === 429
      ? FetchFailureReason.BLOCKED
      : status >= 500
        ? FetchFailureReason.HTTP_5XX
        : FetchFailureReason.HTTP_4XX;
  return new WebsiteFetchError(`The page returned HTTP ${status}.`, {
    failureReason,
    httpStatus: status,
    finalUrl,
  });
}

function isHtmlResponse(response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

/**
 * Fetches static HTML only. Redirects are checked one by one so an external
 * URL cannot redirect the backend toward a private network target.
 */
export async function fetchWebsiteHtml(requestedUrl, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const resolveHostname = dependencies.resolveHostname ?? lookup;
  const timeoutMs = dependencies.timeoutMs ?? defaultTimeoutMs;
  const maximumBytes = dependencies.maximumBytes ?? defaultMaximumBytes;
  let currentUrl = validateWebsiteUrl(requestedUrl);

  for (let redirects = 0; redirects <= 5; redirects += 1) {
    await assertSafeWebsiteTarget(currentUrl, resolveHostname);
    const timeout = createTimeoutSignal(timeoutMs);
    let response;
    try {
      response = await fetchImpl(currentUrl, {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "LineageProductInspector/1.0",
        },
        redirect: "manual",
        signal: timeout.signal,
      });
    } catch (error) {
      const isTimeout = error?.name === "AbortError" || timeout.signal.aborted;
      throw new WebsiteFetchError("The page could not be fetched.", {
        failureReason: isTimeout ? FetchFailureReason.TIMEOUT : FetchFailureReason.DNS_FAILURE,
        finalUrl: currentUrl.href,
      });
    } finally {
      timeout.clear();
    }

    if (redirectStatuses.has(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw failureForResponse(response, currentUrl.href);
      currentUrl = new URL(location, currentUrl);
      continue;
    }
    if (!response.ok) throw failureForResponse(response, currentUrl.href);
    if (!isHtmlResponse(response)) {
      throw new WebsiteFetchError("The URL did not return an HTML page.", {
        failureReason: FetchFailureReason.UNSUPPORTED_CONTENT_TYPE,
        httpStatus: response.status,
        finalUrl: currentUrl.href,
      });
    }
    const html = await readResponseText(response, maximumBytes);
    return {
      requestedUrl,
      finalUrl: response.url || currentUrl.href,
      httpStatus: response.status,
      contentType: response.headers.get("content-type"),
      html,
    };
  }
  throw new WebsiteFetchError("The URL redirected too many times.", {
    failureReason: FetchFailureReason.BLOCKED,
    finalUrl: currentUrl.href,
  });
}

export function fetchFailureFrom(error, requestedUrl) {
  if (error instanceof WebsiteFetchError) {
    return {
      failureReason: error.failureReason,
      httpStatus: error.httpStatus ?? null,
      requestedUrl,
      finalUrl: error.finalUrl ?? null,
    };
  }
  return {
    failureReason: FetchFailureReason.DNS_FAILURE,
    httpStatus: null,
    requestedUrl,
    finalUrl: null,
  };
}
