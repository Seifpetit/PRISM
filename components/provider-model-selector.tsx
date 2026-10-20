"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ExternalLink, LoaderCircle, Lock } from "lucide-react";

import { AI_PROVIDER_META } from "@/data/ai-providers";
import { h } from "@/lib/h";

import {
  firstCompatibleModel,
  leastExpensiveCompatibleModel,
  modelSupportsProductContextContract,
  modelSupportsProductSources,
} from "@/lib/product-source-capabilities";

import { getAiModels } from "@/services/ai-models";

import {
  AI_MODEL_OPTIONS,
  AI_PROVIDERS,
  type AiModelOption,
  type AiProvider,
  type ProductSource,
} from "@/types/strategy";

// =============================================================================
// TYPES
// =============================================================================

interface ProviderModelSelectorProps {
  provider: AiProvider;
  model: string;

  onProviderChange: (provider: AiProvider) => void;
  onModelChange: (model: string) => void;

  disabled?: boolean;
  className?: string;

  sources?: ProductSource[];

  onIncompatibleModelAttempt?: (provider: AiProvider, model: string) => void;

  title?: string;
  description?: string;

  mode?: "product-context" | "generation";
  variant?: "default" | "drawer";
}

// =============================================================================
// PROVIDER STYLES
// =============================================================================

const providerHoverClasses: Record<AiProvider, string> = {
  openai: "hover:border-[#10A37F] hover:bg-[#E8F7F2] hover:text-[#10A37F]",

  anthropic: "hover:border-[#D97757] hover:bg-[#FDF0EB] hover:text-[#D97757]",

  deepseek: "hover:border-[#4D6BFE] hover:bg-[#EDF1FF] hover:text-[#4D6BFE]",

  gemini: "hover:border-[#4285F4] hover:bg-[#EDF4FF] hover:text-[#4285F4]",

  perplexity: "hover:border-[#20808D] hover:bg-[#E8F6F7] hover:text-[#20808D]",
};

// =============================================================================
// PROVIDER ICON
// =============================================================================

function ProviderIcon({ provider }: { provider: AiProvider }) {
  const [failed, setFailed] = useState(false);

  const meta = AI_PROVIDER_META[provider];

  return failed
    ? h(
        "span",
        {
          className: "grid h-4 w-4 place-items-center rounded-full text-[8px] font-bold text-white",

          style: {
            backgroundColor: meta.accent,
          },

          "aria-hidden": true,
        },

        meta.shortLabel.slice(0, 1),
      )
    : h(
        "span",
        {
          className: "grid h-4 w-4 place-items-center rounded-full",

          style: {
            backgroundColor: meta.soft,
          },

          "aria-hidden": true,
        },

        h("img", {
          src: meta.iconUrl,
          alt: "",
          className: "h-3.5 w-3.5",
          loading: "lazy",
          referrerPolicy: "no-referrer",

          onError: () => setFailed(true),
        }),
      );
}

// =============================================================================
// PROVIDER SELECTOR
// =============================================================================

interface ProviderSelectorProps {
  provider: AiProvider;

  disabled: boolean;

  mode: "product-context" | "generation";

  sources: ProductSource[];

  onProviderChange: (provider: AiProvider) => void;

  onIncompatibleModelAttempt?: (provider: AiProvider, model: string) => void;
}

/**
 * Shared provider icon row used by every AI generation surface.
 */
