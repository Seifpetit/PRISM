/**
 * Shared provider HTTP transport.
 *
 * Provider adapters still own their URLs, headers, payloads, and response
 * extraction. This helper only performs JSON HTTP and turns non-2xx responses
 * into useful errors.
 */
const TRANSIENT_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A thrown fetch() (DNS, connection reset, TLS, socket hang-up) — worth retrying. */
function isTransientNetworkError(error) {
  return error instanceof TypeError || error?.name === "FetchError" || error?.code === "UND_ERR_SOCKET";
}

export async function requestJson({ url, init, provider }) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      if (init?.signal?.aborted || !isTransientNetworkError(error) || attempt === MAX_ATTEMPTS) {
        throw error;
      }
      lastError = error;
      await wait(attempt * 500);
      continue;
    }
    const payload = await response.json().catch(() => ({}));
    if (response.ok) return payload;
    const message =
      payload?.error?.message ?? payload?.message ?? `AI request failed (${response.status})`;
    if (TRANSIENT_STATUS.has(response.status) && attempt < MAX_ATTEMPTS && !init?.signal?.aborted) {
      lastError = new Error(`${provider}: ${message}`);
      await wait(attempt * 500);
      continue;
    }
    throw new Error(`${provider}: ${message}`);
  }
  throw lastError;
}

export function jsonHeaders(extra = {}) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...extra,
  };
}

export function bearerHeaders(apiKey, extra = {}) {
  return jsonHeaders({ Authorization: `Bearer ${apiKey}`, ...extra });
}

export function messageText(message) {
  return typeof message.content === "string" ? message.content : JSON.stringify(message.content);
}

export function commonChatOptions(options = {}) {
  const result = {};
  if (options.temperature !== undefined) result.temperature = options.temperature;
  if (options.topP !== undefined) result.top_p = options.topP;
  if (options.stop !== undefined) result.stop = options.stop;
  return result;
}
