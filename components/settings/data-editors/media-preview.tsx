"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { api, type StoredProductSource } from "@/api/api";
import { h } from "@/lib/h";
import { KIND_META, type DataKind } from "./shared";

// Card previews for media in the Data library. The list never carries file contents, so the first time a media tile
// comes into view the browser reads the item once, makes a small still (image, video) or waveform (audio), and saves
// it on the item (saveDataItemPreview). Every later load gets it straight from the list.

type Preview = { thumbnail: string | null; peaks: number[] | null; duration: number | null };
type PreviewState = { preview: Preview | null; status: "ready" | "loading" | "none" };

const THUMB_MAX_W = 480;
const THUMB_MAX_H = 320;
const PEAK_BARS = 64;

const madePreviews = new Map<string, Promise<Preview | null>>();

// Reading an item means downloading all of it; two at a time keeps a page of new media from swamping the backend.
let running = 0;
const waiting: Array<() => void> = [];
async function inTurn<T>(run: () => Promise<T>): Promise<T> {
  if (running >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
  running += 1;
  try {
    return await run();
  } finally {
    running -= 1;
    waiting.shift()?.();
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = src;
  });
}

/** A small JPEG of whatever is drawn, sized for a card at 2x. Transparent images get a white ground. */
function still(source: CanvasImageSource, width: number, height: number) {
  if (!width || !height) return null;
  const scale = Math.min(1, THUMB_MAX_W / width, THUMB_MAX_H / height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL("image/jpeg", 0.78);
  } catch {
    return null;
  }
}

function once(target: EventTarget, event: string, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("timeout")), timeoutMs);
    target.addEventListener(event, () => (window.clearTimeout(timer), resolve()), { once: true });
    target.addEventListener("error", () => (window.clearTimeout(timer), reject(new Error("error"))), { once: true });
  });
}

/** A frame about a tenth of the way in (never later than 1.5 s), past any fade from black. */
async function videoStill(dataUrl: string): Promise<Preview | null> {
  const url = URL.createObjectURL(await (await fetch(dataUrl)).blob());
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    const loaded = once(video, "loadeddata", 12_000);
    video.src = url;
    await loaded;
    const duration = Number.isFinite(video.duration) ? video.duration : null;
    const seeked = once(video, "seeked", 8_000);
    video.currentTime = Math.min((duration ?? 0) * 0.1, 1.5) || 0.05;
    await seeked;
    return { thumbnail: still(video, video.videoWidth, video.videoHeight), peaks: null, duration };
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** The loudest point in each of PEAK_BARS slices, scaled so the loudest slice is 1. */
async function audioWaveform(dataUrl: string): Promise<Preview | null> {
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await (await fetch(dataUrl)).arrayBuffer());
    const channel = audio.getChannelData(0);
    const size = Math.max(1, Math.floor(channel.length / PEAK_BARS));
    const peaks: number[] = [];
    for (let bar = 0; bar < PEAK_BARS; bar += 1) {
      let max = 0;
      // Every 8th sample is plenty for a card-sized peak and keeps long files quick.
      for (let index = bar * size; index < (bar + 1) * size && index < channel.length; index += 8) max = Math.max(max, Math.abs(channel[index]));
      peaks.push(max);
    }
    const top = Math.max(...peaks, 0.001);
    return { thumbnail: null, peaks: peaks.map((peak) => Math.round((peak / top) * 1000) / 1000), duration: audio.duration };
  } catch {
    return null;
  } finally {
    void context.close();
  }
}

async function makePreview(source: StoredProductSource): Promise<Preview | null> {
  const item = await api.dataItem({ id: source.id });
  let preview: Preview | null = null;
  if (item.kind === "image" && item.dataUrl) {
    const image = await loadImage(item.dataUrl);
    preview = { thumbnail: still(image, image.naturalWidth, image.naturalHeight), peaks: null, duration: null };
  } else if (item.kind === "video") {
    if (item.dataUrl) preview = await videoStill(item.dataUrl);
    else if (item.frames?.[0]) {
      // An intake video kept only stills: the first one is the card.
      const image = await loadImage(item.frames[0]);
      preview = { thumbnail: still(image, image.naturalWidth, image.naturalHeight), peaks: null, duration: null };
    }
  } else if (item.kind === "audio" && item.dataUrl) {
    preview = await audioWaveform(item.dataUrl);
  }
  if (!preview || (!preview.thumbnail && !preview.peaks)) return null;
  // Saving is only a shortcut for next time; the card shows the preview either way.
  void api.saveDataItemPreview({ id: source.id, ...preview }).catch(() => undefined);
  return preview;
}

