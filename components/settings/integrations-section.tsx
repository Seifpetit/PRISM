"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { api, type IntegrationStatus } from "@/api/api";
import { CsvImportControl } from "@/components/settings/csv-import";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { LibraryHeader, LibraryToolbar, matchesSearch, PagedLibrary } from "@/components/settings/library";
import { Modal } from "@/components/ui/modal";
import { h } from "@/lib/h";
import {
  AD_INTEGRATIONS,
  CLOUD_STORAGE_INTEGRATIONS,
  FULFILLMENT_INTEGRATIONS,
  type IntegrationDef,
} from "@/lib/integrations";

type StatusState = { loading: boolean; error: boolean; byId: Record<string, IntegrationStatus> };


/** Whole days until `iso`, or null when there is no expiry. */
function daysUntil(iso?: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

const buttonClass =
  "shrink-0 rounded-md border border-[#DDE0E4] px-3 py-1.5 text-[11px] font-semibold text-ink " +
  "hover:bg-[#F6F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

function StatusBadge({ def, state }: { def: IntegrationDef; state: StatusState }) {
  const base = "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold";
  if (def.disabled || !def.backendChecked) {
    return h("span", { className: `${base} border-[#E1E4E8] text-muted` }, "Coming soon");
  }
  if (state.loading) return h("span", { className: `${base} border-[#E1E4E8] text-muted` }, "Checking…");
  if (state.error) return h("span", { className: `${base} border-[#E1E4E8] text-muted` }, "Status unavailable");
  const status = state.byId[def.id];
  if (status?.connected) return h("span", { className: `${base} border-ink bg-ink text-white` }, "Connected");
  // A token that used to work is the common case for Meta, so say so instead of just "Not connected".
  if (/expired/i.test(status?.error ?? "")) {
    return h("span", { className: `${base} border-red-300 text-red-700` }, "Token expired");
  }
  return h("span", { className: `${base} border-[#DDE0E4] text-muted` }, "Not connected");
}

/** The account a connection is linked to, as a badge: shown once the connection works. */
function AccountBadge({ label }: { label: string }) {
  return h(
    "span",
    {
      title: `Linked account: ${label}`,
      className:
        "inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#0866FF]/45 bg-[#0866FF]/10 py-0.5 pl-1.5 pr-2.5 text-[11px] font-semibold text-ink",
    },
    h("span", { className: "h-2 w-2 shrink-0 rounded-full bg-[#0866FF]", "aria-hidden": true }),
    h("span", { className: "truncate" }, label),
  );
}

/** Meta is connected with the person's own Marketing API token, which the backend validates with Meta before saving it. */
function MetaConnectPanel({
  onConnected,
  onCancel,
}: {
  onConnected: (status: IntegrationStatus) => void;
  onCancel: () => void;
}) {
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      onConnected(await api.connectMetaAds({ accessToken: token }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not connect to Meta.");
      setPending(false);
    }
  }

  return h(
    "form",
    { onSubmit: submit, className: "w-full rounded-lg border border-[#ECEEF1] bg-[#FAFAFB] p-4" },
    h("label", { htmlFor: "meta-ads-token", className: "text-xs font-semibold text-ink" }, "Your Meta access token"),
    h("input", {
      id: "meta-ads-token",
      type: "password",
      autoComplete: "off",
      spellCheck: false,
      value: token,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => setToken(event.target.value),
      placeholder: "Paste a Marketing API access token",
      className:
        "mt-2 h-10 w-full rounded-md border border-[#BFC5CD] bg-white px-3 text-sm text-ink outline-none focus:border-lineage",
    }),
    h(
      "p",
      { className: "mt-1.5 text-[11px] leading-4 text-muted" },
      "Use your own token. In Meta Business Settings → Users → System users: add your ad account to a system user, then Generate token with the ads_read permission (choose “Never” for expiry if offered). PRISM checks it with Meta, then stores it encrypted for this workspace only. The name of your ad account appears here once it is linked.",
    ),
    error ? h("p", { role: "alert", className: "mt-2 text-xs text-red-600" }, error) : null,
    h(
      "div",
      { className: "mt-3 flex gap-2" },
      h(
        "button",
        {
          type: "submit",
          disabled: pending || !token.trim(),
          className:
            "rounded-md bg-ink px-3.5 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35",
        },
        pending ? "Checking with Meta…" : "Connect",
      ),
      h("button", { type: "button", onClick: onCancel, disabled: pending, className: buttonClass }, "Cancel"),
    ),
  );
}

/** Shopify uses OAuth: the backend starts the install for this workspace, then the browser goes to Shopify to approve it. */
function ShopifyConnectPanel({
  onCancel,
  needsDomain,
  initialError,
}: {
  onCancel: () => void;
  /** No default store is configured on the server, so the store has to be asked for. */
  needsDomain: boolean;
  initialError: string | null;
}) {
  const [shop, setShop] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { url } = await api.startShopifyConnection({ shop: shop.trim() || undefined });
      window.location.assign(url);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not start the Shopify connection.");
      setPending(false);
    }
  }

  // The connect failed for a reason other than a missing store (e.g. the Shopify app isn't configured).
  if (!needsDomain) {
    return h(
      "div",
      { className: "w-full rounded-lg border border-[#ECEEF1] bg-[#FAFAFB] p-4" },
      h("p", { role: "alert", className: "text-xs text-red-600" }, error ?? "Could not start the Shopify connection."),
      h("div", { className: "mt-3" }, h("button", { type: "button", onClick: onCancel, className: buttonClass }, "Close")),
    );
  }

  return h(
    "form",
    { onSubmit: submit, className: "w-full rounded-lg border border-[#ECEEF1] bg-[#FAFAFB] p-4" },
    h("label", { htmlFor: "shopify-shop", className: "text-xs font-semibold text-ink" }, "Which store are you connecting?"),
    h("input", {
      id: "shopify-shop",
      type: "text",
      autoComplete: "off",
      spellCheck: false,
      value: shop,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => setShop(event.target.value),
      placeholder: "your-store.myshopify.com",
      className:
        "mt-2 h-10 w-full rounded-md border border-[#BFC5CD] bg-white px-3 text-sm text-ink outline-none focus:border-lineage",
    }),
    h(
      "p",
      { className: "mt-1.5 text-[11px] leading-4 text-muted" },
      "Shopify needs to know which store to connect. You'll be sent there to approve read access to products and orders, then brought back here.",
    ),
    error ? h("p", { role: "alert", className: "mt-2 text-xs text-red-600" }, error) : null,
    h(
      "div",
      { className: "mt-3 flex gap-2" },
      h(
        "button",
        {
          type: "submit",
          disabled: pending || !shop.trim(),
          className:
            "rounded-md bg-ink px-3.5 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35",
        },
        pending ? "Opening Shopify…" : "Continue to Shopify",
      ),
      h("button", { type: "button", onClick: onCancel, disabled: pending, className: buttonClass }, "Cancel"),
    ),
  );
}


