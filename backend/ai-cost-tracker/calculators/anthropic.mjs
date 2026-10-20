const SCALE = 12;
const SCALE_FACTOR = 10n ** BigInt(SCALE);
const MILLION = 1_000_000n;
const THOUSAND = 1_000n;

function decimal(value) {
  const text = String(value);
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new TypeError(`Invalid rate: ${text}`);
  const [whole, fraction = ""] = text.split(".");
  return { integer: BigInt(whole + fraction), scale: fraction.length };
}
function units(quantity, rate, divisor) {
  if (quantity === null || rate === null) return null;
  const parsed = decimal(rate);
  return (BigInt(quantity) * parsed.integer * SCALE_FACTOR) / (divisor * 10n ** BigInt(parsed.scale));
}
function usd(value) {
  if (value === null) return null;
  const whole = value / SCALE_FACTOR;
  const fraction = (value % SCALE_FACTOR).toString().padStart(SCALE, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
function item(quantity, rate, divisor) {
  const cost = units(quantity, rate, divisor);
  return { tokens: quantity, ratePerMillion: divisor === MILLION && rate !== null ? String(rate) : null, costUsd: usd(cost), units: cost };
}
function publicItem({ units: _units, ...value }) { return value; }

export function calculateAnthropicCost({ normalizedUsage, pricing }) {
  if (!normalizedUsage) return { status: "unpriced", costUsd: null, reason: "missing_usage", breakdown: null };
  if (pricing.status !== "resolved") return { status: "unpriced", costUsd: null, reason: pricing.reason, breakdown: null };
  const items = {
    uncachedInput: item(normalizedUsage.uncachedInputTokens, pricing.rates.input, MILLION),
    cachedInput: item(normalizedUsage.cachedInputTokens, pricing.rates.cachedInput, MILLION),
    output: item(normalizedUsage.outputTokens, pricing.rates.output, MILLION),
    webSearch: item(normalizedUsage.webSearchRequests, pricing.rates.webSearchPerThousand, THOUSAND),
  };
  const missing = Object.entries(items).filter(([, value]) => value.tokens === null || (value.tokens > 0 && value.units === null)).map(([name]) => name);
  const breakdown = Object.fromEntries(Object.entries(items).map(([name, value]) => [name, publicItem(value)]));
  if (missing.length) return { status: "partial", costUsd: null, reason: "missing_usage_dimension", breakdown: { ...breakdown, missingDimensions: missing } };
  const total = Object.values(items).reduce((sum, value) => sum + value.units, 0n);
  return { status: "priced", costUsd: usd(total), reason: null, breakdown: { ...breakdown, requestChargesUsd: usd(items.webSearch.units), modifierUsd: "0", subtotalUsd: usd(total) } };
}
