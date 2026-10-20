"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_THEMES, MAX_ACTIVE_THEMES, MAX_CUSTOM_THEMES, THEME_CATALOG, type ThemeDef, type ThemeState } from "@/lib/banner-themes";

/** How a person has dressed their Control room: a profile banner and one accent colour used sparingly as contrast.
 * Kept in this browser, per account; there is no profile record on the backend to hold it yet. */

export type Banner = { id: string; label: string; photo: number; fallback: string };

/** Photos are served by Pexels' public CDN by id, so no API key is needed. `fallback` shows while one loads, or if
 * the CDN can't be reached. */
export const BANNERS: Banner[] = [
  { id: "soft-waves", label: "Soft waves", photo: 1103970, fallback: "#C9D8E2" },
  { id: "alpine", label: "Alpine", photo: 417173, fallback: "#5B86B5" },
  { id: "dusk-ridges", label: "Dusk ridges", photo: 1323550, fallback: "#E9A27C" },
  { id: "milky-way", label: "Milky Way", photo: 355465, fallback: "#16264A" },
  { id: "lakehouse", label: "Lakehouse", photo: 1612351, fallback: "#4A3B2A" },
  { id: "deep-blue", label: "Deep blue", photo: 2422915, fallback: "#1E6F9F" },
  { id: "desert-storm", label: "Desert storm", photo: 3244513, fallback: "#9A5B3B" },
  { id: "paint", label: "Paint splash", photo: 1266808, fallback: "#D9603F" },
  { id: "misty-woods", label: "Misty woods", photo: 1671324, fallback: "#2C3A2C" },
];