type Category = "ads" | "fulfillment" | "storage";
type CatalogEntry = { def: IntegrationDef; category: Category };

const CATEGORY_LABEL: Record<Category, string> = {
  ads: "Ad platforms",
  fulfillment: "Landing & delivery",
  storage: "Cloud storage",
};

const CATEGORY_BLURB: Record<Category, string> = {
  ads: "Where your creatives run and performance comes back from.",
  fulfillment: "Where your storefront, orders and delivery live.",
  storage: "Bring files in, and save creatives out.",
};

const CATALOG: CatalogEntry[] = [
  ...AD_INTEGRATIONS.map((def) => ({ def, category: "ads" as const })),
  ...FULFILLMENT_INTEGRATIONS.map((def) => ({ def, category: "fulfillment" as const })),
  ...CLOUD_STORAGE_INTEGRATIONS.map((def) => ({ def, category: "storage" as const })),
];

type Availability = "connected" | "expired" | "available" | "soon" | "import" | "checking" | "unknown";

function availability(def: IntegrationDef, state: StatusState): Availability {
  if (def.action === "import") return "import";
  if (def.disabled || !def.backendChecked) return "soon";
  if (state.loading) return "checking";
  if (state.error) return "unknown";
  const status = state.byId[def.id];
  if (status?.connected) return "connected";
  if (/expired/i.test(status?.error ?? "")) return "expired";
  return "available";
}

