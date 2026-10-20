const SCALE = 12;
const SCALE_FACTOR = 10n ** BigInt(SCALE);
const MILLION = 1_000_000n;

function decimal(value) {
  const text = String(value);
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new TypeError(`Invalid rate: ${text}`);
  const [whole, fraction = ""] = text.split(".");
  return { integer: BigInt(whole + fraction), scale: fraction.length };
}
function costUnits(tokens, rate) {
  if (tokens === null || rate === null) return null;
  const parsed = decimal(rate);
  return (BigInt(tokens) * parsed.integer * SCALE_FACTOR) / (MILLION * 10n ** BigInt(parsed.scale));
}
function usd(units) {
  if (units === null) return null;
  const whole = units / SCALE_FACTOR;
  const fraction = (units % SCALE_FACTOR).toString().padStart(SCALE, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
function item(tokens, rate) {
  const units = costUnits(tokens, rate);
  return {
    tokens,
    ratePerMillion: rate === null ? null : String(rate),
    costUsd: usd(units),
    units,
  };
}
function publicItem({ units: _units, ...value }) {
  return value;
}

/** Gemini bills candidate output plus separately reported thinking output. */
export function calculateGeminiCost({ normalizedUsage, pricing }) {
  if (!normalizedUsage)
    return { status: "unpriced", costUsd: null, reason: "missing_usage", breakdown: null };
  if (pricing.status !== "resolved")
    return { status: "unpriced", costUsd: null, reason: pricing.reason, breakdown: null };
  const items = {
    uncachedInput: item(normalizedUsage.uncachedInputTokens, pricing.rates.input),
    cachedInput: item(normalizedUsage.cachedInputTokens, pricing.rates.cachedInput),
    output: item(normalizedUsage.billableOutputTokens, pricing.rates.output),
  };
  const missingDimensions = Object.entries(items)
    .filter(([, value]) => value.tokens === null)
    .map(([name]) => name);
  const missingRates = Object.entries(items)
    .filter(([, value]) => value.tokens > 0 && value.ratePerMillion === null)
    .map(([name]) => name);
  const breakdown = Object.fromEntries(
    Object.entries(items).map(([name, value]) => [name, publicItem(value)]),
  );
  if (missingDimensions.length || missingRates.length)
    return {
      status: "partial",
      costUsd: null,
      reason: missingRates.length ? "missing_applicable_rate" : "missing_usage_dimension",
      breakdown: { ...breakdown, missingDimensions, missingRates },
    };
  const total = Object.values(items).reduce((sum, value) => sum + value.units, 0n);
  return {
    status: "priced",
    costUsd: usd(total),
    reason: null,
    breakdown: { ...breakdown, requestChargesUsd: "0", modifierUsd: "0", subtotalUsd: usd(total) },
  };
}
