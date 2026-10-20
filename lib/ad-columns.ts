// The columns of the "By ad" table on Performance: what each one is, how it is worked out, and which set is shown.
// A dash is never a guess: every empty cell carries the reason it is empty ("Converty file not imported", "No confirmed
// orders yet"), because those are different situations. Pure apart from the two guarded storage functions at the end.

export type ColumnKey =
  | "spend" | "impressions" | "cpm"
  | "hook" | "hold"
  | "ctr" | "clicks" | "cpc"
  | "metaOrders" | "metaCostPerOrder"
  | "orders" | "eligible" | "confirmedRate" | "confirmed" | "notYetConfirmed" | "cancelled" | "costPerConfirmed" | "delivered" | "deliveredRate" | "costPerDelivered" | "returned" | "deliveredRevenue";

export type Format = "spendMoney" | "revenueMoney" | "integer" | "percent" | "percent2";
export type GroupId = "delivery" | "attention" | "traffic" | "conversion" | "quality";

export interface ColumnDef {
  key: ColumnKey;
  label: string;
  group: GroupId;
  format: Format;
  /** Shown when the header is hovered. */
  definition: string;
}

export const GROUPS: Array<{ id: GroupId; label: string }> = [
  { id: "delivery", label: "Delivery" },
  { id: "attention", label: "Attention" },
  { id: "traffic", label: "Traffic" },
  { id: "conversion", label: "Conversion · Meta" },
  { id: "quality", label: "Order quality · order file" },
];

const FILE = "in the order file (Converty)";
const WINDOW = "Ad spend over the days the order file covers, so spend and orders are for the same period.";

/** In display order: a table always shows its columns in this order, whichever way they were picked. */
export const COLUMNS: ColumnDef[] = [
  { key: "spend", label: "Spend", group: "delivery", format: "spendMoney", definition: "Amount spent on the ad over every imported day." },
  { key: "impressions", label: "Impressions", group: "delivery", format: "integer", definition: "Times the ad was shown." },
  { key: "cpm", label: "CPM", group: "delivery", format: "spendMoney", definition: "Cost per 1,000 impressions." },
  { key: "hook", label: "Hook %", group: "attention", format: "percent", definition: "Share of impressions that watched the first seconds (video ads)." },
  { key: "hold", label: "Hold %", group: "attention", format: "percent", definition: "Share of impressions that kept watching (video ads)." },
  { key: "ctr", label: "Link CTR", group: "traffic", format: "percent2", definition: "Link clicks divided by impressions." },
  { key: "clicks", label: "Link clicks", group: "traffic", format: "integer", definition: "Clicks on the ad's link." },
  { key: "cpc", label: "Cost / link click", group: "traffic", format: "spendMoney", definition: "Spend divided by link clicks." },
  { key: "metaOrders", label: "Meta orders", group: "conversion", format: "integer", definition: "Purchases Meta attributes to the ad. Meta's claim, not recorded orders." },
  { key: "metaCostPerOrder", label: "Meta cost / order", group: "conversion", format: "spendMoney", definition: "Spend divided by the purchases Meta attributes to the ad." },
  { key: "orders", label: "Orders", group: "quality", format: "integer", definition: `Orders recorded for this ad ${FILE}.` },
  { key: "eligible", label: "Eligible orders", group: "quality", format: "integer", definition: "Orders that were not cancelled before anyone confirmed them: the orders confirmation is measured against." },
  { key: "confirmedRate", label: "Confirmed %", group: "quality", format: "percent", definition: "Confirmed orders over eligible orders: how many of the orders this ad generated actually confirm." },
  { key: "confirmed", label: "Confirmed orders", group: "quality", format: "integer", definition: `Orders that were confirmed ${FILE}.` },
  { key: "notYetConfirmed", label: "Not yet confirmed", group: "quality", format: "integer", definition: "Eligible orders that are neither confirmed nor cancelled yet." },
  { key: "cancelled", label: "Cancelled", group: "quality", format: "integer", definition: "Orders cancelled before confirmation." },
  { key: "costPerConfirmed", label: "Cost / confirmed", group: "quality", format: "spendMoney", definition: `${WINDOW} Divided by this ad's confirmed orders.` },
  { key: "delivered", label: "Delivered orders", group: "quality", format: "integer", definition: `Orders that were delivered ${FILE}.` },
  { key: "deliveredRate", label: "Delivered %", group: "quality", format: "percent", definition: "Delivered orders over confirmed orders." },
  { key: "costPerDelivered", label: "Cost / delivered", group: "quality", format: "spendMoney", definition: `${WINDOW} Divided by this ad's delivered orders.` },
  { key: "returned", label: "Returned", group: "quality", format: "integer", definition: `Orders that came back ${FILE}.` },
  { key: "deliveredRevenue", label: "Delivered revenue", group: "quality", format: "revenueMoney", definition: "Revenue of the delivered orders, in the order file's currency." },
];