function requestPreview(source: StoredProductSource) {
  // Keyed by size too, so an edited item (a crop) gets a fresh preview.
  const key = `${source.id}:${source.sizeBytes ?? ""}`;
  let made = madePreviews.get(key);
  if (!made) {
    made = inTurn(() => makePreview(source)).catch(() => null);
    madePreviews.set(key, made);
  }
  return made;
}

/** The stored preview, or one made as soon as the tile scrolls into view. */
function useMediaPreview(source: StoredProductSource, ref: React.RefObject<HTMLElement | null>): PreviewState {
  const stored = source.thumbnail || source.peaks?.length
    ? { thumbnail: source.thumbnail ?? null, peaks: source.peaks ?? null, duration: source.durationSeconds ?? null }
    : null;
  const [made, setMade] = useState<PreviewState>({ preview: null, status: "loading" });

  useEffect(() => {
    if (stored) return;
    const element = ref.current;
    if (!element) return;
    let active = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void requestPreview(source).then((preview) => {
          if (active) setMade({ preview, status: preview ? "ready" : "none" });
        });
      },
      { rootMargin: "120px" },
    );
    observer.observe(element);
    return () => {
      active = false;
      observer.disconnect();
    };
    // A new preview is needed only when the item itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.id, source.sizeBytes, Boolean(stored)]);

  return stored ? { preview: stored, status: "ready" } : made;
}

