"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SkipBack } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { h } from "@/lib/h";
import { EditorFooter, KIND_META, KindIcon, LoadingBody, NoticeBar, copyName, formatTime, useDataItem, useDiscardGuard, useSaveActions, type SaveOutcome } from "./shared";

type Trim = { start: number; end: number };
type DragMode = "start" | "end" | "playhead";

const PEAK_BUCKETS = 480;

/** Peak amplitude per bucket, 0..1, from the file's audio track (a video's too, when the browser can decode it). */
async function decodePeaks(dataUrl: string): Promise<number[] | null> {
  try {
    const buffer = await (await fetch(dataUrl)).arrayBuffer();
    const context = new AudioContext();
    const audio = await context.decodeAudioData(buffer);
    void context.close();
    const channel = audio.getChannelData(0);
    const size = Math.max(1, Math.floor(channel.length / PEAK_BUCKETS));
    const peaks: number[] = [];
    for (let bucket = 0; bucket < PEAK_BUCKETS; bucket += 1) {
      let max = 0;
      const from = bucket * size;
      for (let index = from; index < from + size && index < channel.length; index += 1) max = Math.max(max, Math.abs(channel[index]));
      peaks.push(max);
    }
    const top = Math.max(...peaks, 0.001);
    return peaks.map((peak) => peak / top);
  } catch {
    return null;
  }
}

/** The shared timeline: waveform, the kept range between two handles, and a playhead. */
function Timeline({
  duration,
  peaks,
  trim,
  time,
  accent,
  onTrim,
  onSeek,
}: {
  duration: number;
  peaks: number[] | null;
  trim: Trim;
  time: number;
  accent: string;
  onTrim: (trim: Trim) => void;
  onSeek: (time: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drag = useRef<DragMode | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = trackRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width) return;
    const ratio = window.devicePixelRatio || 1;
    const height = 72;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);
    const muted = getComputedStyle(canvas).getPropertyValue("--text-muted").trim() || "#9da7b4";
    if (!peaks) {
      context.fillStyle = muted;
      context.globalAlpha = 0.35;
      for (let x = 0; x < width; x += 6) context.fillRect(x, height / 2 - 1, 3, 2);
      return;
    }
    const bars = Math.floor(width / 3);
    for (let bar = 0; bar < bars; bar += 1) {
      const peak = peaks[Math.floor((bar / bars) * peaks.length)] ?? 0;
      const barHeight = Math.max(2, peak * (height - 8));
      const seconds = (bar / bars) * duration;
      const inside = seconds >= trim.start && seconds <= trim.end;
      context.globalAlpha = inside ? 0.9 : 0.25;
      context.fillStyle = inside ? accent : muted;
      context.fillRect(bar * 3, (height - barHeight) / 2, 2, barHeight);
    }
  }, [peaks, width, trim, duration, accent]);

  const toX = (seconds: number) => (duration ? (seconds / duration) * width : 0);
  const toTime = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || !duration) return 0;
    return Math.max(0, Math.min(duration, ((clientX - rect.left) / rect.width) * duration));
  };
  const minGap = Math.min(0.25, duration / 10);

  function move(clientX: number) {
    const seconds = toTime(clientX);
    if (drag.current === "start") onTrim({ start: Math.min(seconds, trim.end - minGap), end: trim.end });
    else if (drag.current === "end") onTrim({ start: trim.start, end: Math.max(seconds, trim.start + minGap) });
    else if (drag.current === "playhead") onSeek(seconds);
  }

  function start(event: React.PointerEvent<HTMLElement>, mode: DragMode) {
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = mode;
    move(event.clientX);
  }

  const handle = (mode: "start" | "end") =>
    h(
      "span",
      {
        role: "slider",
        tabIndex: 0,
        "aria-label": mode === "start" ? "Trim start" : "Trim end",
        "aria-valuemin": 0,
        "aria-valuemax": Math.round(duration * 10) / 10,
        "aria-valuenow": Math.round(trim[mode] * 10) / 10,
        "aria-valuetext": formatTime(trim[mode]),
        onPointerDown: (event: React.PointerEvent<HTMLSpanElement>) => start(event, mode),
        onPointerMove: (event: React.PointerEvent<HTMLSpanElement>) => drag.current && move(event.clientX),
        onPointerUp: () => (drag.current = null),
        onKeyDown: (event: React.KeyboardEvent<HTMLSpanElement>) => {
          const step = event.shiftKey ? 1 : 0.1;
          const delta = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
          if (!delta) return;
          event.preventDefault();
          onTrim(
            mode === "start"
              ? { start: Math.max(0, Math.min(trim.end - minGap, trim.start + delta)), end: trim.end }
              : { start: trim.start, end: Math.min(duration, Math.max(trim.start + minGap, trim.end + delta)) },
          );
        },
        className: "absolute top-0 z-[2] grid h-full w-3 -translate-x-1/2 cursor-ew-resize place-items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
        style: { left: toX(trim[mode]), background: accent },
      },
      h("span", { className: "h-5 w-0.5 rounded-full bg-white/80" }),
    );

  return h(
    "div",
    { className: "shrink-0" },
    h(
      "div",
      {
        ref: trackRef,
        onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => start(event, "playhead"),
        onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => drag.current && move(event.clientX),
        onPointerUp: () => (drag.current = null),
        className: "relative h-[72px] cursor-pointer touch-none select-none rounded-lg border border-[#DDE0E4]",
        style: { background: "var(--bg-input)" },
      },
      h("canvas", { ref: canvasRef, className: "absolute inset-0 h-full w-full", "aria-hidden": true }),
      h("span", {
        className: "pointer-events-none absolute inset-y-0 rounded-md",
        style: { left: toX(trim.start), width: Math.max(0, toX(trim.end) - toX(trim.start)), boxShadow: `inset 0 0 0 1.5px ${accent}`, background: `color-mix(in srgb, ${accent} 8%, transparent)` },
      }),
      handle("start"),
      handle("end"),
      h("span", { className: "pointer-events-none absolute -top-1 z-[3] h-[calc(100%+8px)] w-0.5 -translate-x-1/2 rounded-full bg-ink", style: { left: toX(time) } }),
    ),
    h(
      "div",
      { className: "mt-1.5 flex justify-between font-mono text-[10px] text-muted" },
      ...[0, 0.25, 0.5, 0.75, 1].map((fraction) => h("span", { key: fraction }, formatTime(duration * fraction))),
    ),
  );
}

