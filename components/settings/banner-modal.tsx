"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { api, type PexelsBanner } from "@/api/api";
import { Modal } from "@/components/ui/modal";
import {
  MAX_ACTIVE_THEMES,
  MAX_CUSTOM_THEMES,
  THEME_CATALOG,
  DEFAULT_THEMES,
  customTheme,
  findTheme,
  type ThemeDef,
  type ThemeState,
} from "@/lib/banner-themes";
import { BUILTIN_CHOICES, type BannerChoice } from "@/lib/control-room-appearance";
import { h } from "@/lib/h";

/** A banner photo over its fallback colour: the colour is what shows until (or unless) the photo loads. */
export function BannerImage({ src, color, className = "" }: { src: string; color: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return h(
    "div",
    { className: `overflow-hidden ${className}`, style: { background: color } },
    failed ? null : h("img", { key: src, src, alt: "", loading: "lazy", draggable: false, onError: () => setFailed(true), className: "absolute inset-0 h-full w-full object-cover" }),
  );
}

function BannerTile({ banner, selected, onSelect }: { banner: BannerChoice; selected: boolean; onSelect: () => void }) {
  return h(
    "button",
    {
      type: "button",
      onClick: onSelect,
      "aria-pressed": selected,
      "aria-label": `${banner.label} banner`,
      className:
        "group relative block aspect-[16/8] w-full overflow-hidden rounded-xl text-left outline-none transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(21,23,26,.18)] focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
      style: { boxShadow: selected ? "0 0 0 3px var(--control-accent)" : undefined, ["--tw-ring-color" as string]: "var(--control-accent)" },
    },
    h(BannerImage, { src: banner.thumb, color: banner.color, className: "relative h-full w-full" }),
    h("span", { className: "pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" }),
    h("span", { className: "pointer-events-none absolute bottom-1.5 left-2.5 right-2 truncate text-[11.5px] font-semibold text-white" }, banner.label),
    selected
      ? h("span", { className: "absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full", style: { background: "var(--control-accent)", color: "var(--control-accent-ink)" }, "aria-hidden": true }, h(Check, { size: 14, strokeWidth: 3 }))
      : null,
  );
}

const PAGE_SIZE = 9;
/** Two pages of nine up front, then two more each time the person reaches the end of the list. */
const BATCH = PAGE_SIZE * 2;

const fromPexels = (photo: PexelsBanner): BannerChoice => ({
  id: `pexels-${photo.id}`,
  label: photo.alt?.trim() || `Photo by ${photo.photographer}`,
  url: photo.bannerUrl,
  thumb: photo.thumbUrl,
  color: photo.avgColor,
  photographer: photo.photographer,
  photographerUrl: photo.photographerUrl,
  pageUrl: photo.pageUrl,
});

type Feed = { items: BannerChoice[]; page: number; hasMore: boolean; loading: boolean; error: string | null; live: boolean };
const FIRST_FEED: Feed = { items: BUILTIN_CHOICES, page: 0, hasMore: false, loading: true, error: null, live: false };

/** Round-robin, so several themes show up side by side instead of one after another. */
function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  for (let index = 0; index < Math.max(0, ...lists.map((list) => list.length)); index += 1) lists.forEach((list) => index < list.length && out.push(list[index]));
  return out;
}

// ---- importing a banner from a file --------------------------------------------------------------------------

const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

function cover(bitmap: ImageBitmap, width: number, height: number, quality: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't process images.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  context.drawImage(bitmap, (width - bitmap.width * scale) / 2, (height - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
  return { url: canvas.toDataURL("image/jpeg", quality), context };
}