export function ProviderSelector({
  provider,
  disabled,
  mode,
  sources,
  onProviderChange,
  onIncompatibleModelAttempt,
}: ProviderSelectorProps) {
  const compatibleModelForProvider = (targetProvider: AiProvider) => {
    if (mode === "generation") {
      return targetProvider === "perplexity"
        ? null
        : (AI_MODEL_OPTIONS[targetProvider][0]?.id ?? null);
    }

    const preferredFallback = leastExpensiveCompatibleModel(sources, targetProvider);

    return preferredFallback?.provider === targetProvider
      ? preferredFallback.model
      : firstCompatibleModel(targetProvider, sources);
  };

  return h(
    "div",
    {
      className: "mt-3 flex flex-wrap gap-1.5",
    },

    ...AI_PROVIDERS.map((candidate) => {
      const candidateMeta = AI_PROVIDER_META[candidate];

      const selected = candidate === provider;

      const providerFrozen = candidate === "perplexity";

      const compatibleModel = compatibleModelForProvider(candidate);

      const unavailableForMaterial = !compatibleModel;

      const unavailable = providerFrozen || unavailableForMaterial;

      const notify = () =>
        onIncompatibleModelAttempt?.(
          candidate,

          AI_MODEL_OPTIONS[candidate][0]?.id ?? "",
        );

      return h(
        "span",
        {
          key: candidate,

          className: "relative inline-flex",

          onMouseEnter: unavailableForMaterial ? notify : undefined,

          onClick: unavailableForMaterial ? notify : undefined,
        },

        h(
          "button",
          {
            type: "button",

            disabled: disabled || unavailable,

            onClick: unavailable ? undefined : () => onProviderChange(candidate),

            "aria-pressed": selected,

            "aria-label": providerFrozen
              ? `${candidateMeta.label} is temporarily unavailable`
              : unavailableForMaterial
                ? `${candidateMeta.label} cannot use the current product material`
                : `Use ${candidateMeta.label}`,

            title: providerFrozen
              ? "Temporarily unavailable"
              : unavailableForMaterial
                ? "Unavailable for current product material"
                : candidateMeta.label,

            style:
              selected && !unavailable
                ? {
                    borderColor: candidateMeta.accent,

                    backgroundColor: candidateMeta.soft,

                    color: candidateMeta.accent,
                  }
                : undefined,

            className: `group flex h-8 max-w-8 items-center overflow-hidden rounded-md border px-2 text-[10px] font-semibold transition-[max-width,border-color,background-color,color] duration-200 focus-visible:max-w-32 focus-visible:gap-1.5 focus-visible:px-2 hover:max-w-32 hover:gap-1.5 hover:px-2 ${
              unavailable
                ? "cursor-not-allowed border-[#E5E7EB] bg-[#F7F8F9] text-[#A8ADB5] opacity-65"
                : selected
                  ? ""
                  : `border-[#DDE0E4] bg-white text-muted ${providerHoverClasses[candidate]}`
            }`,
          },

          h(ProviderIcon, {
            provider: candidate,
          }),

          h(
            "span",
            {
              className:
                "max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,margin,opacity] duration-200 group-hover:ml-0.5 group-hover:max-w-20 group-hover:opacity-100 group-focus-visible:ml-0.5 group-focus-visible:max-w-20 group-focus-visible:opacity-100",
            },

            candidateMeta.shortLabel,
          ),

          unavailable
            ? h(Lock, {
                size: 9,
                className: "ml-0.5 shrink-0",

                "aria-hidden": true,
              })
            : null,
        ),
      );
    }),
  );
}

// =============================================================================
// MODEL SELECTOR
// =============================================================================

interface ModelSelectorProps {
  provider: AiProvider;
  model: string;

  models: AiModelOption[];

  disabled: boolean;
  loading: boolean;

  mode: "product-context" | "generation";

  sources: ProductSource[];

  onModelChange: (model: string) => void;

  onIncompatibleModelAttempt?: (provider: AiProvider, model: string) => void;
}

/**
 * Shared model dropdown used by every AI generation surface.
 */
export function ModelSelector({
  provider,
  model,
  models,
  disabled,
  loading,
  mode,
  sources,
  onModelChange,
  onIncompatibleModelAttempt,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedModel =
    models.find((option) => option.id === model) ??
    AI_MODEL_OPTIONS[provider].find((option) => option.id === model);

  const modelsDisabled = disabled || loading || provider === "perplexity";

  return h(
    "div",
    {
      className: "relative mt-3",
    },

    h(
      "button",
      {
        type: "button",

        disabled: modelsDisabled,

        onClick: () => setOpen((current) => !current),

        "aria-haspopup": "listbox",

        "aria-expanded": open,

        "aria-controls": "generation-model-options",

        className:
          "flex h-9 w-full items-center justify-between rounded-md border border-[#DDE0E4] bg-white px-2.5 text-left text-[10px] font-medium text-ink hover:border-lineage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage/35 disabled:cursor-not-allowed disabled:opacity-60",
      },

      h(
        "span",
        {
          className: "truncate",
        },

        selectedModel ? `${selectedModel.label} / ${selectedModel.tier}` : model,
      ),

      loading
        ? h(LoaderCircle, {
            size: 13,

            className: "shrink-0 animate-spin text-lineage motion-reduce:animate-none",

            "aria-hidden": true,
          })
        : h(ChevronDown, {
            size: 13,

            className: `shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`,

            "aria-hidden": true,
          }),
    ),

    open && !modelsDisabled
      ? h(
          "div",
          {
            id: "generation-model-options",

            role: "listbox",

            "aria-label": "Select AI model",

            className:
              "absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-[#DDE0E4] bg-white p-1 shadow-[0_12px_30px_rgba(21,23,26,.14)]",
          },

          ...models.map((option) => {
            const compatible =
              mode !== "product-context" ||
              modelSupportsProductSources(provider, option.id, sources);

            const notify = () => onIncompatibleModelAttempt?.(provider, option.id);

            return h(
              "div",
              {
                key: option.id,

                onMouseEnter: compatible ? undefined : notify,

                onClick: compatible ? undefined : notify,
              },

              h(
                "button",
                {
                  type: "button",

                  role: "option",

                  disabled: !compatible,

                  "aria-selected": option.id === model,

                  "aria-disabled": !compatible,

                  onClick: compatible
                    ? () => {
                        onModelChange(option.id);

                        setOpen(false);
                      }
                    : undefined,

                  className: `flex w-full items-center justify-between rounded px-2 py-2 text-left text-[10px] ${
                    compatible
                      ? "text-ink hover:bg-canvas focus-visible:bg-canvas"
                      : "cursor-not-allowed text-[#9CA3AF]"
                  }`,
                },

                h(
                  "span",
                  {
                    className: "truncate",
                  },

                  `${option.label} / ${option.tier}`,
                ),

                compatible
                  ? null
                  : h(
                      "span",
                      {
                        className: "ml-2 flex shrink-0 items-center gap-1 text-[9px]",
                      },

                      h(Lock, {
                        size: 10,

                        "aria-hidden": true,
                      }),

                      "Unavailable",
                    ),
              ),
            );
          }),
        )
      : null,
  );
}

// =============================================================================
// MAIN SELECTOR
// =============================================================================

export function ProviderModelSelector({
  provider,
  model,

  onProviderChange,
  onModelChange,

  disabled = false,
  className = "",

  sources = [],

  onIncompatibleModelAttempt,

  title = "Generation model",

  description = "Choose a model for this generation.",

  mode = "product-context",

  variant = "default",
}: ProviderModelSelectorProps) {
  const [remoteModels, setRemoteModels] = useState<AiModelOption[]>(AI_MODEL_OPTIONS[provider]);

  const [loading, setLoading] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  // ===========================================================================
  // NETWORK EFFECT
  //
  // IMPORTANT:
  // Model listing depends only on the provider.
  //
  // It must NOT depend on:
  // - sources
  // - model
  // - onModelChange
  // - parent rerenders
  //
  // Otherwise normal UI changes can trigger repeated HTTP requests.
  // ===========================================================================

  useEffect(() => {
    let active = true;

    async function loadModels() {
      setLoading(true);
      setLoadError(null);

      try {
        const nextModels = await getAiModels(provider);

        if (!active) {
          return;
        }

        setRemoteModels(nextModels);
      } catch (error) {
        if (!active) {
          return;
        }

        console.error("[AI MODELS] Failed to load provider models", {
          provider,
          error,
        });

        // Keep the UI usable if the dynamic provider model-list
        // endpoint is temporarily unavailable.
        setRemoteModels(AI_MODEL_OPTIONS[provider]);

        setLoadError(error instanceof Error ? error.message : "Could not load provider models.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadModels();

    return () => {
      active = false;
    };
  }, [provider]);

  // ===========================================================================
  // DERIVED MODEL LIST
  //
  // This is local computation.
  // Changing sources or mode must NOT cause another network request.
  // ===========================================================================

  const models = useMemo(() => {
    if (mode !== "product-context") {
      return remoteModels;
    }

    return remoteModels.filter((option) =>
      modelSupportsProductContextContract(provider, option.id),
    );
  }, [mode, provider, remoteModels]);

  // ===========================================================================
  // MODEL COMPATIBILITY / FALLBACK
  //
  // This effect may react to:
  // - source changes
  // - mode changes
  // - model changes
  //
  // But it performs NO network request.
  // ===========================================================================

  useEffect(() => {
    if (models.length === 0) {
      return;
    }

    const currentModelExists = models.some((option) => option.id === model);

    const currentModelCompatible =
      currentModelExists &&
      (mode !== "product-context" || modelSupportsProductSources(provider, model, sources));

    if (currentModelCompatible) {
      return;
    }

    let compatibleModel: string | undefined;

    if (mode === "product-context") {
      const preferredFallback = leastExpensiveCompatibleModel(sources, provider);

      if (
        preferredFallback?.provider === provider &&
        models.some((option) => option.id === preferredFallback.model)
      ) {
        compatibleModel = preferredFallback.model;
      } else {
        compatibleModel = models.find((option) =>
          modelSupportsProductSources(provider, option.id, sources),
        )?.id;
      }
    } else {
      compatibleModel = models[0]?.id;
    }

    if (compatibleModel && compatibleModel !== model) {
      onModelChange(compatibleModel);
    }
  }, [mode, model, models, onModelChange, provider, sources]);

  const meta = AI_PROVIDER_META[provider];

  return h(
    "section",
    {
      className: `w-full rounded-lg border border-[#DDE0E4] bg-[#FAFAFB] ${
        variant === "drawer" ? "p-3" : "p-3.5"
      } ${className}`,

      "aria-label": "AI provider and model selection",
    },

    h(
      "div",
      {
        className: "flex flex-wrap items-center justify-between gap-2",
      },

      h(
        "div",
        null,

        h(
          "p",
          {
            className: "mono text-[9px] font-semibold uppercase tracking-[.15em] text-muted",
          },

          title,
        ),

        h(
          "p",
          {
            className: "mt-1 text-xs text-muted",
          },

          description,
        ),
      ),

      h(
        "a",
        {
          href: meta.docsUrl,

          target: "_blank",

          rel: "noreferrer",

          className:
            "flex items-center gap-1 text-[10px] font-semibold text-lineage hover:text-ink",
        },

        "Provider docs",

        h(ExternalLink, {
          size: 11,
        }),
      ),
    ),

    h(ProviderSelector, {
      provider,
      disabled,
      mode,
      sources,
      onProviderChange,
      onIncompatibleModelAttempt,
    }),

    h(ModelSelector, {
      provider,
      model,
      models,
      disabled,
      loading,
      mode,
      sources,
      onModelChange,
      onIncompatibleModelAttempt,
    }),

    loadError
      ? h(
          "p",
          {
            className: "mt-2 text-[9px] text-[#B45309]",
          },

          "Live provider model list unavailable. Using the local model catalog.",
        )
      : null,
  );
}
