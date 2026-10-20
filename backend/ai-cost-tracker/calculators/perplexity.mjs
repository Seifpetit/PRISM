const SCALE = 12;
const SCALE_FACTOR = 10n ** BigInt(SCALE);
const MILLION = 1_000_000n;
const THOUSAND = 1_000n;
function decimal(value) { const text = String(value); if (!/^\d+(?:\.\d+)?$/.test(text)) throw new TypeError(`Invalid amount: ${text}`); const [whole, fraction = ""] = text.split("."); return { integer: BigInt(whole + fraction), scale: fraction.length }; }
function units(quantity, rate, divisor) { if (quantity === null || rate === null) return null; const parsed = decimal(rate); return (BigInt(quantity) * parsed.integer * SCALE_FACTOR) / (divisor * 10n ** BigInt(parsed.scale)); }
function usd(value) { if (value === null) return null; const whole = value / SCALE_FACTOR; const fraction = (value % SCALE_FACTOR).toString().padStart(SCALE, "0").replace(/0+$/, ""); return fraction ? `${whole}.${fraction}` : whole.toString(); }
function reportedUnits(value) { const parsed = decimal(value); return (parsed.integer * SCALE_FACTOR) / (10n ** BigInt(parsed.scale)); }

export function calculatePerplexityCost({ normalizedUsage, pricing }) {
  if (!normalizedUsage) return { status: "unpriced", costUsd: null, reason: "missing_usage", breakdown: null };
  if (pricing.status !== "resolved") return { status: "unpriced", costUsd: null, reason: pricing.reason, breakdown: null };
  if (normalizedUsage.reportedTotalCost !== null) {
    return { status: "priced", costUsd: usd(reportedUnits(normalizedUsage.reportedTotalCost)), reason: null, breakdown: { source: "provider_reported_usage_cost", providerCost: normalizedUsage.reportedCost, subtotalUsd: usd(reportedUnits(normalizedUsage.reportedTotalCost)) } };
  }
  const requestRate = pricing.rates.requestPerThousand?.[normalizedUsage.searchContextSize] ?? null;
  const input = units(normalizedUsage.inputTokens, pricing.rates.input, MILLION);
  const output = units(normalizedUsage.outputTokens, pricing.rates.output, MILLION);
  const request = units(1, requestRate, THOUSAND);
  if ([input, output, request].some((value) => value === null)) return { status: "partial", costUsd: null, reason: "missing_usage_dimension", breakdown: { inputTokens: normalizedUsage.inputTokens, outputTokens: normalizedUsage.outputTokens, searchContextSize: normalizedUsage.searchContextSize, missing: [input, output, request].map((value, index) => value === null ? ["input", "output", "request"][index] : null).filter(Boolean) } };
  const total = input + output + request;
  return { status: "priced", costUsd: usd(total), reason: null, breakdown: { source: "catalog_reconstruction", input: { tokens: normalizedUsage.inputTokens, ratePerMillion: String(pricing.rates.input), costUsd: usd(input) }, output: { tokens: normalizedUsage.outputTokens, ratePerMillion: String(pricing.rates.output), costUsd: usd(output) }, request: { count: 1, ratePerThousand: String(requestRate), costUsd: usd(request) }, subtotalUsd: usd(total) } };
}
