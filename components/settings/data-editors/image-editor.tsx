"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { h } from "@/lib/h";
import { EditorFooter, KindIcon, LoadingBody, NoticeBar, copyName, useDataItem, useDiscardGuard, useSaveActions, type SaveOutcome } from "./shared";

type Rect = { x: number; y: number; w: number; h: number };
type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const RATIOS = [
  { id: "free", label: "Free", value: null },
  { id: "original", label: "Original", value: "original" },
  { id: "1:1", label: "1:1", value: 1 },
  { id: "4:5", label: "4:5", value: 4 / 5 },
  { id: "16:9", label: "16:9", value: 16 / 9 },
  { id: "9:16", label: "9:16", value: 9 / 16 },
] as const;

const MIN = 16;
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const HANDLE_POSITION: Record<Handle, string> = {
  nw: "-left-1.5 -top-1.5 cursor-nwse-resize",
  n: "left-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize",
  ne: "-right-1.5 -top-1.5 cursor-nesw-resize",
  e: "-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize",
  se: "-right-1.5 -bottom-1.5 cursor-nwse-resize",
  s: "left-1/2 -bottom-1.5 -translate-x-1/2 cursor-ns-resize",
  sw: "-left-1.5 -bottom-1.5 cursor-nesw-resize",
  w: "-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize",
};

function centeredRect(width: number, height: number, ratio: number): Rect {
  let w = width;
  let hgt = w / ratio;
  if (hgt > height) {
    hgt = height;
    w = hgt * ratio;
  }
  return { x: (width - w) / 2, y: (height - hgt) / 2, w, h: hgt };
}

