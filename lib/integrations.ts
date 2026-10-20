import { FileSpreadsheet, HardDrive, Infinity, Music2, ShoppingBag, Truck } from "lucide-react";

/** Integration catalog shared by onboarding ("Testing & integrations") and Settings → Integrations. */
export type IntegrationDef = {
  id: string;
  name: string;
  hint: string;
  iconBg: string;
  icon: typeof Infinity;
  /** No backend wiring yet — shown as "Coming soon" and not interactive. */
  disabled?: boolean;
  /** Status comes from a real server-side key check (integrationStatus query) instead of a local click toggle. */
  backendChecked?: boolean;
  /** Settings → Integrations: "import" opens a file picker; everything else gets a "Connect" button. */
  action?: "connect" | "import";
  /** Settings → Integrations: Connect is wired up. Without it the Connect button is shown disabled. */
  connectReady?: boolean;
};

export const AD_INTEGRATIONS: IntegrationDef[] = [
  {
    id: "meta-ads",
    name: "Meta Ads",
    hint: "Facebook & Instagram campaigns",
    iconBg: "#0866FF",
    icon: Infinity,
    backendChecked: true,
    connectReady: true,
  },
  {
    id: "tiktok-ads",
    name: "TikTok Ads",
    hint: "TikTok for Business campaigns",
    iconBg: "#000000",
    icon: Music2,
    disabled: true,
  },
];

export const CLOUD_STORAGE_INTEGRATIONS: IntegrationDef[] = [
  {
    id: "google-drive",
    name: "Google Drive",
    hint: "Bring in files, save creatives out",
    iconBg: "#1FA463",
    icon: HardDrive,
    backendChecked: true,
    connectReady: true,
  },
];

export const FULFILLMENT_INTEGRATIONS: IntegrationDef[] = [
  {
    id: "shopify",
    name: "Shopify",
    hint: "Storefront, orders & delivery",
    iconBg: "#95BF47",
    icon: ShoppingBag,
    backendChecked: true,
    connectReady: true,
  },
  {
    id: "converty",
    name: "Converty",
    hint: "Order outcomes: confirmed, delivered, returned",
    iconBg: "#7A4CFF",
    icon: Truck,
    backendChecked: true,
    connectReady: true,
  },
  {
    id: "csv",
    name: "CSV import",
    hint: "Meta ad exports and Converty order summaries",
    iconBg: "#5B6472",
    icon: FileSpreadsheet,
    action: "import",
  },
];
