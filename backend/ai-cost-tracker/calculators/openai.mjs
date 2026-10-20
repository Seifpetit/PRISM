const USD_SCALE = 12;
const USD_SCALE_FACTOR = 10n ** BigInt(USD_SCALE);
const MILLION = 1_000_000n;

function decimalParts(value) {
  const text = String(value);
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new TypeError(`Invalid non-negative decimal: ${text}`);
  const [whole, fraction = ""] = text.split(".");
  return { integer: BigInt(whole + fraction), scale: fraction.length };
}

function multiplyScaled(value, multiplier) {
  const parsed = decimalParts(multiplier);
  return (value * parsed.integer) / 10n ** BigInt(parsed.scale);
}

function tokenCostUnits(tokens, ratePerMillion) {
  if (tokens === null) return null;
  if (tokens === 0) return 0n;
  if (ratePerMillion === null) return null;
  const rate = decimalParts(ratePerMillion);
  return (BigInt(tokens) * rate.integer * USD_SCALE_FACTOR) / (MILLION * 10n ** BigInt(rate.scale));
}

function usd(units) {
  if (units === null) return null;
  const whole = units / USD_SCALE_FACTOR;
  const fraction = (units % USD_SCALE_FACTOR)
    .toString()
    .padStart(USD_SCALE, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function lineItem(tokens, ratePerMillion) {
  const units = tokenCostUnits(tokens, ratePerMillion);
  return {
    tokens,
    ratePerMillion: ratePerMillion === null ? null : String(ratePerMillion),
    costUsd: usd(units),
    units,
  };
}

function publicLineItem(item) {
  const { units: _units, ...result } = item;
  return result;
}

/** Apply the audited OpenAI token formula without floating-point money math. */
export function calculateOpenAICost({ normalizedUsage, pricing, unsupportedCharges = [] }) {
  if (!normalizedUsage) {
    return { status: "unpriced", costUsd: null, reason: "missing_usage", breakdown: null };
  }
  if (pricing.status !== "resolved") {
    return { status: "unpriced", costUsd: null, reason: pricing.reason, breakdown: null };
  }

  const items = {
    uncachedInput: lineItem(normalizedUsage.uncachedInputTokens, pricing.rates.input),
    cachedInput: lineItem(normalizedUsage.cachedInputTokens, pricing.rates.cachedInput),
    cacheWrite: lineItem(normalizedUsage.cacheWriteTokens, pricing.rates.cacheWrite),
    output: lineItem(normalizedUsage.outputTokens, pricing.rates.output),
  };
  const missingDimensions = Object.entries(items)
    .filter(([, item]) => item.tokens === null)
    .map(([name]) => name);
  const missingRates = Object.entries(items)
    .filter(([, item]) => item.tokens !== null && item.tokens > 0 && item.ratePerMillion === null)
    .map(([name]) => name);
  const publicItems = Object.fromEntries(
    Object.entries(items).map(([key, item]) => [key, publicLineItem(item)]),
  );

  if (missingDimensions.length || missingRates.length || unsupportedCharges.length) {
    return {
      status: "partial",
      costUsd: null,
      reason: unsupportedCharges.length
        ? "unsupported_request_charges"
        : missingRates.length
          ? "missing_applicable_rate"
          : "missing_usage_dimension",
      breakdown: {
        ...publicItems,
        requestChargesUsd: null,
        modifierUsd: null,
        knownSubtotalUsd: usd(
          Object.values(items).reduce((sum, item) => sum + (item.units ?? 0n), 0n),
        ),
        missingDimensions,
        missingRates,
        unsupportedCharges,
      },
    };
  }

  const subtotalUnits = Object.values(items).reduce((sum, item) => sum + item.units, 0n);
  const totalUnits = pricing.modifiers.reduce(
    (value, modifier) => multiplyScaled(value, modifier.multiplier),
    subtotalUnits,
  );
  const modifierUnits = totalUnits - subtotalUnits;

  return {
    status: "priced",
    costUsd: usd(totalUnits),
    reason: null,
    breakdown: {
      ...publicItems,
      requestChargesUsd: "0",
      subtotalUsd: usd(subtotalUnits),
      modifierMultiplier: pricing.modifiers.length
        ? pricing.modifiers.map((modifier) => String(modifier.multiplier)).join(" * ")
        : "1",
      modifierUsd: usd(modifierUnits),
    },
  };
}