/** Images: crop with a draggable box, free or to a fixed aspect ratio. */
export function ImageEditorModal({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: (outcome: SaveOutcome) => void }) {
  const { item, setItem, error } = useDataItem(id);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<Rect | null>(null);
  const [ratioId, setRatioId] = useState<(typeof RATIOS)[number]["id"]>("free");
  const [status, setStatus] = useState<string | null>(null);
  const drag = useRef<{ mode: Handle | "move"; startX: number; startY: number; start: Rect } | null>(null);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setStage({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, [item]);

  const ratio = (() => {
    const option = RATIOS.find((entry) => entry.id === ratioId)?.value ?? null;
    if (option === "original") return natural ? natural.w / natural.h : null;
    return option;
  })();

  const scale = natural && stage.w ? Math.min(stage.w / natural.w, stage.h / natural.h, 1.6) : 0;
  const shown = natural ? { w: natural.w * scale, h: natural.h * scale } : { w: 0, h: 0 };
  const offset = { x: (stage.w - shown.w) / 2, y: (stage.h - shown.h) / 2 };
  const dirty = Boolean(natural && crop && (Math.round(crop.x) !== 0 || Math.round(crop.y) !== 0 || Math.round(crop.w) !== natural.w || Math.round(crop.h) !== natural.h));

  function pickRatio(nextId: (typeof RATIOS)[number]["id"]) {
    setRatioId(nextId);
    if (!natural) return;
    const option = RATIOS.find((entry) => entry.id === nextId)?.value ?? null;
    const value = option === "original" ? natural.w / natural.h : option;
    setCrop(value ? centeredRect(natural.w, natural.h, value) : { x: 0, y: 0, w: natural.w, h: natural.h });
    setStatus(null);
  }

  function onPointerDown(event: React.PointerEvent<HTMLElement>, mode: Handle | "move") {
    if (!crop) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = { mode, startX: event.clientX, startY: event.clientY, start: crop };
  }

  function onPointerMove(event: React.PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || !natural || !scale) return;
    const dx = (event.clientX - current.startX) / scale;
    const dy = (event.clientY - current.startY) / scale;
    const s = current.start;
    if (current.mode === "move") {
      setCrop({ ...s, x: Math.max(0, Math.min(natural.w - s.w, s.x + dx)), y: Math.max(0, Math.min(natural.h - s.h, s.y + dy)) });
      return;
    }
    const mode = current.mode;
    let left = s.x;
    let top = s.y;
    let right = s.x + s.w;
    let bottom = s.y + s.h;
    if (mode.includes("w")) left = Math.max(0, Math.min(right - MIN, s.x + dx));
    if (mode.includes("e")) right = Math.min(natural.w, Math.max(left + MIN, s.x + s.w + dx));
    if (mode.includes("n")) top = Math.max(0, Math.min(bottom - MIN, s.y + dy));
    if (mode.includes("s")) bottom = Math.min(natural.h, Math.max(top + MIN, s.y + s.h + dy));
    let next = { x: left, y: top, w: right - left, h: bottom - top };
    if (ratio) {
      // Locked ratio: width leads, height follows, anchored at the opposite corner, kept inside the image.
      let w = next.w;
      let hgt = w / ratio;
      const maxH = mode.includes("n") ? s.y + s.h : natural.h - s.y;
      if (hgt > maxH) {
        hgt = maxH;
        w = hgt * ratio;
      }
      const x = mode.includes("w") ? s.x + s.w - w : s.x;
      const y = mode.includes("n") ? s.y + s.h - hgt : s.y;
      next = { x: Math.max(0, x), y: Math.max(0, y), w, h: hgt };
    }
    setCrop(next);
    setStatus(null);
  }

  function renderCrop(): string | null {
    const image = imageRef.current;
    if (!image || !crop || !item) return null;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(crop.w);
    canvas.height = Math.round(crop.h);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
    const mime = ["image/png", "image/jpeg", "image/webp"].includes(item.mimeType ?? "") ? (item.mimeType as string) : (/^data:(image\/[a-z+]+)/.exec(item.dataUrl ?? "")?.[1] ?? "image/png");
    return canvas.toDataURL(["image/png", "image/jpeg", "image/webp"].includes(mime) ? mime : "image/png", 0.92);
  }

  const { busy, error: saveError, save, saveCopy } = useSaveActions({
    item,
    build: () => {
      const dataUrl = renderCrop();
      return dataUrl ? { dataUrl } : null;
    },
    onSaved: (outcome) => {
      if (outcome.kind === "saved") {
        setItem(outcome.item);
        setNatural(null);
        setCrop(null);
        setStatus("Saved");
      } else setStatus(`Saved a copy: ${outcome.item.filename ?? outcome.item.label}`);
      onSaved(outcome);
    },
  });
  const { requestClose, dialog } = useDiscardGuard(dirty, onClose);

  const chip = (active: boolean) =>
    `h-8 rounded-full border px-3 text-[11px] font-semibold ${active ? "border-ink bg-ink text-white" : "border-[#DDE0E4] text-muted hover:text-ink"}`;

  return h(
    Modal,
    {
      open: true,
      onClose: requestClose,
      size: "xl",
      fill: true,
      icon: h(KindIcon, { kind: "image", size: 32 }),
      title: item?.filename ?? item?.label ?? "Opening…",
      subtitle: natural ? `${natural.w} × ${natural.h} px${crop ? ` → crop ${Math.round(crop.w)} × ${Math.round(crop.h)} px` : ""}` : undefined,
      footer: h(EditorFooter, {
        item,
        dirty,
        busy,
        error: saveError,
        status,
        defaultCopyName: copyName(item?.filename, item?.label ?? "Image"),
        onSave: () => void save(),
        onSaveCopy: (filename?: string) => void saveCopy(filename),
        saveLabel: "Save crop",
      }),
    },
    !item?.dataUrl
      ? h(LoadingBody, { error })
      : [
          h(NoticeBar, { key: "notice", notice: item.notice }),
          h(
            "div",
            { key: "tools", className: "flex shrink-0 flex-wrap items-center gap-1.5 px-4 pt-3" },
            h("span", { className: "mr-1 text-[11px] font-semibold text-muted" }, "Crop"),
            ...RATIOS.map((entry) => h("button", { key: entry.id, type: "button", "aria-pressed": ratioId === entry.id, onClick: () => pickRatio(entry.id), className: chip(ratioId === entry.id) }, entry.label)),
            h(
              "button",
              { type: "button", onClick: () => pickRatio("free"), disabled: !dirty, className: "ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold text-muted hover:text-ink disabled:opacity-40" },
              h(RotateCcw, { size: 13 }),
              "Reset",
            ),
          ),
          h(
            "div",
            {
              key: "stage",
              ref: stageRef,
              className: "relative m-4 min-h-0 flex-1 select-none overflow-hidden rounded-lg",
              style: { background: "repeating-conic-gradient(var(--bg-input) 0% 25%, var(--bg-elevated) 0% 50%) 50% / 18px 18px" },
            },
            h("img", {
              ref: imageRef,
              src: item.dataUrl,
              alt: item.label,
              draggable: false,
              onLoad: (event: React.SyntheticEvent<HTMLImageElement>) => {
                const image = event.currentTarget;
                setNatural({ w: image.naturalWidth, h: image.naturalHeight });
                setCrop({ x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight });
              },
              className: "pointer-events-none absolute max-w-none",
              style: natural ? { left: offset.x, top: offset.y, width: shown.w, height: shown.h } : { opacity: 0 },
            }),
            natural && crop && scale
              ? h(
                  "div",
                  {
                    role: "group",
                    "aria-label": "Crop area. Drag to move, drag a handle to resize.",
                    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => onPointerDown(event, "move"),
                    onPointerMove,
                    onPointerUp: () => (drag.current = null),
                    className: "absolute cursor-move border-2 border-white",
                    style: {
                      left: offset.x + crop.x * scale,
                      top: offset.y + crop.y * scale,
                      width: crop.w * scale,
                      height: crop.h * scale,
                      boxShadow: "0 0 0 9999px rgba(10,12,16,.58)",
                    },
                  },
                  h("span", { className: "pointer-events-none absolute inset-0", style: { backgroundImage: "linear-gradient(to right, transparent 33.1%, rgba(255,255,255,.45) 33.3%, transparent 33.5%, transparent 66.5%, rgba(255,255,255,.45) 66.7%, transparent 66.9%), linear-gradient(to bottom, transparent 33.1%, rgba(255,255,255,.45) 33.3%, transparent 33.5%, transparent 66.5%, rgba(255,255,255,.45) 66.7%, transparent 66.9%)" } }),
                  ...(ratio ? (["nw", "ne", "se", "sw"] as Handle[]) : HANDLES).map((handle) =>
                    h("span", {
                      key: handle,
                      onPointerDown: (event: React.PointerEvent<HTMLSpanElement>) => onPointerDown(event, handle),
                      onPointerMove,
                      onPointerUp: () => (drag.current = null),
                      className: `absolute h-3 w-3 rounded-sm border border-[#15171A]/40 bg-white shadow ${HANDLE_POSITION[handle]}`,
                    }),
                  ),
                )
              : null,
          ),
          h("span", { key: "dialog" }, dialog),
        ],
  );
}
