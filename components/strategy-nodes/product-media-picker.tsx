"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, Clapperboard, Crop as CropIcon, ImageIcon, Search, X, ZoomIn } from "lucide-react";
import { createPortal } from "react-dom";
import { api, type PexelsBanner, type ProductMediaAsset } from "@/api/api";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";

// Roughly where in the clip each stored frame was captured (empty-product.tsx's videoFrameTimes at intake).
// A video's own bytes are never stored — only these three stills — so the "timeline" below scrubs between them,
// not a real seekable player.
const FRAME_LABELS = ["15%", "50%", "85%"];

// The product node card's own photo panel is 250×236 — crop to exactly that ratio, so what's picked here is what
// the node shows, not a second, surprise re-crop from object-fit: cover later.
const CROP_RATIO = 250 / 236;
const CROP_OUTPUT_WIDTH = 640;
const CROP_OUTPUT_HEIGHT = Math.round(CROP_OUTPUT_WIDTH / CROP_RATIO);
const STOCK_BATCH = 15;

type View = "grid" | "video" | "stock" | "crop";

/** Pan-and-zoom crop, fixed to the product card's own ratio: the frame stays put, the picture moves under it —
 * simpler to use (and to build) than a resizable selection box, and the only ratio that matters here is the one
 * the node itself renders at. Works the same for a photo, a stock photo, or a frame pulled from a video. */
