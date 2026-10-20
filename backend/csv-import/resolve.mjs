// Working out which PRISM product each ad in a file belongs to. It never guesses silently: an ad that the evidence
// does not settle is "unresolved" and the person is asked. Pure, so it is tested with plain objects.

export const squash = (text) => String(text ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** The products whose name is contained in `text` (ignoring case, spaces and punctuation). Names under 3 letters match nothing. */
function productsNamedIn(text, products) {
  const haystack = squash(text);
  if (!haystack) return [];
  return products.filter((product) => {
    const needle = squash(product.name);
    return needle.length >= 3 && haystack.includes(needle);
  });
}

/**
 * @param items        what to place: { key, adName, campaign, rows } (a Converty row has a campaign, a Meta ad only a name)
 * @param products     the workspace's products: { id, name }
 * @param assignments  Meta campaigns already assigned to a product: { campaignName, productId }
 * @param knownAds     ad names seen in earlier imports: Map(squashed ad name -> productId)
 * @returns { placed: Map(key -> { productId, reason }), groups: Map(productId -> { ads, rows, reasons }), unresolved: { keys, rows } }
 */
export function resolveProducts({ items, products, assignments = [], knownAds = new Map() }) {
  const byCampaign = new Map();
  for (const assignment of assignments) {
    const key = squash(assignment.campaignName);
    if (!key) continue;
    // A campaign name assigned to two products settles nothing.
    byCampaign.set(key, byCampaign.has(key) && byCampaign.get(key) !== assignment.productId ? null : assignment.productId);
  }

  const placed = new Map();
  const groups = new Map();
  const unresolvedKeys = [];
  let unresolvedRows = 0;

  const place = (item, productId, reason) => {
    placed.set(item.key, { productId, reason });
    const group = groups.get(productId) ?? { keys: new Set(), rows: 0, reasons: new Map() };
    group.keys.add(item.key);
    group.rows += item.rows;
    group.reasons.set(reason, (group.reasons.get(reason) ?? 0) + 1);
    groups.set(productId, group);
  };

  // Orders Converty could not attribute to an ad are not an ad. They are settled after the rest, by where the rest went.
  const unattributed = [];

  for (const item of items) {
    if (item.unattributed) {
      unattributed.push(item);
      continue;
    }
    // 1. A campaign the person already assigned to a product in Performance.
    const assigned = item.campaign ? byCampaign.get(squash(item.campaign)) : undefined;
    if (assigned) {
      place(item, assigned, "campaign");
      continue;
    }
    // 2. The same ad already imported from another file.
    const earlier = knownAds.get(squash(item.adName));
    if (earlier) {
      place(item, earlier, "earlier");
      continue;
    }
    // 3. A product's name in the campaign or in the ad's name. Two different products named is not an answer.
    const named = new Map();
    for (const product of [...productsNamedIn(item.campaign, products), ...productsNamedIn(item.adName, products)]) named.set(product.id, product);
    if (named.size === 1) {
      place(item, [...named.keys()][0], item.campaign && productsNamedIn(item.campaign, products).length ? "campaign-name" : "ad-name");
      continue;
    }
    unresolvedKeys.push(item.key);
    unresolvedRows += item.rows;
  }

  // If the rest of the file went to exactly one product, so did the orders that have no ad. Otherwise it is a question.
  const only = groups.size === 1 ? [...groups.keys()][0] : null;
  for (const item of unattributed) {
    if (only) place(item, only, "unattributed");
    else {
      unresolvedKeys.push(item.key);
      unresolvedRows += item.rows;
    }
  }
  return { placed, groups, unresolved: { keys: unresolvedKeys, rows: unresolvedRows } };
}

const REASON_TEXT = {
  campaign: "the campaign is one you assigned to it",
  earlier: "the same ad was in a file you imported before",
  "campaign-name": "the campaign's name contains the product's name",
  "ad-name": "the ad's name contains the product's name",
  unattributed: "orders with no ad go with the rest of the file",
};

/** "the campaign is one you assigned to it; the ad's name contains the product's name" */
export function describeReasons(reasons) {
  return [...reasons.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reason]) => REASON_TEXT[reason] ?? reason)
    .join("; ");
}