const BY_KEY = new Map(COLUMNS.map((column) => [column.key, column] as const));
export const columnDef = (key: ColumnKey) => BY_KEY.get(key)!;

/** One ad, as the backend returns it. */
export interface AdRow {
  hasMeta: boolean;
  hasConverty: boolean;
  spend: number;
  /** Spend over the days the order file covers; the numerator of every cost per order-file outcome. */
  spendInOrderWindow: number;
  impressions: number;
  linkClicks: number;
  purchases: number;
  hookRate?: number | null;
  holdRate?: number | null;
  orders: number;
  deleted: number;
  confirmed: number;
  delivered: number;
  returned: number;
  deliveredRevenue: number;
}

export interface Context {
  /** A Converty (or other order) file is imported for this product. */
  hasOrderFile: boolean;
  /** The ad export counts purchases at all (some exports optimise for something else and have none). */
  exportCountsPurchases: boolean;
}

export interface Cell {
  value: number | null;
  /** Why there is no value. */
  reason: string | null;
}

const ok = (value: number): Cell => ({ value, reason: null });
const none = (reason: string): Cell => ({ value: null, reason });
const over = (top: number, bottom: number, reason: string): Cell => (bottom > 0 ? ok(top / bottom) : none(reason));

export function cellFor(key: ColumnKey, ad: AdRow, context: Context): Cell {
  const inExport = (): Cell | null => (ad.hasMeta ? null : none("Not in the ad export"));
  // With an order file imported, an ad it does not list has no recorded orders: its counts are 0, not unknown. Only a
  // ratio over nothing stays empty, and says so.
  const orderFile = (): Cell | null => (!context.hasOrderFile ? none("Converty file not imported") : null);
  const noOrders = context.hasOrderFile && !ad.hasConverty ? "No orders recorded for this ad in the Converty file" : null;
  const eligible = ad.orders - ad.deleted;
  switch (key) {
    case "spend": return inExport() ?? ok(ad.spend);
    case "impressions": return inExport() ?? ok(ad.impressions);
    case "cpm": return inExport() ?? over(ad.spend * 1000, ad.impressions, "No impressions");
    case "hook": return inExport() ?? (ad.hookRate == null ? none("Meta reports this for video ads only") : ok(ad.hookRate));
    case "hold": return inExport() ?? (ad.holdRate == null ? none("Meta reports this for video ads only") : ok(ad.holdRate));
    case "ctr": return inExport() ?? over(ad.linkClicks, ad.impressions, "No impressions");
    case "clicks": return inExport() ?? ok(ad.linkClicks);
    case "cpc": return inExport() ?? over(ad.spend, ad.linkClicks, "No link clicks");
    case "metaOrders": return inExport() ?? (context.exportCountsPurchases ? ok(ad.purchases) : none("The ad export does not count purchases"));
    case "metaCostPerOrder": return inExport() ?? (context.exportCountsPurchases ? over(ad.spend, ad.purchases, "No purchases reported") : none("The ad export does not count purchases"));
    case "orders": return orderFile() ?? ok(ad.orders);
    case "eligible": return orderFile() ?? ok(eligible);
    case "confirmedRate": return orderFile() ?? over(ad.confirmed, eligible, noOrders ?? "No eligible orders yet");
    case "confirmed": return orderFile() ?? ok(ad.confirmed);
    case "notYetConfirmed": return orderFile() ?? ok(Math.max(0, eligible - ad.confirmed));
    case "cancelled": return orderFile() ?? ok(ad.deleted);
    case "costPerConfirmed": return orderFile() ?? inExport() ?? over(ad.spendInOrderWindow, ad.confirmed, noOrders ?? "No confirmed orders yet");
    case "delivered": return orderFile() ?? ok(ad.delivered);
    case "deliveredRate": return orderFile() ?? over(ad.delivered, ad.confirmed, noOrders ?? "No confirmed orders yet");
    case "costPerDelivered": return orderFile() ?? inExport() ?? over(ad.spendInOrderWindow, ad.delivered, noOrders ?? "No delivered orders yet");
    case "returned": return orderFile() ?? ok(ad.returned);
    case "deliveredRevenue": return orderFile() ?? ok(ad.deliveredRevenue);
  }
}