const AVAILABILITY_LABEL: Record<Availability, string> = {
  connected: "Connected",
  expired: "Token expired",
  available: "Not connected",
  soon: "Coming soon",
  import: "Import files",
  checking: "Checking…",
  unknown: "Status unavailable",
};

const AVAILABILITY_DOT: Record<Availability, string> = {
  connected: "bg-emerald-500",
  expired: "bg-red-500",
  available: "bg-[#C3C8CF]",
  soon: "bg-[#C3C8CF]",
  import: "bg-lineage",
  checking: "bg-[#C3C8CF] animate-pulse",
  unknown: "bg-amber-500",
};

const STATUS_RANK: Record<Availability, number> = { connected: 0, expired: 1, import: 2, available: 3, checking: 4, unknown: 5, soon: 6 };

function AppIcon({ def, size = 56 }: { def: IntegrationDef; size?: number }) {
  const Icon = def.icon;
  return h(
    "span",
    {
      className: "grid shrink-0 place-items-center shadow-[0_6px_14px_rgba(21,23,26,.14)]",
      style: { background: def.iconBg, width: size, height: size, borderRadius: Math.round(size * 0.29) },
    },
    h(Icon, { size: Math.round(size * 0.46), color: "#fff", "aria-hidden": true }),
  );
}

/** Only these can be disconnected from Prism; every other connectable app has no stored connection to remove. */
const DISCONNECTABLE = new Set(["shopify", "meta-ads", "google-drive", "converty"]);

function disconnectDescription(def: IntegrationDef) {
  return def.id === "shopify"
    ? "PRISM will forget its access to this store and try to uninstall the app from it. Nothing in your store is deleted. You can connect again at any time."
    : def.id === "converty"
      ? "PRISM will delete the saved Converty tokens. Nothing in your store is deleted. To remove the app's access entirely, also remove it in Converty under Integrations → Apps. You can connect again at any time."
    : def.id === "google-drive"
      ? "PRISM will delete the saved token and revoke it with Google. Nothing in your Drive is deleted. You can connect again at any time."
      : "PRISM will delete the saved token. It stays valid on Meta's side until you revoke it in Meta Business Settings. You can connect again with your own token at any time.";
}

/** The one action a tile offers, from its status: connect when it isn't connected, disconnect when it is. */
type TileAction = { kind: "connect" | "disconnect" | "open" | "none"; label: string };

function tileAction(def: IntegrationDef, status: Availability, pending: boolean): TileAction {
  if (pending) return { kind: "none", label: status === "connected" ? "Disconnecting…" : "Opening…" };
  if (status === "import") return { kind: "open", label: "Import" };
  if (status === "soon" || !def.connectReady) return { kind: "none", label: "Coming soon" };
  if (status === "checking") return { kind: "none", label: "Checking…" };
  if (status === "connected") return DISCONNECTABLE.has(def.id) ? { kind: "disconnect", label: "Disconnect" } : { kind: "open", label: "Manage" };
  return { kind: "connect", label: status === "expired" ? "Reconnect" : "Connect" };
}

/** One integration on the home screen: its icon, its name, at a glance whether it is connected, and the button to
 * connect or disconnect it. The card itself opens the details. */
