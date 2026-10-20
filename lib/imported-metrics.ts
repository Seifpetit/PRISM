// Ratios for imported ads: the Meta export's spend and clicks next to Converty's order pipeline. Pure, no imports.
// Converty's own definitions, checked against the ratios its file states: an order is "deleted" when it was cancelled
// before anyone confirmed it, so the confirmation rate leaves those out; delivery is measured against what was
// confirmed. Money is never converted, so every ratio here divides a money amount by a count or a count by a count.

export interface AdCounts {
  spend: number;
  impressions: number;
  linkClicks: number;
  orders: number;
  deleted: number;
  confirmed: number;
  delivered: number;
  returned: number;
}

const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);

/** Confirmed orders over orders that stayed alive (not deleted). */
export const confirmationRate = (counts: Pick<AdCounts, "orders" | "deleted" | "confirmed">) => ratio(counts.confirmed, counts.orders - counts.deleted);

/** Delivered orders over confirmed ones. */
export const deliveryRate = (counts: Pick<AdCounts, "confirmed" | "delivered">) => ratio(counts.delivered, counts.confirmed);

/** Returned orders over confirmed ones. */
export const returnRate = (counts: Pick<AdCounts, "confirmed" | "returned">) => ratio(counts.returned, counts.confirmed);

/** What one delivered order cost in ad spend: the number that says whether an ad pays, in the spend's own currency. */
export const costPerDelivered = (counts: Pick<AdCounts, "spend" | "delivered">) => ratio(counts.spend, counts.delivered);

/** Link click-through rate. */
export const linkCtr = (counts: Pick<AdCounts, "linkClicks" | "impressions">) => ratio(counts.linkClicks, counts.impressions);