/** m:ss: a card shows lengths, not edit points, so no tenths. */
function clock(seconds: number) {
  const whole = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

const tint = (accent: string, percent: number) => `color-mix(in srgb, ${accent} ${percent}%, var(--bg-panel))`;

function Badge({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return h(
    "span",
    { className: `absolute rounded-md bg-black/55 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white backdrop-blur-[2px] ${className}` },
    children,
  );
}

/** An image's or a video's still, filling the top of the card. */
function StillPreview({ source, kind, badge }: { source: StoredProductSource; kind: "image" | "video"; badge: string | null }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { preview, status } = useMediaPreview(source, ref);
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  return h(
    "div",
    {
      ref,
      className: "pointer-events-none relative h-[88px] w-full shrink-0 overflow-hidden rounded-xl",
      style: { background: tint(meta.accent, 14) },
    },
    preview?.thumbnail
      ? h("img", { src: preview.thumbnail, alt: "", draggable: false, className: "h-full w-full object-cover" })
      : h(
          "div",
          { className: `grid h-full w-full place-items-center ${status === "loading" ? "animate-pulse" : ""}`, style: { color: meta.accent } },
          h(Icon, { size: 26, strokeWidth: 1.75, "aria-hidden": true }),
        ),
    kind === "video" && preview?.thumbnail
      ? h(
          "span",
          { className: "absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur-[2px]", "aria-hidden": true },
          h(Play, { size: 14, fill: "currentColor", className: "ml-0.5" }),
        )
      : null,
    badge ? h(Badge, { className: "bottom-1.5 left-1.5" }, badge) : null,
    preview?.duration ? h(Badge, { className: "bottom-1.5 right-1.5 normal-case tabular-nums" }, clock(preview.duration)) : null,
  );
}

// One card plays at a time: starting another stops this one.
let stopPlaying: (() => void) | null = null;

type Player = { audio: HTMLAudioElement; context: AudioContext; analyser: AnalyserNode; url: string; trim: { start: number; end: number } | null };

/** Audio's card: its waveform at rest, and a live frequency visualizer while it plays from the card. */
function AudioPreview({ source, title }: { source: StoredProductSource; title: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerRef = useRef<Player | null>(null);
  const { preview, status } = useMediaPreview(source, ref);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const accent = KIND_META.audio.accent;
  const peaks = preview?.peaks ?? null;
  const duration = preview?.duration ?? null;

  // One function for the card's whole life, so "is the playing card this one?" is a plain comparison.
  const pauseRef = useRef(() => {
    playerRef.current?.audio.pause();
    setPlaying(false);
  });
  const pause = pauseRef.current;

  useEffect(
    () => () => {
      if (stopPlaying === pause) stopPlaying = null;
      const player = playerRef.current;
      if (!player) return;
      player.audio.pause();
      void player.context.close();
      URL.revokeObjectURL(player.url);
    },
    [pause],
  );

  async function player(): Promise<Player | null> {
    if (playerRef.current) return playerRef.current;
    const item = await api.dataItem({ id: source.id });
    if (!item.dataUrl) return null;
    const url = URL.createObjectURL(await (await fetch(item.dataUrl)).blob());
    const audio = new Audio(url);
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.7;
    context.createMediaElementSource(audio).connect(analyser);
    analyser.connect(context.destination);
    const trim = item.trim ?? null;
    audio.addEventListener("timeupdate", () => {
      // A saved trim plays here too: only the kept part.
      if (trim && audio.currentTime >= trim.end) {
        audio.pause();
        audio.currentTime = trim.start;
        setPlaying(false);
      }
      setElapsed(audio.currentTime);
    });
    audio.addEventListener("ended", () => {
      setPlaying(false);
      audio.currentTime = trim?.start ?? 0;
    });
    if (trim) audio.currentTime = trim.start;
    playerRef.current = { audio, context, analyser, url, trim };
    return playerRef.current;
  }

  async function toggle() {
    if (playing) return pause();
    setLoading(true);
    try {
      const current = await player();
      if (!current) return;
      if (stopPlaying && stopPlaying !== pause) stopPlaying();
      stopPlaying = pause;
      await current.context.resume();
      await current.audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  }

  // Bars ease between the waveform (at rest) and the live spectrum (playing), so switching is a motion, not a jump.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const levels = new Float32Array(40);
    const data = new Uint8Array(256);
    const binFor = (bar: number) => Math.min(data.length - 1, Math.round(1 + Math.pow(200, bar / (levels.length - 1))));
    let frame = 0;
    const draw = () => {
      const context = canvas.getContext("2d");
      const { clientWidth: width, clientHeight: height } = canvas;
      if (!context || !width) {
        frame = requestAnimationFrame(draw);
        return;
      }
      const ratio = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const player = playerRef.current;
      const live = playing && player;
      if (live) player.analyser.getByteFrequencyData(data);
      const bars = levels.length;
      const gap = 2;
      const barWidth = Math.max(1.5, (width - gap * (bars - 1)) / bars);
      const span = player?.trim ? player.trim.end - player.trim.start : (duration ?? player?.audio.duration ?? 0);
      const from = player?.trim?.start ?? 0;
      const progress = player && span > 0 ? Math.min(1, Math.max(0, (player.audio.currentTime - from) / span)) : 0;
      let settled = true;
      for (let bar = 0; bar < bars; bar += 1) {
        const waveform = peaks ? peaks[Math.min(peaks.length - 1, Math.floor((bar / bars) * peaks.length))] : 0.12;
        const target = live ? Math.max(0.06, data[binFor(bar)] / 255) : Math.max(0.06, waveform);
        const step = (target - levels[bar]) * (live ? 0.4 : 0.14);
        if (Math.abs(step) > 0.001) settled = false;
        levels[bar] += step;
        const barHeight = Math.max(3, levels[bar] * (height - 6));
        const x = bar * (barWidth + gap);
        context.fillStyle = accent;
        context.globalAlpha = live ? 0.45 + levels[bar] * 0.55 : x / width < progress ? 1 : 0.5;
        context.beginPath();
        context.roundRect(x, (height - barHeight) / 2, barWidth, barHeight, Math.min(2, barWidth / 2));
        context.fill();
      }
      // At rest and settled, there is nothing to animate.
      if (live || !settled) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [playing, peaks, duration, accent]);

  const Icon = playing ? Pause : Play;
  const timeLabel = playing || elapsed > 0 ? clock(elapsed) : duration ? clock(duration) : null;
  return h(
    "div",
    {
      ref,
      className: "pointer-events-none relative flex h-[88px] w-full shrink-0 items-center gap-2.5 overflow-hidden rounded-xl pl-2.5 pr-3",
      style: { background: tint(accent, 12) },
    },
    h(
      "button",
      {
        type: "button",
        onClick: () => void toggle(),
        disabled: loading || status === "none",
        "aria-label": `${playing ? "Pause" : "Play"} ${title}`,
        "aria-pressed": playing,
        className:
          "pointer-events-auto relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full text-white shadow-[0_4px_10px_rgba(0,0,0,.18)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage focus-visible:ring-offset-2 disabled:opacity-50 motion-reduce:transition-none",
        style: { background: accent },
      },
      h(Icon, { size: 15, fill: "currentColor", className: `${playing ? "" : "ml-0.5"} ${loading ? "animate-pulse" : ""}`, "aria-hidden": true }),
    ),
    h("div", { className: `relative h-[52px] min-w-0 flex-1 ${status === "loading" && !peaks ? "animate-pulse" : ""}` }, h("canvas", { ref: canvasRef, className: "h-full w-full", "aria-hidden": true })),
    timeLabel ? h(Badge, { className: "bottom-1.5 right-1.5 normal-case tabular-nums" }, timeLabel) : null,
  );
}

export const MEDIA_KINDS = new Set<DataKind>(["image", "video", "audio"]);

/** The top of a media item's card: a still for images and video, a playable visualizer for audio. */
export function MediaPreview({ source, kind, badge, title }: { source: StoredProductSource; kind: DataKind; badge: string | null; title: string }) {
  if (kind === "audio") return h(AudioPreview, { source, title });
  if (kind === "image" || kind === "video") return h(StillPreview, { source, kind, badge });
  return null;
}