const audioGraphs = new WeakMap<HTMLMediaElement, { context: AudioContext; analyser: AnalyserNode }>();

/** Live frequency bars while audio plays — the audio viewport. */
function Visualizer({ media, playing, accent }: { media: HTMLMediaElement | null; playing: boolean; accent: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!media) return;
    let graph = audioGraphs.get(media);
    if (!graph) {
      try {
        const context = new AudioContext();
        const source = context.createMediaElementSource(media);
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.72;
        source.connect(analyser);
        analyser.connect(context.destination);
        graph = { context, analyser };
        audioGraphs.set(media, graph);
      } catch {
        return;
      }
    }
    analyserRef.current = graph.analyser;
    contextRef.current = graph.context;
    const current = graph;
    return () => {
      analyserRef.current = null;
      contextRef.current = null;
      // An element can be wired to only one source node, ever: keep the graph while the element lives.
      if (!media.isConnected) {
        void current.context.close();
        audioGraphs.delete(media);
      }
    };
  }, [media]);

  useEffect(() => {
    if (playing) void contextRef.current?.resume();
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const levels = new Float32Array(48);
    const data = new Uint8Array(512);
    // Bars follow a log frequency scale (~90 Hz to ~18 kHz), the way hearing does, so a voice or bass line
    // spreads across the display instead of piling into the first few bars.
    const binFor = (bar: number) => Math.min(data.length - 1, Math.round(2 * Math.pow(400 / 2, bar / (levels.length - 1))));
    const draw = () => {
      const context = canvas.getContext("2d");
      const { clientWidth: width, clientHeight: height } = canvas;
      if (!context || !width) return;
      const ratio = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const analyser = analyserRef.current;
      if (analyser && playing) analyser.getByteFrequencyData(data);
      const bars = levels.length;
      const gap = 5;
      const barWidth = (width - gap * (bars - 1)) / bars;
      for (let bar = 0; bar < bars; bar += 1) {
        const target = playing && analyser ? data[binFor(bar)] / 255 : 0.06;
        levels[bar] += (target - levels[bar]) * (playing ? 0.35 : 0.08);
        const barHeight = Math.max(4, levels[bar] * (height - 24));
        const x = bar * (barWidth + gap);
        context.fillStyle = accent;
        context.globalAlpha = 0.35 + levels[bar] * 0.65;
        context.beginPath();
        context.roundRect(x, (height - barHeight) / 2, barWidth, barHeight, Math.min(4, barWidth / 2));
        context.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [playing, accent]);

  return h("canvas", { ref: canvasRef, className: "h-full w-full", "aria-hidden": true });
}

/** Audio and video: one viewport, one timeline. A trim keeps an in and out point; the file itself isn't re-encoded. */
export function MediaEditorModal({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: (outcome: SaveOutcome) => void }) {
  const { item, setItem, error } = useDataItem(id);
  const [media, setMedia] = useState<HTMLMediaElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [trim, setTrim] = useState<Trim | null>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const kind = item?.kind === "audio" ? "audio" : "video";
  const accent = KIND_META[kind].accent;

  useEffect(() => {
    if (!item?.dataUrl) return;
    let active = true;
    void decodePeaks(item.dataUrl).then((result) => active && setPeaks(result));
    return () => {
      active = false;
    };
  }, [item?.dataUrl]);

  useEffect(() => {
    if (!media) return;
    const onTime = () => {
      setTime(media.currentTime);
      if (trim && media.currentTime >= trim.end) {
        media.pause();
        media.currentTime = trim.start;
      }
    };
    const onMeta = () => {
      const length = Number.isFinite(media.duration) ? media.duration : 0;
      setDuration(length);
      setTrim((current) => current ?? (item?.trim ? { start: Math.min(item.trim.start, length), end: Math.min(item.trim.end, length) } : { start: 0, end: length }));
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    media.addEventListener("timeupdate", onTime);
    media.addEventListener("loadedmetadata", onMeta);
    media.addEventListener("play", onPlay);
    media.addEventListener("pause", onPause);
    if (media.readyState >= 1) onMeta();
    return () => {
      media.removeEventListener("timeupdate", onTime);
      media.removeEventListener("loadedmetadata", onMeta);
      media.removeEventListener("play", onPlay);
      media.removeEventListener("pause", onPause);
    };
  }, [media, trim, item?.trim]);

  const initial = item?.trim ?? (duration ? { start: 0, end: duration } : null);
  const dirty = Boolean(trim && initial && (Math.abs(trim.start - initial.start) > 0.05 || Math.abs(trim.end - initial.end) > 0.05));

  function togglePlay() {
    if (!media || !trim) return;
    if (playing) return media.pause();
    if (media.currentTime < trim.start || media.currentTime >= trim.end - 0.05) media.currentTime = trim.start;
    void media.play();
  }

  function seek(seconds: number) {
    if (!media) return;
    media.currentTime = seconds;
    setTime(seconds);
  }

  const { busy, error: saveError, save, saveCopy } = useSaveActions({
    item,
    build: () => (trim ? { trim: { start: trim.start, end: trim.end } } : null),
    onSaved: (outcome) => {
      if (outcome.kind === "saved") {
        setItem(outcome.item);
        setStatus("Trim saved");
      } else setStatus(`Saved a copy: ${outcome.item.filename ?? outcome.item.label}`);
      onSaved(outcome);
    },
  });
  const { requestClose, dialog } = useDiscardGuard(dirty, onClose);

  const control = "inline-flex h-8 items-center gap-1.5 rounded-md border border-[#DDE0E4] px-2.5 text-[11px] font-semibold text-ink hover:bg-[#F6F7F9] disabled:opacity-40";

  const viewport = !item
    ? null
    : item.frames
      ? h(
          "div",
          { className: "grid h-full grid-cols-3 gap-2" },
          ...item.frames.map((frame, index) =>
            h("figure", { key: index, className: "flex min-h-0 flex-col" }, h("img", { src: frame, alt: `Still ${index + 1}`, className: "min-h-0 flex-1 rounded-md object-contain", style: { background: "#0b0d11" } }), h("figcaption", { className: "mt-1 text-center text-[10px] text-muted" }, ["Early", "Middle", "Late"][index] ?? `Still ${index + 1}`)),
          ),
        )
      : kind === "video"
        ? h("video", { ref: setMedia, src: item.dataUrl ?? undefined, playsInline: true, onClick: togglePlay, className: "h-full w-full rounded-lg object-contain", style: { background: "#0b0d11" } })
        : [
            h("audio", { key: "audio", ref: setMedia, src: item.dataUrl ?? undefined, preload: "auto" }),
            h(
              "div",
              { key: "visual", className: "flex h-full flex-col items-center justify-center rounded-lg px-8 py-6", style: { background: `radial-gradient(ellipse at center, color-mix(in srgb, ${accent} 10%, var(--bg-input)), var(--bg-input))` } },
              h(Visualizer, { media, playing, accent }),
            ),
          ];

  return h(
    Modal,
    {
      open: true,
      onClose: requestClose,
      size: "xl",
      fill: true,
      icon: item ? h(KindIcon, { kind, size: 32 }) : null,
      title: item?.filename ?? item?.label ?? "Opening…",
      subtitle: item?.frames ? "Video · stills only" : trim ? `${kind === "audio" ? "Audio" : "Video"} · ${formatTime(duration)} · keeping ${formatTime(trim.start)}–${formatTime(trim.end)}` : undefined,
      footer: h(EditorFooter, {
        item,
        dirty,
        busy,
        error: saveError,
        status,
        defaultCopyName: copyName(item?.filename, item?.label ?? "Clip"),
        onSave: () => void save(),
        onSaveCopy: (filename?: string) => void saveCopy(filename),
        saveLabel: "Save trim",
      }),
    },
    !item
      ? h(LoadingBody, { error })
      : [
          h(NoticeBar, { key: "notice", notice: item.notice }),
          h(
            "div",
            { key: "body", className: "flex min-h-0 flex-1 flex-col gap-3 p-4" },
            h("div", { className: "min-h-0 flex-1" }, viewport),
            item.frames || !trim
              ? null
              : [
                  h(
                    "div",
                    { key: "controls", className: "flex shrink-0 flex-wrap items-center gap-1.5" },
                    h(
                      "button",
                      { type: "button", onClick: togglePlay, "aria-label": playing ? "Pause" : "Play selection", className: "grid h-9 w-9 place-items-center rounded-full text-white", style: { background: accent } },
                      playing ? h(Pause, { size: 15, fill: "currentColor" }) : h(Play, { size: 15, fill: "currentColor", className: "translate-x-px" }),
                    ),
                    h("span", { className: "ml-1 min-w-[112px] font-mono text-[11px] text-ink" }, `${formatTime(time)} / ${formatTime(duration)}`),
                    h("button", { type: "button", onClick: () => seek(trim.start), className: control }, h(SkipBack, { size: 12 }), "To start"),
                    h("button", { type: "button", onClick: () => setTrim({ start: Math.min(time, trim.end - 0.25), end: trim.end }), className: control }, "Set in here"),
                    h("button", { type: "button", onClick: () => setTrim({ start: trim.start, end: Math.max(time, trim.start + 0.25) }), className: control }, "Set out here"),
                    h("button", { type: "button", onClick: () => setTrim({ start: 0, end: duration }), disabled: trim.start === 0 && trim.end === duration, className: control }, h(RotateCcw, { size: 12 }), "Full length"),
                    h("span", { className: "ml-auto text-[11px] text-muted" }, `Selection ${formatTime(trim.end - trim.start)}`),
                  ),
                  h(Timeline, { key: "timeline", duration, peaks, trim, time, accent, onTrim: (next: Trim) => { setTrim(next); setStatus(null); }, onSeek: seek }),
                ],
          ),
          h("span", { key: "dialog" }, dialog),
        ],
  );
}