function AppTile({
  entry,
  state,
  pending,
  onOpen,
  onAction,
}: {
  entry: CatalogEntry;
  state: StatusState;
  pending: boolean;
  onOpen: () => void;
  onAction: (kind: TileAction["kind"]) => void;
}) {
  const { def, category } = entry;
  const status = availability(def, state);
  const account = state.byId[def.id]?.connected ? state.byId[def.id]?.label?.trim() || null : null;
  const action = tileAction(def, status, pending);
  return h(
    "div",
    {
      className: `group relative flex h-full w-full flex-col items-center rounded-2xl border border-[#E4E7EB] bg-white px-3 pb-3 pt-5 text-center transition hover:-translate-y-0.5 hover:border-[#C9CED5] hover:shadow-[0_8px_24px_rgba(21,23,26,.08)] focus-within:border-[#C9CED5] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${status === "soon" ? "opacity-60" : ""}`,
    },
    // Covers the whole card, under the action button, so a click anywhere else opens the details.
    h("button", {
      type: "button",
      onClick: onOpen,
      "aria-label": `${def.name}, ${CATEGORY_LABEL[category]}, ${AVAILABILITY_LABEL[status]}. Open details.`,
      className: "absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
    }),
    h(
      "span",
      { className: "pointer-events-none relative" },
      h(AppIcon, { def }),
      status === "connected"
        ? h(
            "span",
            {
              className: "absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border-2 bg-emerald-500 text-white",
              style: { borderColor: "var(--bg-panel)" },
              "aria-hidden": true,
            },
            h(Check, { size: 11, strokeWidth: 3 }),
          )
        : null,
    ),
    h("span", { className: "pointer-events-none mt-3 w-full truncate text-[13px] font-semibold text-ink" }, def.name),
    h("span", { className: "pointer-events-none mt-0.5 w-full truncate text-[11px] text-muted" }, def.hint),
    h(
      "span",
      { className: "pointer-events-none mt-auto inline-flex max-w-full items-center gap-1.5 pt-2 text-[10px] font-semibold text-muted" },
      h("span", { className: `h-1.5 w-1.5 shrink-0 rounded-full ${AVAILABILITY_DOT[status]}`, "aria-hidden": true }),
      h("span", { className: "truncate" }, account ?? AVAILABILITY_LABEL[status]),
    ),
    h(
      "button",
      {
        type: "button",
        disabled: action.kind === "none",
        onClick: () => onAction(action.kind),
        "aria-label": `${action.label} ${def.name}`,
        className: `relative mt-2.5 h-8 w-full rounded-lg text-[11.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage disabled:cursor-not-allowed ${
          action.kind === "connect"
            ? "bg-ink text-white hover:bg-ink/90"
            : action.kind === "disconnect"
              ? "border border-[#E8CACA] text-red-700 hover:bg-red-500/10"
              : action.kind === "open"
                ? "border border-[#DDE0E4] text-ink hover:bg-[#F6F7F9]"
                : "border border-[#E4E7EB] text-muted"
        }`,
      },
      action.label,
    ),
  );
}