export type PresetId = "overview" | "creative" | "quality" | "economics";

export interface Preset {
  id: PresetId;
  label: string;
  /** The question this view answers. */
  question: string;
  columns: (context: Context) => ColumnKey[];
}

export const PRESETS: Preset[] = [
  {
    id: "overview",
    label: "Overview",
    question: "Which ads are producing confirmed business?",
    // Meta's cost per order stands in for cost per confirmed order until an order file says which orders confirm.
    columns: (context) => ["spend", "hook", "hold", "ctr", "metaOrders", "confirmedRate", "confirmed", context.hasOrderFile ? "costPerConfirmed" : "metaCostPerOrder"],
  },
  { id: "creative", label: "Creative diagnostics", question: "Where does attention or traffic drop off?", columns: () => ["spend", "impressions", "hook", "hold", "ctr", "clicks", "metaOrders", "metaCostPerOrder"] },
  { id: "quality", label: "Order quality", question: "Which ads produce orders that actually confirm?", columns: () => ["metaOrders", "orders", "eligible", "confirmedRate", "confirmed", "notYetConfirmed", "cancelled"] },
  { id: "economics", label: "Economics", question: "What does each confirmed or delivered order cost?", columns: () => ["spend", "metaCostPerOrder", "confirmed", "costPerConfirmed", "delivered", "costPerDelivered", "deliveredRevenue"] },
];

/** The chosen view: one of the presets, or a hand-picked set. */
export interface View {
  preset: PresetId | "custom";
  custom: ColumnKey[];
}
export const DEFAULT_VIEW: View = { preset: "overview", custom: [] };

/** The columns to show, always in the table's own order. */
export function columnsFor(view: View, context: Context): ColumnKey[] {
  const wanted = new Set<ColumnKey>(view.preset === "custom" ? view.custom : (PRESETS.find((preset) => preset.id === view.preset) ?? PRESETS[0]).columns(context));
  return COLUMNS.filter((column) => wanted.has(column.key)).map((column) => column.key);
}

/** Ticking or unticking one column turns the view into a custom one, starting from what is shown now. */
export function toggleColumn(view: View, context: Context, key: ColumnKey): View {
  const shown = new Set(columnsFor(view, context));
  if (shown.has(key)) shown.delete(key);
  else shown.add(key);
  return { preset: "custom", custom: COLUMNS.filter((column) => shown.has(column.key)).map((column) => column.key) };
}

export type SortDir = "asc" | "desc";

/** Ads ordered by one column, empty cells last whichever way. A stable order by name breaks ties. */
export function sortAds<T extends AdRow & { name: string }>(ads: T[], key: ColumnKey, dir: SortDir, context: Context): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...ads].sort((a, b) => {
    const x = cellFor(key, a, context).value;
    const y = cellFor(key, b, context).value;
    if (x === null && y === null) return a.name.localeCompare(b.name);
    if (x === null) return 1;
    if (y === null) return -1;
    return x === y ? a.name.localeCompare(b.name) : sign * (x - y);
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Remembering the view. Browser storage can be empty, blocked or throw, so every use is guarded.

const storageKey = (productId: string) => `prism-ad-columns:${productId}`;
const PRESET_IDS = PRESETS.map((preset) => preset.id);

export function readView(productId: string): View {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(storageKey(productId));
    if (!raw) return DEFAULT_VIEW;
    const value = JSON.parse(raw) as Partial<View>;
    const custom = Array.isArray(value.custom) ? value.custom.filter((key): key is ColumnKey => BY_KEY.has(key as ColumnKey)) : [];
    if (value.preset === "custom") return custom.length ? { preset: "custom", custom } : DEFAULT_VIEW;
    return PRESET_IDS.includes(value.preset as PresetId) ? { preset: value.preset as PresetId, custom: [] } : DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
}

export function saveView(productId: string, view: View) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey(productId), JSON.stringify(view));
  } catch {
    // Nothing to do: the next visit opens on the Overview.
  }
}
