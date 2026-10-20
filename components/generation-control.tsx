"use client";

import { ProviderModelSelector } from "@/components/provider-model-selector";
import { PrismAction } from "@/components/prism-action";
import { h } from "@/lib/h";
import type { AiProvider, ProductSource } from "@/types/strategy";

export type GenerationState = "idle" | "generating" | "success" | "error";
export type GenerationOperation =
  | "product_context_building"
  | "product_context_update"
  | "audience_generation"
  | "angle_generation"
  | "creative_type_generation"
  | "execution_generation"
  | "creative_generation";

interface GenerationControlProps {
  actionLabel: string;
  actionClassName?: string;
  disabled?: boolean;
  description: string;
  model: string;
  operation: GenerationOperation;
  onGenerate: () => void;
  onModelChange: (model: string) => void;
  onProviderChange: (provider: AiProvider) => void;
  provider: AiProvider;
  state?: GenerationState;
  title?: string;
  variant?: "default" | "drawer";
  sources?: ProductSource[];
  onIncompatibleModelAttempt?: (provider: AiProvider, model: string) => void;
}

/** Shared configuration surface for every deliberate AI transformation or generation. */
export function GenerationControl({
  actionLabel,
  actionClassName,
  disabled = false,
  description,
  model,
  operation,
  onGenerate,
  onModelChange,
  onProviderChange,
  provider,
  state = "idle",
  title = "Generation model",
  variant = "default",
  sources,
  onIncompatibleModelAttempt,
}: GenerationControlProps) {
  const generating = state === "generating";
  const controlsDisabled = disabled || generating;
  return h(
    "div",
    {
      className: `generation-control w-full ${variant === "drawer" ? "" : ""}`,
      "aria-busy": generating || undefined,
      "data-generation-operation": operation,
    },
    h(ProviderModelSelector, {
      provider,
      model,
      sources,
      disabled: controlsDisabled,
      title,
      description,
      mode: sources ? "product-context" : "generation",
      variant,
      onProviderChange,
      onModelChange,
      onIncompatibleModelAttempt,
    }),
    h(
      "div",
      { className: variant === "drawer" ? "mt-3" : "mt-3" },
      h(
        PrismAction,
        {
          disabled: controlsDisabled,
          className: actionClassName,
          onClick: onGenerate,
          state: generating
            ? "pending"
            : state === "success"
              ? "success"
              : state === "error"
                ? "error"
                : "ready",
          pendingLabel: actionLabel
            .replace(/^Generate /, "Generating ")
            .replace(/^Build /, "Building ")
            .replace(/^Update /, "Updating "),
        },
        actionLabel,
      ),
    ),
  );
}