const pexelsCdn = (photo: number, width: number) =>
  `https://images.pexels.com/photos/${photo}/pexels-photo-${photo}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;

/** What a chosen banner is, whether it is one of the built-in nine or a photo found through the Pexels API. It
 * carries its own image addresses so the profile never has to look it up again. */
export type BannerChoice = {
  id: string;
  label: string;
  /** Wide image for the banner itself. */
  url: string;
  /** Small image for the picker. */
  thumb: string;
  /** Shown while the photo loads, or if it can't. */
  color: string;
  photographer?: string;
  photographerUrl?: string | null;
  pageUrl?: string | null;
};

export const builtinChoice = (banner: Banner): BannerChoice => ({
  id: banner.id,
  label: banner.label,
  url: pexelsCdn(banner.photo, 1600),
  thumb: pexelsCdn(banner.photo, 480),
  color: banner.fallback,
});

export const BUILTIN_CHOICES = BANNERS.map(builtinChoice);

export const ACCENT_PRESETS = [
  { value: "#E8590C", label: "Ember" },
  { value: "#D6336C", label: "Rose" },
  { value: "#7048E8", label: "Violet" },
  { value: "#0C8599", label: "Lagoon" },
  { value: "#2F9E44", label: "Fern" },
  { value: "#F59F00", label: "Amber" },
];

export const DEFAULT_ACCENT = ACCENT_PRESETS[0].value;
export const DEFAULT_BANNER = BANNERS[2].id;

export type Appearance = { banner: BannerChoice; accent: string; themes: ThemeState };

const isHex = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

/** Black or white, whichever reads better on `hex`. */
export function readableOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const channel = (value: number) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return luminance > 0.42 ? "#15171A" : "#FFFFFF";
}

const storageKey = (userId: string) => `prism-control-room:${userId}`;
const DEFAULTS: Appearance = { banner: BUILTIN_CHOICES.find((choice) => choice.id === DEFAULT_BANNER)!, accent: DEFAULT_ACCENT, themes: DEFAULT_THEMES };

const isUrl = (value: unknown): value is string => typeof value === "string" && /^https:\/\/\S+$/.test(value) && value.length < 600;
const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : undefined);

const MAX_UPLOAD_CHARS = 1_600_000;
const isUpload = (value: unknown): value is string => typeof value === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value) && value.length < MAX_UPLOAD_CHARS;

/** A banner read back from storage: a built-in id, an image the person imported, or a photo whose addresses are https. */
function readBanner(saved: unknown, legacyId?: unknown): BannerChoice {
  const record = (saved && typeof saved === "object" ? saved : {}) as Partial<BannerChoice>;
  const id = record.id ?? legacyId;
  const builtin = BUILTIN_CHOICES.find((choice) => choice.id === id);
  if (builtin) return builtin;
  if (typeof id === "string" && id.startsWith("upload-") && isUpload(record.url) && isUpload(record.thumb)) {
    return { id, label: text(record.label, 80) ?? "Imported banner", url: record.url, thumb: record.thumb, color: isHex(record.color) ? record.color : "#888888" };
  }
  if (typeof id === "string" && isUrl(record.url) && isUrl(record.thumb)) {
    return {
      id,
      label: text(record.label, 80) ?? "Photo",
      url: record.url,
      thumb: record.thumb,
      color: isHex(record.color) ? record.color : "#888888",
      photographer: text(record.photographer, 120),
      photographerUrl: isUrl(record.photographerUrl) ? record.photographerUrl : null,
      pageUrl: isUrl(record.pageUrl) ? record.pageUrl : null,
    };
  }
  return DEFAULTS.banner;
}

const idText = (value: unknown) => (typeof value === "string" && /^[a-z0-9-]{1,60}$/.test(value) ? value : null);

/** The theme selector read back from storage: known ids only, the person's own themes kept as plain search words. */
function readThemes(saved: unknown): ThemeState {
  const record = (saved && typeof saved === "object" ? saved : {}) as Partial<ThemeState>;
  const custom: ThemeDef[] = [];
  if (Array.isArray(record.custom)) {
    for (const item of record.custom.slice(0, MAX_CUSTOM_THEMES)) {
      const id = idText(item?.id);
      const label = text(item?.label, 40);
      if (id && label && label.trim()) custom.push({ id, label, query: text(item?.query, 80) || label, group: "Yours" });
    }
  }
  const known = new Set([...THEME_CATALOG.map((theme) => theme.id), ...custom.map((theme) => theme.id)]);
  const ids = (value: unknown) => (Array.isArray(value) ? [...new Set(value.map(idText).filter((id): id is string => Boolean(id) && known.has(id as string)))] : null);
  const mine = ids(record.mine) ?? DEFAULT_THEMES.mine;
  const active = (ids(record.active) ?? []).filter((id) => mine.includes(id)).slice(0, MAX_ACTIVE_THEMES);
  return { mine, active, custom };
}

const listeners = new Set<() => void>();
const snapshots = new Map<string, { raw: string | null; value: Appearance }>();

function read(userId: string): Appearance {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(storageKey(userId));
  } catch {
    // Storage can be blocked; the defaults still work.
  }
  // useSyncExternalStore needs the same object back until the stored value changes.
  const cached = snapshots.get(userId);
  if (cached && cached.raw === raw) return cached.value;
  let value = DEFAULTS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<Appearance> & { bannerId?: string };
      value = {
        banner: readBanner(parsed.banner, parsed.bannerId),
        accent: isHex(parsed.accent) ? parsed.accent.toUpperCase() : DEFAULTS.accent,
        themes: readThemes(parsed.themes),
      };
    } catch {
      value = DEFAULTS;
    }
  }
  snapshots.set(userId, { raw, value });
  return value;
}

export function useControlRoomAppearance(userId: string) {
  const subscribe = useCallback((notify: () => void) => {
    listeners.add(notify);
    window.addEventListener("storage", notify);
    return () => {
      listeners.delete(notify);
      window.removeEventListener("storage", notify);
    };
  }, []);
  const appearance = useSyncExternalStore(subscribe, () => read(userId), () => DEFAULTS);
  const update = useCallback(
    (patch: Partial<Appearance>) => {
      const next = { ...read(userId), ...patch };
      try {
        window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
      } catch {
        // Not saved, but the choice still shows until the page reloads.
        snapshots.set(userId, { raw: null, value: next });
      }
      listeners.forEach((notify) => notify());
    },
    [userId],
  );
  return { appearance, update, isHex };
}