/** A picture from disk, cropped to a wide banner and shrunk so it can live in the browser's storage. */
async function importBanner(file: File): Promise<BannerChoice> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") throw new Error("Choose an image file: JPG, PNG, WebP or GIF.");
  if (file.size > MAX_IMPORT_BYTES) throw new Error(`That image is larger than ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Couldn't read that image.");
  }
  try {
    const wide = cover(bitmap, 1600, 450, 0.82);
    const thumb = cover(bitmap, 480, 240, 0.7);
    // Its average colour (from a tiny copy) is what shows while the banner loads.
    const tiny = cover(bitmap, 16, 16, 0.5).context.getImageData(0, 0, 16, 16).data;
    const sum = [0, 0, 0];
    for (let index = 0; index < tiny.length; index += 4) for (let channel = 0; channel < 3; channel += 1) sum[channel] += tiny[index + channel];
    const [r, g, b] = sum.map((value) => Math.round(value / (tiny.length / 4)));
    return {
      id: `upload-${Date.now()}`,
      label: file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 60) || "Imported banner",
      url: wide.url,
      thumb: thumb.url,
      color: `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`,
    };
  } finally {
    bitmap.close();
  }
}

function ImportBox({ onImported }: { onImported: (banner: BannerChoice) => void }) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const depth = useRef(0);

  async function take(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      onImported(await importBanner(file));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't import that image.");
    } finally {
      setBusy(false);
    }
  }

  return h(
    "div",
    {
      onDragEnter: (event: React.DragEvent) => (event.preventDefault(), (depth.current += 1), setDragging(true)),
      onDragOver: (event: React.DragEvent) => event.preventDefault(),
      onDragLeave: () => ((depth.current = Math.max(0, depth.current - 1)), depth.current === 0 && setDragging(false)),
      onDrop: (event: React.DragEvent) => {
        event.preventDefault();
        depth.current = 0;
        setDragging(false);
        void take(event.dataTransfer.files?.[0]);
      },
      className: `flex shrink-0 items-center gap-3 rounded-xl border-2 border-dashed px-3.5 py-2.5 transition-colors ${dragging ? "border-[var(--control-accent)] bg-[color-mix(in_srgb,var(--control-accent)_9%,transparent)]" : "border-[#D5D9DE] bg-[#FAFBFC]"}`,
    },
    h("span", { className: "grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#E4E7EB] bg-white text-muted", "aria-hidden": true }, h(ImagePlus, { size: 17, className: busy ? "animate-pulse" : undefined })),
    h(
      "div",
      { className: "min-w-0 flex-1" },
      h("p", { className: "truncate text-[12.5px] font-semibold text-ink", role: "status" }, busy ? "Importing…" : dragging ? "Drop it to use it as your banner" : "Drop your own image here to use it as your banner"),
      error ? h("p", { role: "alert", className: "truncate text-[11px]", style: { color: "var(--status-error)" } }, error) : h("p", { className: "truncate text-[11px] text-muted" }, "JPG, PNG, WebP or GIF, up to 25 MB. It is cropped wide and stays on this device."),
    ),
    h("input", { ref: inputRef, type: "file", accept: "image/*", className: "sr-only", tabIndex: -1, "aria-hidden": true, onChange: (event: React.ChangeEvent<HTMLInputElement>) => (void take(event.target.files?.[0]), (event.target.value = "")) }),
    h("button", { type: "button", disabled: busy, onClick: () => inputRef.current?.click(), className: "shrink-0 rounded-md border border-[#DDE0E4] bg-white px-3 py-1.5 text-[11px] font-semibold text-ink hover:bg-[#F6F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage disabled:opacity-40" }, "Browse"),
  );
}

// ---- browsing --------------------------------------------------------------------------------------------------

function Chip({ active, onClick, children, label }: { active: boolean; onClick: () => void; children?: React.ReactNode; label?: string }) {
  return h(
    "button",
    {
      type: "button",
      onClick,
      "aria-pressed": active,
      "aria-label": label,
      className: `inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[11.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${active ? "border-ink bg-ink text-white" : "border-[#DDE0E4] bg-white text-muted hover:border-[#B9C0C9] hover:text-ink"}`,
    },
    active ? h(Check, { size: 12, strokeWidth: 3, "aria-hidden": true }) : null,
    children,
  );
}

function BrowseView({
  banner,
  themes,
  onSelect,
  onThemes,
  onConfigure,
}: {
  banner: BannerChoice;
  themes: ThemeState;
  onSelect: (banner: BannerChoice) => void;
  onThemes: (themes: ThemeState) => void;
  onConfigure: () => void;
}) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [feed, setFeed] = useState<Feed>(FIRST_FEED);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const request = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(search.trim()), 450);
    return () => window.clearTimeout(timer);
  }, [search]);

  const active = themes.active.map((id) => findTheme(id, themes.custom)).filter((theme): theme is ThemeDef => Boolean(theme));
  // A search overrides the ticked themes; with neither, Pexels' curated set.
  const queries = term ? [term] : active.length ? active.map((theme) => theme.query) : [""];
  const queryKey = queries.join("|");

  const load = useCallback(
    async (page: number, replace: boolean) => {
      const mine = ++request.current;
      setFeed((current) => ({ ...(replace ? { ...FIRST_FEED, items: [] } : current), loading: true, error: null }));
      try {
        const each = queries.length === 1 ? BATCH : Math.max(6, Math.ceil(BATCH / queries.length));
        const results = await Promise.all(queries.map((query) => api.pexelsBanners({ query, page, perPage: each })));
        if (mine !== request.current) return;
        if (!results[0]?.configured) {
          setFeed({ ...FIRST_FEED, loading: false });
          return;
        }
        setFeed((current) => {
          const known = new Set(replace ? [] : current.items.map((item) => item.id));
          const fresh = interleave(results.map((result) => result.photos.map(fromPexels))).filter((item) => {
            if (known.has(item.id)) return false;
            known.add(item.id);
            return true;
          });
          return { items: replace ? fresh : [...current.items, ...fresh], page, hasMore: results.some((result) => result.hasMore), loading: false, error: null, live: true };
        });
      } catch (failure) {
        if (mine !== request.current) return;
        // Keep what is already shown; with nothing shown, fall back to the built-in nine.
        setFeed((current) => ({ ...(replace ? { ...FIRST_FEED, items: BUILTIN_CHOICES } : current), loading: false, error: failure instanceof Error ? failure.message : "Couldn't load more banners." }));
      }
    },
    // queryKey stands for the list of queries
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryKey],
  );

  useEffect(() => {
    void load(1, true);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [load]);

  // Reaching the end of the list asks for the next batch.
  useEffect(() => {
    const target = endRef.current;
    const root = scrollRef.current;
    if (!target || !root || !feed.live || !feed.hasMore || feed.loading || feed.error) return;
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && void load(feed.page + 1, false), { root, rootMargin: "160px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [feed, load]);

  const searchable = feed.live || feed.loading;
  const chips = themes.mine.map((id) => findTheme(id, themes.custom)).filter((theme): theme is ThemeDef => Boolean(theme));
  const toggle = (id: string) => {
    const on = themes.active.includes(id);
    if (!on && themes.active.length >= MAX_ACTIVE_THEMES) return;
    setSearch("");
    setTerm("");
    onThemes({ ...themes, active: on ? themes.active.filter((item) => item !== id) : [...themes.active, id] });
  };
  const shown = feed.live || (!term && !active.length) ? feed.items : [];
  // An imported banner isn't in any feed, so it leads the grid while it is the current one.
  const withCurrent = banner.id.startsWith("upload-") && !term ? [banner, ...shown] : shown;

  return h(
    "div",
    { className: "flex min-h-0 flex-1 flex-col gap-3" },
    h(ImportBox, { onImported: onSelect }),
    h(
      "div",
      { className: "flex shrink-0 items-center gap-2.5" },
      h(
        "div",
        { className: "relative min-w-0 flex-1" },
        h(Search, { size: 14, className: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted", "aria-hidden": true }),
        h("input", {
          type: "search",
          value: search,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value),
          placeholder: searchable ? "Search any photo" : "Search needs a Pexels key on the backend",
          disabled: !searchable,
          "aria-label": "Search banner photos",
          className: "h-9 w-full rounded-full border border-[#DDE0E4] bg-white pl-8 pr-3 text-xs text-ink outline-none placeholder:text-muted focus:border-[var(--control-accent)] disabled:opacity-50",
        }),
      ),
      h("button", { type: "button", onClick: onConfigure, className: "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#DDE0E4] bg-white px-3.5 text-[11.5px] font-semibold text-ink hover:bg-[#F6F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage" }, h(SlidersHorizontal, { size: 13, "aria-hidden": true }), "Configure themes"),
    ),
    h(
      "div",
      { className: "flex max-h-[76px] shrink-0 flex-wrap gap-1.5 overflow-y-auto", role: "group", "aria-label": "Banner themes. Pick several to mix them." },
      h(Chip, { active: !term && themes.active.length === 0, onClick: () => (setSearch(""), setTerm(""), onThemes({ ...themes, active: [] })) }, "Featured"),
      ...chips.map((theme) => h(Chip, { key: theme.id, active: !term && themes.active.includes(theme.id), onClick: () => toggle(theme.id) }, theme.label)),
    ),
    themes.active.length >= MAX_ACTIVE_THEMES ? h("p", { className: "shrink-0 text-[11px] text-muted" }, `Up to ${MAX_ACTIVE_THEMES} themes at a time. Untick one to add another.`) : null,
    h(
      "div",
      { ref: scrollRef, className: "min-h-[240px] flex-1 overflow-y-auto pr-1" },
      withCurrent.length
        ? h("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" }, ...withCurrent.map((item) => h(BannerTile, { key: item.id, banner: item, selected: item.id === banner.id, onSelect: () => onSelect(item) })))
        : h("p", { className: "grid h-full place-items-center text-xs text-muted" }, feed.loading ? "Loading photos…" : (feed.error ?? "No photos found.")),
      feed.loading && withCurrent.length ? h("p", { role: "status", className: "py-3 text-center text-[11px] text-muted" }, "Loading more…") : null,
      feed.error && withCurrent.length ? h("p", { role: "alert", className: "py-3 text-center text-[11px]", style: { color: "var(--status-error)" } }, feed.error) : null,
      h("div", { ref: endRef, className: "h-px" }),
    ),
    h("p", { className: "shrink-0 text-[10.5px] text-muted" }, h("a", { href: "https://www.pexels.com", target: "_blank", rel: "noopener noreferrer", className: "hover:text-ink" }, "Photos provided by Pexels")),
  );
}

// ---- configuring the theme selector --------------------------------------------------------------------------

function ConfigureView({ themes, onThemes, onDone }: { themes: ThemeState; onThemes: (themes: ThemeState) => void; onDone: () => void }) {
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState("");
  const mine = new Set(themes.mine);
  const words = filter.trim().toLowerCase();
  const matches = (theme: ThemeDef) => !words || `${theme.label} ${theme.group}`.toLowerCase().includes(words);

  const toggle = (id: string) =>
    onThemes(
      mine.has(id)
        ? { ...themes, mine: themes.mine.filter((item) => item !== id), active: themes.active.filter((item) => item !== id) }
        : { ...themes, mine: [...themes.mine, id] },
    );

  function addOwn(event: React.FormEvent) {
    event.preventDefault();
    const theme = customTheme(draft);
    if (!theme) return;
    const exists = themes.custom.some((item) => item.id === theme.id) || THEME_CATALOG.some((item) => item.id === theme.id);
    if (!exists && themes.custom.length >= MAX_CUSTOM_THEMES) return;
    onThemes({
      ...themes,
      custom: exists ? themes.custom : [...themes.custom, theme],
      mine: mine.has(theme.id) ? themes.mine : [...themes.mine, theme.id],
    });
    setDraft("");
  }

  function removeOwn(id: string) {
    onThemes({ custom: themes.custom.filter((item) => item.id !== id), mine: themes.mine.filter((item) => item !== id), active: themes.active.filter((item) => item !== id) });
  }

  const groups = [...new Set(THEME_CATALOG.map((theme) => theme.group))];
  return h(
    "div",
    { className: "flex min-h-0 flex-1 flex-col gap-3" },
    h(
      "form",
      { onSubmit: addOwn, className: "flex shrink-0 items-center gap-2.5 rounded-xl border border-[#E4E7EB] bg-[#FAFBFC] p-3" },
      h("input", { value: draft, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDraft(event.target.value), maxLength: 40, placeholder: "Write your own theme, e.g. “brutalist concrete” or “vintage maps”", "aria-label": "Your own theme", className: "h-9 min-w-0 flex-1 rounded-md border border-[#DDE0E4] bg-white px-3 text-xs text-ink outline-none focus:border-[var(--control-accent)]" }),
      h("button", { type: "submit", disabled: !customTheme(draft) || themes.custom.length >= MAX_CUSTOM_THEMES, className: "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-[11.5px] font-semibold disabled:opacity-40", style: { background: "var(--control-accent)", color: "var(--control-accent-ink)" } }, h(Plus, { size: 13, "aria-hidden": true }), "Add theme"),
    ),
    h(
      "div",
      { className: "flex shrink-0 items-center gap-2.5" },
      h(
        "div",
        { className: "relative min-w-0 flex-1" },
        h(Search, { size: 14, className: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted", "aria-hidden": true }),
        h("input", { type: "search", value: filter, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setFilter(event.target.value), placeholder: `Filter ${THEME_CATALOG.length} themes`, "aria-label": "Filter themes", className: "h-9 w-full rounded-full border border-[#DDE0E4] bg-white pl-8 pr-3 text-xs text-ink outline-none placeholder:text-muted focus:border-[var(--control-accent)]" }),
      ),
      h("p", { className: "shrink-0 text-[11px] text-muted" }, `${themes.mine.length} in your selector`),
      h("button", { type: "button", onClick: () => onThemes({ ...DEFAULT_THEMES, custom: themes.custom, mine: DEFAULT_THEMES.mine.concat(themes.custom.map((theme) => theme.id)) }), className: "shrink-0 text-[11.5px] font-semibold text-muted hover:text-ink" }, "Reset"),
    ),
    h(
      "div",
      { className: "min-h-[240px] flex-1 space-y-4 overflow-y-auto pr-1" },
      themes.custom.filter(matches).length
        ? h(
            "section",
            null,
            h("h3", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-muted" }, "Yours"),
            h(
              "div",
              { className: "flex flex-wrap gap-1.5" },
              ...themes.custom.filter(matches).map((theme) =>
                h(
                  "span",
                  { key: theme.id, className: `inline-flex h-8 items-center gap-1 rounded-full border pl-3.5 pr-1 text-[11.5px] font-semibold ${mine.has(theme.id) ? "border-ink bg-ink text-white" : "border-[#DDE0E4] bg-white text-muted"}` },
                  h("button", { type: "button", onClick: () => toggle(theme.id), "aria-pressed": mine.has(theme.id), className: "focus-visible:outline-none focus-visible:underline" }, theme.label),
                  h("button", { type: "button", onClick: () => removeOwn(theme.id), "aria-label": `Delete ${theme.label}`, className: "grid h-6 w-6 place-items-center rounded-full opacity-70 hover:opacity-100" }, h(X, { size: 12, "aria-hidden": true })),
                ),
              ),
            ),
          )
        : null,
      ...groups.map((group) => {
        const list = THEME_CATALOG.filter((theme) => theme.group === group && matches(theme));
        if (!list.length) return null;
        return h(
          "section",
          { key: group },
          h("h3", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-muted" }, group),
          h("div", { className: "flex flex-wrap gap-1.5" }, ...list.map((theme) => h(Chip, { key: theme.id, active: mine.has(theme.id), onClick: () => toggle(theme.id) }, theme.label))),
        );
      }),
      words && !THEME_CATALOG.some(matches) && !themes.custom.some(matches) ? h("p", { className: "py-8 text-center text-xs text-muted" }, "No theme matches. Write it above to add it as your own.") : null,
    ),
    h("div", { className: "flex shrink-0 justify-end" }, h("button", { type: "button", onClick: onDone, className: "h-9 rounded-md bg-ink px-5 text-xs font-semibold text-white hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage" }, "Done")),
  );
}

/** The banner, out of the way until asked for: pick a photo (mixing any themes), or bring your own, and shape which
 * themes the selector offers. */
export function BannerModal({
  open,
  onClose,
  banner,
  themes,
  onBanner,
  onThemes,
}: {
  open: boolean;
  onClose: () => void;
  banner: BannerChoice;
  themes: ThemeState;
  onBanner: (banner: BannerChoice) => void;
  onThemes: (themes: ThemeState) => void;
}) {
  const [view, setView] = useState<"browse" | "configure">("browse");
  useEffect(() => {
    if (!open) setView("browse");
  }, [open]);
  return h(
    Modal,
    {
      open,
      onClose,
      size: "xl",
      fill: true,
      title: view === "browse" ? "Choose your banner" : "Configure themes",
      subtitle: view === "browse" ? "Pick a photo, mix several themes, or bring your own image." : "Choose which themes appear in your selector, or write your own.",
    },
    h(
      "div",
      { className: "flex min-h-0 flex-1 flex-col p-5" },
      view === "browse"
        ? h(BrowseView, { banner, themes, onSelect: onBanner, onThemes, onConfigure: () => setView("configure") })
        : h(ConfigureView, { themes, onThemes, onDone: () => setView("browse") }),
    ),
  );
}
