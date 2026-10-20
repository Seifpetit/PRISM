"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { AI_PROVIDER_META } from "@/data/ai-providers";
import { ProviderModelSelector } from "@/components/provider-model-selector";
import { h } from "@/lib/h";
import { getTypeLabel } from "@/lib/lineage";
import { useAppStore } from "@/store/use-app-store";
import { AI_MODEL_OPTIONS, type StrategyNode } from "@/types/strategy";
import { creativeExplorationDefinition } from "@/modes/creative-exploration/definition";

function modelLabel(provider: keyof typeof AI_MODEL_OPTIONS, model: string) {
  return AI_MODEL_OPTIONS[provider].find((option) => option.id === model)?.label ?? model;
}

/**
 * Canvas-bound action shells. They deliberately compose the established
 * Provider/model selection remains neutral. The Prism satellite itself is the
 * generation action and reflects the store-owned pending state.
 */
export function GenerationSatellites({ selected }: { selected: StrategyNode | null }) {
  const generate = useAppStore((state) => state.generateFromSelected);
  const generateOffers = useAppStore((state) => state.generateOffers);
  const offerGenerationPending = useAppStore((state) => state.offerGenerationPending);
  const generatingParentId = useAppStore((state) => state.generatingParentId);
  const provider = useAppStore((state) => state.aiProvider);
  const model = useAppStore((state) => state.aiModels[state.aiProvider]);
  const setProvider = useAppStore((state) => state.setAiProvider);
  const setModel = useAppStore((state) => state.setAiModel);
  const [open, setOpen] = useState<"model" | "closing" | null>(null);
  const [charging, setCharging] = useState(false);
  const chargeTimer = useRef<number | null>(null);
  const modelCloseTimer = useRef<number | null>(null);
  const prismButtonRef = useRef<HTMLButtonElement | null>(null);
  const magneticMarkRef = useRef<HTMLSpanElement | null>(null);
  const magnetFrame = useRef<number | null>(null);
  const magnet = useRef({ x: 0, y: 0, velocityX: 0, velocityY: 0, targetX: 0, targetY: 0 });
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const explorationNextType = selected?.type === "product" ? "angle" : null;
  const nextType = selected ? explorationNextType : null;
  const generationAvailable =
    creativeExplorationDefinition.enabledGenerationTransitions.includes("product_to_angle") &&
    selected?.type === "product";
  const isGenerating = Boolean(selected && generatingParentId === selected.id);
  const nextLabel = nextType ? getTypeLabel(nextType, true).toLowerCase() : null;
  const actionLabel = nextLabel ? `Explore ${nextLabel}` : null;
  const description =
    selected && nextType ? "Expand this Product Context into 15–20 creative-space angles." : null;
  const selectedModelLabel = useMemo(() => modelLabel(provider, model), [model, provider]);

  useEffect(() => {
    setOpen(null);
    setCharging(false);
    if (chargeTimer.current !== null) {
      window.clearTimeout(chargeTimer.current);
      chargeTimer.current = null;
    }
    if (modelCloseTimer.current !== null) {
      window.clearTimeout(modelCloseTimer.current);
      modelCloseTimer.current = null;
    }
  }, [selected?.id]);

  useEffect(
    () => () => {
      if (chargeTimer.current !== null) window.clearTimeout(chargeTimer.current);
      if (modelCloseTimer.current !== null) window.clearTimeout(modelCloseTimer.current);
      if (magnetFrame.current !== null) window.cancelAnimationFrame(magnetFrame.current);
    },
    [],
  );

  useEffect(() => {
    if (!selected) return;
    function updateAnchor() {
      const canvas = document.querySelector(
        "[data-strategy-graph-root='true']",
      ) as HTMLElement | null;
      if (!canvas) return;
      const canvasRect = canvas.getBoundingClientRect();
      setAnchor({
        // Satellites form a persistent action rail at the lower-left edge of
        // the drawer, independent of the focused node's dimensions.
        left: canvasRect.width - 92,
        top: canvasRect.height - 20,
      });
    }
    const firstFrame = window.requestAnimationFrame(updateAnchor);
    window.addEventListener("resize", updateAnchor);
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.removeEventListener("resize", updateAnchor);
    };
  }, [selected]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeModelPopover();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  if (!selected || !nextType || !actionLabel || !description) return null;

  const pendingLabel = `Exploring ${nextLabel}`;

  function startGeneration() {
    if (!generationAvailable || charging || isGenerating) return;
    setOpen(null);
    releaseLogo();
    setCharging(true);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    chargeTimer.current = window.setTimeout(
      () => {
        chargeTimer.current = null;
        setCharging(false);
        void generate();
      },
      reducedMotion ? 0 : 420,
    );
  }

  function closeModelPopover() {
    if (open !== "model") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setOpen(null);
      return;
    }
    setOpen("closing");
    modelCloseTimer.current = window.setTimeout(() => {
      modelCloseTimer.current = null;
      setOpen(null);
    }, 240);
  }

  function animateMagnet() {
    if (magnetFrame.current !== null) return;
    const tick = () => {
      const state = magnet.current;
      state.velocityX = (state.velocityX + (state.targetX - state.x) * 0.18) * 0.7;
      state.velocityY = (state.velocityY + (state.targetY - state.y) * 0.18) * 0.7;
      state.x += state.velocityX;
      state.y += state.velocityY;
      if (magneticMarkRef.current) {
        magneticMarkRef.current.style.transform = `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0)`;
      }
      if (prismButtonRef.current) {
        const dotX = state.x * 0.34;
        const dotY = state.y * 0.34;
        prismButtonRef.current.style.transform = `translate3d(${dotX.toFixed(2)}px, ${dotY.toFixed(2)}px, 0)`;
      }
      const settled =
        Math.abs(state.targetX - state.x) < 0.02 &&
        Math.abs(state.targetY - state.y) < 0.02 &&
        Math.abs(state.velocityX) < 0.02 &&
        Math.abs(state.velocityY) < 0.02;
      if (settled) {
        state.x = state.targetX;
        state.y = state.targetY;
        magnetFrame.current = null;
        return;
      }
      magnetFrame.current = window.requestAnimationFrame(tick);
    };
    magnetFrame.current = window.requestAnimationFrame(tick);
  }

  function pullLogoTowardPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const deltaX = event.clientX - (rect.left + rect.width / 2);
    const deltaY = event.clientY - (rect.top + rect.height / 2);
    magnet.current.targetX = Math.max(-9, Math.min(9, deltaX * 0.28));
    magnet.current.targetY = Math.max(-9, Math.min(9, deltaY * 0.28));
    animateMagnet();
  }

  function releaseLogo() {
    magnet.current.targetX = 0;
    magnet.current.targetY = 0;
    animateMagnet();
  }

  return h(
    "div",
    {
      className: "generation-satellites pointer-events-none flex flex-col items-center gap-3",
      style: anchor ? { left: anchor.left, top: anchor.top } : { visibility: "hidden" },
      "aria-label": "Generation controls",
    },
    h(
      "div",
      {
        className: `pointer-events-auto relative generation-satellite-model-shell${open === "model" ? " is-open" : open === "closing" ? " is-closing" : ""}`,
      },
      open !== null
        ? h(
            "div",
            {
              className: "generation-satellite-model-popover",
              role: "dialog",
              "aria-label": "Generation model",
            },
            h(
              "button",
              {
                type: "button",
                onClick: closeModelPopover,
                disabled: open === "closing",
                className:
                  "generation-satellite-model-close rounded p-1 text-muted hover:bg-canvas hover:text-ink",
                "aria-label": "Close generation model",
              },
              h(X, { size: 13 }),
            ),
            h(
              "div",
              { className: "generation-satellite-model-content" },
              h(ProviderModelSelector, {
                provider,
                model,
                title: "Generation model",
                description: "Choose the model for this exploration.",
                mode: "generation",
                className: "!border-0 !bg-transparent !p-0",
                onProviderChange: setProvider,
                onModelChange: setModel,
              }),
            ),
          )
        : h(
            "button",
            {
              type: "button",
              onClick: () => {
                if (modelCloseTimer.current !== null) window.clearTimeout(modelCloseTimer.current);
                modelCloseTimer.current = null;
                setOpen("model");
              },
              className: "generation-satellite-trigger generation-satellite-model group",
              "aria-expanded": false,
              "aria-label": `Generation model: ${selectedModelLabel}`,
            },
            h("img", {
              src: AI_PROVIDER_META[provider].iconUrl,
              alt: "",
              className: "h-5 w-5 object-contain",
              referrerPolicy: "no-referrer",
            }),
            h(
              "span",
              { className: "generation-satellite-tooltip" },
              `Model · ${selectedModelLabel}`,
            ),
          ),
    ),
    h(
      "div",
      { className: "pointer-events-auto relative generation-satellite-action-shell" },
      h(
        "button",
        {
          ref: prismButtonRef,
          type: "button",
          onClick: startGeneration,
          onPointerEnter: pullLogoTowardPointer,
          onPointerMove: pullLogoTowardPointer,
          onPointerLeave: releaseLogo,
          onBlur: releaseLogo,
          disabled: !generationAvailable || charging || isGenerating,
          className: `generation-satellite-trigger generation-satellite-prism group${charging ? " is-charging" : ""}${isGenerating ? " is-generating" : ""}`,
          "aria-busy": charging || isGenerating || undefined,
          "aria-label": isGenerating ? pendingLabel : actionLabel,
          title: generationAvailable ? description : "Add the mode prompt and output schema to enable generation.",
        },
        h("span", { className: "generation-satellite-progress-ring", "aria-hidden": true }),
        h(
          "span",
          { ref: magneticMarkRef, className: "generation-satellite-magnetic-mark relative z-10" },
          h("img", {
            src: "/landing/assets/logo.png",
            alt: "",
            className: "generation-satellite-brand-mark h-[52px] w-[68px] object-contain",
            "aria-hidden": true,
          }),
        ),
        h(
          "span",
          { className: "generation-satellite-tooltip" },
          !generationAvailable ? "Generation scaffold pending" : charging ? "Charging Prism" : isGenerating ? pendingLabel : actionLabel,
        ),
      ),
    ),
    selected.type === "product"
      ? h(
          "button",
          {
            type: "button",
            onClick: () => void generateOffers(),
            disabled: offerGenerationPending,
            className:
              "pointer-events-auto grid h-9 w-9 place-items-center rounded-full border border-[#E1E4E8] bg-white text-muted shadow-[0_2px_8px_rgba(21,23,26,.12)] transition-colors hover:border-amber-300 hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-60",
            "aria-label": "Explore offers — the third leg of the concept combo",
            title: "Explore Offers (value-proposition packaging, the third leg of Persona x Angle x Offer)",
          },
          offerGenerationPending
            ? h(Loader2, { size: 15, className: "animate-spin" })
            : h(Sparkles, { size: 15, strokeWidth: 2 }),
        )
      : null,
  );
}