/** Everything one integration can do: connect, reconnect, disconnect, import. Opened from its tile. */
function IntegrationDetail({
  entry,
  state,
  onStatus,
  autoConnect = false,
}: {
  entry: CatalogEntry;
  state: StatusState;
  onStatus: (status: IntegrationStatus) => void;
  /** Opened from a tile's Connect: start connecting straight away (Meta's token form, Shopify's store question). */
  autoConnect?: boolean;
}) {
  const { def, category } = entry;
  const status = state.byId[def.id];
  const daysLeft = daysUntil(status?.expiresAt);
  const expiryNote =
    daysLeft === null || !status?.connected
      ? ""
      : daysLeft <= 7
        ? `Expires in ${Math.max(daysLeft, 0)} day${daysLeft === 1 ? "" : "s"}, reconnect soon.`
        : `Renews by reconnecting in ${daysLeft} days.`;
  const accountLabel = status?.connected ? status.label?.trim() || null : null;
  const detail = status?.connected ? expiryNote : status?.error;
  const [panelOpen, setPanelOpen] = useState(false);
  const [shopifyConnecting, setShopifyConnecting] = useState(false);
  const [shopifyNeedsDomain, setShopifyNeedsDomain] = useState(false);
  const [shopifyError, setShopifyError] = useState<string | null>(null);
  const [googleDriveConnecting, setGoogleDriveConnecting] = useState(false);
  const [googleDriveError, setGoogleDriveError] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectNotice, setDisconnectNotice] = useState<string | null>(null);
  const canDisconnect = DISCONNECTABLE.has(def.id) && Boolean(status?.connected);
  const isImport = def.action === "import";

  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoConnect || autoStarted.current || status?.connected || !def.connectReady) return;
    autoStarted.current = true;
    if (def.id === "shopify") void connectShopify();
    else if (def.id === "google-drive") void connectGoogleDrive();
    else if (def.id === "converty") void connectConverty();
    else setPanelOpen(true);
    // Runs once, when the details open from a tile's Connect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function disconnect() {
    setDisconnecting(true);
    try {
      const result = await api.disconnectIntegration({ id: def.id });
      if (result.disconnected) onStatus({ id: def.id, connected: false });
      setDisconnectNotice(result.message);
    } catch (failure) {
      setDisconnectNotice(failure instanceof Error ? failure.message : "Could not disconnect.");
    } finally {
      setDisconnecting(false);
      setConfirmingDisconnect(false);
    }
  }

  /** One click: try the server's default store. Only ask for a store domain when there isn't one. */
  async function connectShopify() {
    if (panelOpen) return setPanelOpen(false);
    setShopifyConnecting(true);
    setShopifyError(null);
    try {
      const { url } = await api.startShopifyConnection({});
      window.location.assign(url);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Could not start the Shopify connection.";
      const missingDefault = /valid store domain/i.test(message);
      setShopifyNeedsDomain(missingDefault);
      setShopifyError(missingDefault ? null : message);
      setPanelOpen(true);
      setShopifyConnecting(false);
    }
  }

  async function connectConverty() {
    setGoogleDriveConnecting(true);
    setGoogleDriveError(null);
    try {
      const { url } = await api.startConvertyConnection();
      window.location.assign(url);
    } catch (failure) {
      setGoogleDriveError(failure instanceof Error ? failure.message : "Could not start the Converty connection.");
      setGoogleDriveConnecting(false);
    }
  }

  async function connectGoogleDrive() {
    setGoogleDriveConnecting(true);
    setGoogleDriveError(null);
    try {
      const { url } = await api.startGoogleDriveConnection();
      window.location.assign(url);
    } catch (failure) {
      setGoogleDriveError(failure instanceof Error ? failure.message : "Could not start the Google Drive connection.");
      setGoogleDriveConnecting(false);
    }
  }

  return h(
    "div",
    { className: "p-5" },
    h(
      "div",
      { className: "flex items-start gap-4" },
      h(AppIcon, { def, size: 64 }),
      h(
        "div",
        { className: "min-w-0 flex-1" },
        h("p", { className: "text-base font-semibold text-ink" }, def.name),
        h("p", { className: "mt-0.5 text-xs text-muted" }, `${CATEGORY_LABEL[category]} · ${def.hint}`),
        h(
          "div",
          { className: "mt-2.5 flex flex-wrap items-center gap-2" },
          isImport ? null : h(StatusBadge, { def, state }),
          accountLabel ? h(AccountBadge, { label: accountLabel }) : null,
        ),
      ),
    ),
    h("p", { className: "mt-4 text-xs leading-5 text-muted" }, CATEGORY_BLURB[category]),
    detail ? h("p", { className: "mt-2 text-[11px] leading-4 text-muted" }, detail) : null,
    h(
      "div",
      { className: "mt-5 flex flex-wrap items-center gap-2 border-t border-[#ECEEF1] pt-4" },
      isImport
        ? h(CsvImportControl)
        : canDisconnect
          ? // Connected: the same button now disconnects.
            h(
              "button",
              {
                type: "button",
                onClick: () => setConfirmingDisconnect(true),
                disabled: disconnecting,
                className:
                  "rounded-md border border-[#E8CACA] px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35",
              },
              disconnecting ? "Disconnecting…" : "Disconnect",
            )
          : h(
              "button",
              {
                type: "button",
                disabled: !def.connectReady || shopifyConnecting || googleDriveConnecting,
                title: def.connectReady ? undefined : `${def.name} connection isn't available yet`,
                onClick: () =>
                  def.id === "shopify"
                    ? void connectShopify()
                    : def.id === "google-drive"
                      ? void connectGoogleDrive()
                      : def.id === "converty"
                        ? void connectConverty()
                        : setPanelOpen((open) => !open),
                "aria-expanded": def.connectReady && def.id !== "google-drive" && def.id !== "converty" ? panelOpen : undefined,
                className:
                  "rounded-md bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35",
              },
              !def.connectReady
                ? "Coming soon"
                : shopifyConnecting
                  ? "Opening Shopify…"
                  : googleDriveConnecting
                    ? def.id === "converty"
                      ? "Opening Converty…"
                      : "Opening Google…"
                    : "Connect",
            ),
      // A token close to expiring is replaced by connecting again, without disconnecting first.
      canDisconnect && daysLeft !== null && daysLeft <= 7
        ? h(
            "button",
            {
              type: "button",
              onClick: () => (def.id === "shopify" ? void connectShopify() : def.id === "google-drive" ? void connectGoogleDrive() : setPanelOpen((open) => !open)),
              className: "text-xs font-semibold text-muted underline-offset-2 hover:text-ink hover:underline",
            },
            "Reconnect",
          )
        : null,
    ),
    disconnectNotice ? h("p", { role: "status", className: "mt-3 text-[11px] leading-4 text-muted" }, disconnectNotice) : null,
    googleDriveError ? h("p", { role: "alert", className: "mt-3 text-[11px] leading-4 text-red-600" }, googleDriveError) : null,
    panelOpen && def.id === "meta-ads"
      ? h(
          "div",
          { className: "mt-4" },
          h(MetaConnectPanel, {
            onConnected: (next: IntegrationStatus) => {
              onStatus(next);
              setPanelOpen(false);
            },
            onCancel: () => setPanelOpen(false),
          }),
        )
      : null,
    panelOpen && def.id === "shopify"
      ? h("div", { className: "mt-4" }, h(ShopifyConnectPanel, { onCancel: () => setPanelOpen(false), needsDomain: shopifyNeedsDomain, initialError: shopifyError }))
      : null,
    h(ConfirmationDialog, {
      open: confirmingDisconnect,
      title: `Disconnect ${def.name}?`,
      description: disconnectDescription(def),
      confirmLabel: disconnecting ? "Disconnecting…" : "Disconnect",
      onCancel: () => setConfirmingDisconnect(false),
      onConfirm: () => void disconnect(),
    }),
  );
}