function ProductCropStep({ src, busy, onCancel, onUse }: { src: string; busy: boolean; onCancel: () => void; onUse: (dataUrl: string) => void }) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ startX: number; startY: number; start: { x: number; y: number } } | null>(null);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setFrame({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The zoom slider's 1 is "just covers the frame" (object-fit: cover); higher values zoom in from there.
  const minZoom = natural && frame.w ? Math.max(frame.w / natural.w, frame.h / natural.h) : 1;
  const shown = natural ? { w: natural.w * minZoom * zoom, h: natural.h * minZoom * zoom } : { w: 0, h: 0 };

  function clamp(next: { x: number; y: number }, size: { w: number; h: number }) {
    const maxX = Math.max(0, (size.w - frame.w) / 2);
    const maxY = Math.max(0, (size.h - frame.h) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, next.x)), y: Math.max(-maxY, Math.min(maxY, next.y)) };
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startY: event.clientY, start: offset };
  }
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setOffset(clamp({ x: drag.current.start.x + (event.clientX - drag.current.startX), y: drag.current.start.y + (event.clientY - drag.current.startY) }, shown));
  }

  function renderCrop(): string | null {
    const image = imgRef.current;
    if (!image || !natural || !frame.w) return null;
    const canvas = document.createElement("canvas");
    canvas.width = CROP_OUTPUT_WIDTH;
    canvas.height = CROP_OUTPUT_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const outputScale = CROP_OUTPUT_WIDTH / frame.w;
    const drawW = shown.w * outputScale;
    const drawH = shown.h * outputScale;
    try {
      context.drawImage(image, (CROP_OUTPUT_WIDTH - drawW) / 2 + offset.x * outputScale, (CROP_OUTPUT_HEIGHT - drawH) / 2 + offset.y * outputScale, drawW, drawH);
      return canvas.toDataURL("image/jpeg", 0.9);
    } catch {
      // A cross-origin image without permissive CORS headers taints the canvas; readback throws rather than
      // silently producing a blank image.
      return null;
    }
  }

  return h(
    "div",
    { className: "space-y-3" },
    h(
      "div",
      {
        ref: frameRef,
        className: "relative mx-auto aspect-[250/236] w-full max-w-[300px] touch-none overflow-hidden rounded-lg border border-[#E7E9EC] bg-[#F1F3F5]",
        style: { cursor: natural ? "move" : undefined },
        onPointerDown,
        onPointerMove,
        onPointerUp: () => (drag.current = null),
      },
      h("img", {
        ref: imgRef,
        src,
        alt: "",
        crossOrigin: "anonymous",
        draggable: false,
        onLoad: (event: React.SyntheticEvent<HTMLImageElement>) => {
          const image = event.currentTarget;
          setNatural({ w: image.naturalWidth, h: image.naturalHeight });
          setOffset({ x: 0, y: 0 });
          setZoom(1);
        },
        onError: () => setError("Couldn't load that image."),
        className: "pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none",
        style: natural ? { width: shown.w, height: shown.h, transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)` } : { opacity: 0 },
      }),
      !natural && !error ? h("p", { className: "absolute inset-0 grid place-items-center text-xs text-muted" }, "Loading…") : null,
    ),
    error ? h("p", { className: "text-center text-xs text-red-600" }, error) : null,
    h(
      "div",
      { className: "flex items-center gap-2 px-1" },
      h(ZoomIn, { size: 14, className: "shrink-0 text-muted", "aria-hidden": true }),
      h("input", {
        type: "range",
        min: 1,
        max: 3,
        step: 0.01,
        value: zoom,
        disabled: !natural,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          const next = Number(event.target.value);
          const nextShown = natural ? { w: natural.w * minZoom * next, h: natural.h * minZoom * next } : shown;
          setZoom(next);
          setOffset((current) => clamp(current, nextShown));
        },
        "aria-label": "Zoom",
        className: "h-1.5 w-full accent-ink disabled:opacity-40",
      }),
    ),
    h(
      "div",
      { className: "flex gap-2" },
      h("button", { type: "button", onClick: onCancel, className: "h-9 flex-1 rounded-md border border-[#DDE0E4] text-xs font-semibold text-muted hover:text-ink" }, "Back"),
      h(
        "button",
        {
          type: "button",
          disabled: busy || !natural,
          onClick: () => {
            const dataUrl = renderCrop();
            if (dataUrl) onUse(dataUrl);
            else setError("Couldn't use that image. Try another one.");
          },
          className: "flex h-9 flex-[2] items-center justify-center gap-1.5 rounded-md bg-ink px-3 text-xs font-semibold text-white hover:bg-ink/90 disabled:cursor-wait disabled:opacity-60",
        },
        h(CropIcon, { size: 13 }),
        busy ? "Setting…" : "Use this crop",
      ),
    ),
  );
}

/** Free stock photos from Pexels, for when nothing already given for this product is a good fit. */
function StockPhotoSearch({ onPick }: { onPick: (url: string) => void }) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [photos, setPhotos] = useState<PexelsBanner[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(search.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const mine = ++request.current;
    setLoading(true);
    setError(null);
    api
      .pexelsBanners({ query: term || "product on plain background", page: 1, perPage: STOCK_BATCH })
      .then((result) => {
        if (mine !== request.current) return;
        setConfigured(result.configured);
        setPhotos(result.photos);
        setPage(1);
        setHasMore(result.hasMore);
      })
      .catch((failure) => {
        if (mine !== request.current) return;
        setError(failure instanceof Error ? failure.message : "Couldn't load stock photos.");
      })
      .finally(() => mine === request.current && setLoading(false));
  }, [term]);

  async function loadMore() {
    setLoading(true);
    try {
      const result = await api.pexelsBanners({ query: term || "product on plain background", page: page + 1, perPage: STOCK_BATCH });
      setPhotos((current) => [...current, ...result.photos]);
      setPage(result.page);
      setHasMore(result.hasMore);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't load more photos.");
    } finally {
      setLoading(false);
    }
  }

  return h(
    "div",
    { className: "space-y-3" },
    h(
      "div",
      { className: "relative" },
      h(Search, { size: 14, className: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted", "aria-hidden": true }),
      h("input", {
        type: "search",
        value: search,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value),
        placeholder: "Search free stock photos",
        "aria-label": "Search stock photos",
        className: "h-9 w-full rounded-full border border-[#DDE0E4] bg-white pl-8 pr-3 text-xs text-ink outline-none placeholder:text-muted focus:border-lineage",
      }),
    ),
    !configured
      ? h("p", { className: "py-6 text-center text-xs leading-5 text-muted" }, "Stock photos need a Pexels key on the backend. Ask whoever runs Prism to set PEXELS_API_KEY.")
      : h(
          "div",
          { className: "grid grid-cols-3 gap-2" },
          ...photos.map((photo) =>
            h(
              "button",
              {
                key: photo.id,
                type: "button",
                onClick: () => onPick(photo.bannerUrl),
                title: `Photo by ${photo.photographer} on Pexels`,
                className: "group relative aspect-square overflow-hidden rounded-lg border border-[#E7E9EC]",
              },
              h("img", { src: photo.thumbUrl, alt: "", className: "h-full w-full object-cover transition-transform group-hover:scale-105" }),
            ),
          ),
        ),
    error ? h("p", { className: "text-center text-xs text-red-600" }, error) : null,
    !loading && configured && photos.length === 0 && !error ? h("p", { className: "py-4 text-center text-xs text-muted" }, "No photos found.") : null,
    loading ? h("p", { role: "status", className: "py-2 text-center text-[11px] text-muted" }, "Loading…") : null,
    configured && hasMore && !loading
      ? h("button", { type: "button", onClick: () => void loadMore(), className: "h-8 w-full rounded-md border border-[#DDE0E4] text-[11px] font-semibold text-muted hover:text-ink" }, "Load more")
      : null,
    h("p", { className: "text-center text-[10px] text-muted" }, "Photos from Pexels, free to use."),
  );
}

/**
 * The product node's media picker: every image and video given as product context, plus free stock photos, one
 * crop away from becoming the node's thumbnail. A video has no player because PRISM never keeps the source file,
 * only the handful of frames captured from it at intake — so "scrubbing" a video here moves between those stored
 * stills, and picking one is the closest real equivalent to taking a screenshot from it. Whatever is picked —
 * a product photo, a video frame, or a stock photo — goes through the same crop step before it's set, so the
 * result always matches the node's own card ratio.
 */
export function ProductMediaPicker({ open, productId, onClose }: { open: boolean; productId: string; onClose: () => void }) {
  const setProductImage = useAppStore((state) => state.setProductImage);
  const pending = useAppStore((state) => state.productImagePendingId === productId);

  const [view, setView] = useState<View>("grid");
  const [media, setMedia] = useState<ProductMediaAsset[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chooseError, setChooseError] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const cropFrom = useRef<View>("grid");
  const goToCrop = (url: string) => {
    cropFrom.current = view === "video" || view === "stock" ? view : "grid";
    setCropSource(url);
    setView("crop");
  };

  useEffect(() => {
    if (!open) return;
    setView("grid");
    setMedia(null);
    setLoadError(null);
    setChooseError(null);
    setActiveVideoId(null);
    setFrameIndex(0);
    setCropSource(null);
    let active = true;
    api
      .productMedia({ productId })
      .then((list) => active && setMedia(list))
      .catch((failure) => active && setLoadError(failure instanceof Error ? failure.message : "Could not load this product's media."));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      active = false;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, productId]);

  if (!open) return null;

  const activeVideo = media?.find((item) => item.id === activeVideoId) ?? null;

  async function choose(url: string) {
    setChooseError(null);
    try {
      await setProductImage(productId, url);
      onClose();
    } catch {
      setChooseError("Couldn't set that image. Try again.");
    }
  }

  const title = view === "crop" ? "Crop for this product" : activeVideo ? "Pick a frame" : view === "stock" ? "Search stock photos" : "Choose a product image";
  const showBack = view === "video" || view === "stock" || view === "crop";
  const backTo = () => {
    if (view === "crop") {
      setCropSource(null);
      setView(cropFrom.current);
      return;
    }
    if (view === "video") return setActiveVideoId(null);
    setView("grid");
  };

  return createPortal(
    h(
      "div",
      {
        className: "fixed inset-0 z-[150] grid place-items-center bg-[#15171A]/80 p-4 backdrop-blur-[1px]",
        role: "presentation",
        // This is a portal to document.body, but React still bubbles its synthetic events up the *component*
        // tree, not the DOM tree — and that component tree runs straight through the product node card into
        // React Flow's own node wrapper, whose onNodeClick would otherwise select the node (and open the
        // drawer) the moment any click inside this modal, including its own close, bubbles that far.
        onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => {
          event.stopPropagation();
          if (event.target === event.currentTarget) onClose();
        },
        onClick: (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation(),
      },
      h(
        "div",
        { role: "dialog", "aria-modal": true, className: "flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-[#E7E9EC] bg-panel shadow-[0_24px_60px_rgb(21_23_26/.24)]" },
        h(
          "div",
          { className: "flex shrink-0 items-center justify-between gap-2 border-b border-[#E7E9EC] p-4" },
          h(
            "div",
            { className: "flex items-center gap-2" },
            showBack
              ? h("button", { type: "button", onClick: backTo, "aria-label": "Back", className: "rounded-md p-1 text-muted hover:bg-[#F6F7F9] hover:text-ink" }, h(ChevronLeft, { size: 16 }))
              : null,
            h("h2", { className: "text-sm font-semibold text-ink" }, title),
          ),
          h("button", { type: "button", onClick: onClose, "aria-label": "Close", className: "shrink-0 rounded-md p-1 text-muted hover:bg-[#F6F7F9] hover:text-ink" }, h(X, { size: 16 })),
        ),
        h(
          "div",
          { className: "min-h-0 flex-1 overflow-y-auto p-4" },
          view === "grid"
            ? h(
                "div",
                { className: "mb-3 flex gap-1.5", role: "group", "aria-label": "Image source" },
                h("span", { className: "flex h-8 items-center rounded-full border border-ink bg-ink px-3 text-[11px] font-semibold text-white" }, "Your media"),
                h(
                  "button",
                  { type: "button", onClick: () => setView("stock"), className: "flex h-8 items-center gap-1.5 rounded-full border border-[#DDE0E4] px-3 text-[11px] font-semibold text-muted hover:border-[#B9C0C9] hover:text-ink" },
                  h(Search, { size: 11 }),
                  "Stock photos",
                ),
              )
            : null,
          chooseError ? h("p", { className: "mb-2 text-xs text-red-600" }, chooseError) : null,
          view === "crop" && cropSource
            ? h(ProductCropStep, { src: cropSource, busy: pending, onCancel: backTo, onUse: (dataUrl: string) => void choose(dataUrl) })
            : view === "stock"
              ? h(StockPhotoSearch, { onPick: goToCrop })
              : view === "video" && activeVideo
                ? h(
                    "div",
                    { className: "space-y-3" },
                    h("img", { src: activeVideo.frames?.[frameIndex] ?? activeVideo.url ?? "", alt: "", className: "aspect-video w-full rounded-lg border border-[#E7E9EC] object-cover" }),
                    h(
                      "div",
                      { className: "flex items-center justify-center gap-2" },
                      ...(activeVideo.frames ?? []).map((frame, index) =>
                        h(
                          "button",
                          {
                            key: index,
                            type: "button",
                            onClick: () => setFrameIndex(index),
                            title: `Frame at ${FRAME_LABELS[index] ?? index + 1}`,
                            className: `h-12 w-16 shrink-0 overflow-hidden rounded border-2 ${index === frameIndex ? "border-lineage" : "border-transparent opacity-70 hover:opacity-100"}`,
                          },
                          h("img", { src: frame, alt: "", className: "h-full w-full object-cover" }),
                        ),
                      ),
                    ),
                    h(
                      "p",
                      { className: "text-center text-[10.5px] text-muted" },
                      "The frames captured from this video at " + (activeVideo.frames ?? []).map((_, index) => FRAME_LABELS[index] ?? "").filter(Boolean).join(", ") + " of its length.",
                    ),
                    h(
                      "button",
                      {
                        type: "button",
                        onClick: () => goToCrop(activeVideo.frames?.[frameIndex] ?? activeVideo.url ?? ""),
                        className: "flex w-full items-center justify-center gap-1.5 rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-ink/90",
                      },
                      h(Camera, { size: 13 }),
                      "Use this frame",
                    ),
                  )
                : [
                    loadError ? h("p", { key: "err", className: "text-xs text-red-600" }, loadError) : null,
                    !loadError && !media ? h("p", { key: "loading", className: "text-xs text-muted" }, "Loading…") : null,
                    !loadError && media && media.length === 0
                      ? h("p", { key: "empty", className: "text-xs leading-5 text-muted" }, "No images or videos were given as context for this product yet. Try stock photos instead.")
                      : null,
                    media && media.length > 0
                      ? h(
                          "div",
                          { key: "grid", className: "grid grid-cols-3 gap-2" },
                          ...media.map((item) =>
                            h(
                              "button",
                              {
                                key: item.id,
                                type: "button",
                                onClick: () => {
                                  if (item.type === "video") {
                                    setActiveVideoId(item.id);
                                    setView("video");
                                  } else {
                                    goToCrop(item.url ?? "");
                                  }
                                },
                                className: "group relative aspect-square overflow-hidden rounded-lg border border-[#E7E9EC]",
                              },
                              h("img", { src: item.url ?? "", alt: "", className: "h-full w-full object-cover transition-transform group-hover:scale-105" }),
                              h(
                                "span",
                                { className: "absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-white", "aria-hidden": true },
                                item.type === "video" ? h(Clapperboard, { size: 11 }) : h(ImageIcon, { size: 11 }),
                              ),
                            ),
                          ),
                        )
                      : null,
                  ],
        ),
      ),
    ),
    document.body,
  );
}
