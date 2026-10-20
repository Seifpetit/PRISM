import { createHash } from "node:crypto";

const SECRET_KEY =
  /^(authorization|proxy-authorization|cookie|set-cookie|api[-_]?key|password|client[-_]?secret|access[-_]?token|refresh[-_]?token)$/i;
const MAX_STRING_LENGTH = 100_000;
const MAX_DEPTH = 14;

function sanitizeUrl(value) {
  if (!/^https?:\/\//i.test(value)) return value;
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (/token|signature|credential|api[-_]?key|x-amz/i.test(key))
        url.searchParams.set(key, "[REDACTED]");
    }
    return url.toString();
  } catch {
    return value;
  }
}

function sanitizeValue(value, depth, state) {
  if (depth > MAX_DEPTH) {
    state.redacted = true;
    return "[MAX_DEPTH_REACHED]";
  }
  if (
    value === null ||
    value === undefined ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return value ?? null;
  if (typeof value === "string") {
    if (/^data:[^;,]+;base64,/i.test(value)) {
      state.redacted = true;
      return `[BINARY_DATA_REDACTED:${value.length} chars]`;
    }
    const safe = sanitizeUrl(value);
    if (safe.length <= MAX_STRING_LENGTH) return safe;
    state.redacted = true;
    return `${safe.slice(0, MAX_STRING_LENGTH)}[TRUNCATED:${safe.length - MAX_STRING_LENGTH} chars]`;
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, depth + 1, state));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (SECRET_KEY.test(key)) {
          state.redacted = true;
          return [key, "[REDACTED]"];
        }
        return [key, sanitizeValue(item, depth + 1, state)];
      }),
    );
  }
  state.redacted = true;
  return `[UNSUPPORTED:${typeof value}]`;
}

export function sanitizeOperationPayload(value) {
  const state = { redacted: false };
  const content = sanitizeValue(value, 0, state);
  const serialized = JSON.stringify(content);
  return {
    content,
    redactionStatus: state.redacted ? "redacted" : "not_required",
    byteSize: Buffer.byteLength(serialized, "utf8"),
    contentHash: createHash("sha256").update(serialized).digest("hex"),
  };
}