const SORT_OPTIONS = [
  { value: "status", label: "Connected first" },
  { value: "name", label: "Name A–Z" },
  { value: "category", label: "By category" },
];

export function IntegrationsSection() {
  const [state, setState] = useState<StatusState>({ loading: true, error: false, byId: {} });
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState("all");
  const [sort, setSort] = useState("status");
  const [openId, setOpenId] = useState<string | null>(null);
  const [autoConnectId, setAutoConnectId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState<IntegrationDef | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function openDetails(id: string, autoConnect = false) {
    setAutoConnectId(autoConnect ? id : null);
    setOpenId(id);
  }

  /** Shopify and Google Drive go straight to their consent screen. Meta needs a token typed in, and anything that
   * fails (no default Shopify store, missing app credentials) opens the details, which ask or explain. */
  async function connect(def: IntegrationDef) {
    setNotice(null);
    if (def.id !== "shopify" && def.id !== "google-drive") return openDetails(def.id, true);
    setPendingId(def.id);
    try {
      const { url } = def.id === "shopify" ? await api.startShopifyConnection({}) : await api.startGoogleDriveConnection();
      window.location.assign(url);
    } catch {
      setPendingId(null);
      openDetails(def.id, true);
    }
  }

  async function disconnect(def: IntegrationDef) {
    setConfirmingDisconnect(null);
    setPendingId(def.id);
    try {
      const result = await api.disconnectIntegration({ id: def.id });
      if (result.disconnected) onStatus({ id: def.id, connected: false });
      setNotice(result.message);
    } catch (failure) {
      setNotice(failure instanceof Error ? failure.message : `Could not disconnect ${def.name}.`);
    } finally {
      setPendingId(null);
    }
  }

  useEffect(() => {
    let active = true;
    void api
      .integrationStatus()
      .then((statuses) => {
        if (active) {
          setState({ loading: false, error: false, byId: Object.fromEntries(statuses.map((status) => [status.id, status])) });
        }
      })
      .catch(() => {
        if (active) setState({ loading: false, error: true, byId: {} });
      });
    return () => {
      active = false;
    };
  }, []);

  function onStatus(status: IntegrationStatus) {
    setState((current) => ({ ...current, byId: { ...current.byId, [status.id]: status } }));
  }

  const connectedCount = CATALOG.filter((entry) => availability(entry.def, state) === "connected").length;
  const chips = [
    { value: "all", label: "All", count: CATALOG.length },
    { value: "connected", label: "Connected", count: connectedCount },
    ...(Object.keys(CATEGORY_LABEL) as Category[]).map((category) => ({
      value: category,
      label: CATEGORY_LABEL[category],
      count: CATALOG.filter((entry) => entry.category === category).length,
    })),
  ];

  const visible = useMemo(() => {
    const filtered = CATALOG.filter(
      (entry) =>
        (chip === "all" || (chip === "connected" ? availability(entry.def, state) === "connected" : entry.category === chip)) &&
        matchesSearch(search, [entry.def.name, entry.def.hint, CATEGORY_LABEL[entry.category], state.byId[entry.def.id]?.label]),
    );
    const byName = (a: CatalogEntry, b: CatalogEntry) => a.def.name.localeCompare(b.def.name);
    return [...filtered].sort((a, b) =>
      sort === "name"
        ? byName(a, b)
        : sort === "category"
          ? a.category.localeCompare(b.category) || byName(a, b)
          : STATUS_RANK[availability(a.def, state)] - STATUS_RANK[availability(b.def, state)] || byName(a, b),
    );
  }, [chip, search, sort, state]);

  const openEntry = CATALOG.find((entry) => entry.def.id === openId) ?? null;

  return h(
    "section",
    { className: "flex h-full min-h-[480px] flex-col gap-4 px-5 py-6 sm:px-8 lg:px-10", "aria-labelledby": "integrations-settings-title" },
    h(LibraryHeader, {
      eyebrow: "Integrations",
      title: "Apps & connections",
      description: "The platforms Prism connects to. Status is checked live against each provider; open an app to connect or manage it.",
      aside: h(
        "p",
        { id: "integrations-settings-title", className: "text-xs text-muted" },
        state.loading ? "Checking connections…" : `${connectedCount} of ${CATALOG.filter((entry) => entry.def.backendChecked).length} connected`,
      ),
    }),
    h(LibraryToolbar, {
      search,
      onSearch: setSearch,
      searchPlaceholder: "Search apps",
      chips,
      chip,
      onChip: setChip,
      sortOptions: SORT_OPTIONS,
      sort,
      onSort: setSort,
    }),
    notice
      ? h(
          "div",
          { role: "status", className: "flex shrink-0 items-start justify-between gap-3 text-xs text-muted" },
          h("p", { className: "min-w-0" }, notice),
          h("button", { type: "button", onClick: () => setNotice(null), className: "shrink-0 font-semibold hover:text-ink" }, "Dismiss"),
        )
      : null,
    h(PagedLibrary<CatalogEntry>, {
      items: visible,
      getKey: (entry) => entry.def.id,
      renderTile: (entry) =>
        h(AppTile, {
          entry,
          state,
          pending: pendingId === entry.def.id,
          onOpen: () => openDetails(entry.def.id),
          onAction: (kind) =>
            kind === "connect"
              ? void connect(entry.def)
              : kind === "disconnect"
                ? setConfirmingDisconnect(entry.def)
                : kind === "open"
                  ? openDetails(entry.def.id)
                  : undefined,
        }),
      tileMinWidth: 156,
      tileHeight: 208,
      gap: 14,
      resetKey: `${chip}|${search}|${sort}`,
      empty: search ? `No app matches “${search}”.` : "No apps here.",
    }),
    h(
      Modal,
      {
        open: Boolean(openEntry),
        onClose: () => setOpenId(null),
        size: "md",
        title: openEntry?.def.name ?? "",
        subtitle: openEntry ? CATEGORY_LABEL[openEntry.category] : undefined,
      },
      openEntry
        ? h(IntegrationDetail, { key: openEntry.def.id, entry: openEntry, state, onStatus, autoConnect: autoConnectId === openEntry.def.id })
        : null,
    ),
    h(ConfirmationDialog, {
      open: Boolean(confirmingDisconnect),
      title: `Disconnect ${confirmingDisconnect?.name ?? ""}?`,
      description: confirmingDisconnect ? disconnectDescription(confirmingDisconnect) : "",
      confirmLabel: "Disconnect",
      onCancel: () => setConfirmingDisconnect(null),
      onConfirm: () => (confirmingDisconnect ? void disconnect(confirmingDisconnect) : undefined),
    }),
  );
}
