import capabilityCatalog from "@/data/product-source-capabilities.json";
import { AI_MODEL_OPTIONS, type AiProvider, type ProductSource } from "@/types/strategy";

type MediaRequirement = {
  source: ProductSource;
  kind: "image" | "document";
  mimeType: string;
  fallbackFormat: string;
};

type CompatibilityIssue = MediaRequirement & { reason: string };

type ProductContextCompatibilityIssue =
  | CompatibilityIssue
  | {
      source: null;
      kind: "contract";
      mimeType: "";
      fallbackFormat: "";
      reason: string;
    };

const catalog = capabilityCatalog as {
  providers: Record<
    AiProvider,
    {
      modelIdPrefixes: string[];
      unsupportedModelIdPrefixes: string[];
      structuredOutputModelIdPrefixes: string[];
      modelInputOverrides: Record<
        string,
        { images: boolean; documents: boolean; structuredOutputs: boolean }
      >;
      imageMimeTypes: string[];
      documentMimeTypes: string[];
    }
  >;
  formatFallbacks: Record<
    string,
    Array<{
      provider: AiProvider;
      model: string;
      standardShortContextUsdPerMTok: { input: number; output: number };
    }>
  >;
};

function mediaRequirements(sources: ProductSource[]): MediaRequirement[] {
  return sources.flatMap((source): MediaRequirement[] => {
    if (source.status !== "ready") return [];
    if (source.type === "video")
      return [{ source, kind: "image" as const, mimeType: "image/jpeg", fallbackFormat: "video" }];
    if (source.type === "image")
      return [
        {
          source,
          kind: "image" as const,
          mimeType: source.mimeType ?? "",
          fallbackFormat: "image",
        },
      ];
    if (source.type === "file")
      return [
        {
          source,
          kind: "document" as const,
          mimeType: source.mimeType ?? "",
          fallbackFormat: source.mimeType ?? "",
        },
      ];
    return [];
  });
}

function modelInputSupport(provider: AiProvider, model: string) {
  const capability = catalog.providers[provider];
  const override = capability.modelInputOverrides[model];
  if (override) return override;
  if (capability.unsupportedModelIdPrefixes.some((prefix) => model.startsWith(prefix))) {
    return { images: false, documents: false, structuredOutputs: false };
  }
  const supportedByFamily = capability.modelIdPrefixes.some((prefix) => model.startsWith(prefix));
  const structuredOutputs = capability.structuredOutputModelIdPrefixes.some((prefix) =>
    model.startsWith(prefix),
  );
  return supportedByFamily ? { images: true, documents: true, structuredOutputs } : null;
}

export function productSourceCompatibilityIssues(
  provider: AiProvider,
  model: string,
  sources: ProductSource[],
): CompatibilityIssue[] {
  const providerCapability = catalog.providers[provider];
  return mediaRequirements(sources).flatMap((requirement) => {
    const inputSupport = modelInputSupport(provider, model);
    if (!inputSupport) {
      return [
        { ...requirement, reason: "This model has no configured product-material input path." },
      ];
    }
    if (requirement.kind === "image" && !inputSupport.images) {
      return [{ ...requirement, reason: "This model does not support image input." }];
    }
    if (requirement.kind === "document" && !inputSupport.documents) {
      return [{ ...requirement, reason: "This model does not support document input." }];
    }
    const supportedMimeTypes =
      requirement.kind === "image"
        ? providerCapability.imageMimeTypes
        : providerCapability.documentMimeTypes;
    if (supportedMimeTypes.includes(requirement.mimeType)) return [];
    return [
      {
        ...requirement,
        reason: `${requirement.kind === "image" ? "Image" : "Document"} format ${requirement.mimeType || "unknown"} is unsupported by this model.`,
      },
    ];
  });
}

export function productContextCompatibilityIssues(
  provider: AiProvider,
  model: string,
  sources: ProductSource[],
): ProductContextCompatibilityIssue[] {
  const sourceIssues = productSourceCompatibilityIssues(provider, model, sources);
  const support = modelInputSupport(provider, model);
  if (support?.structuredOutputs) return sourceIssues;
  return [
    {
      source: null,
      kind: "contract",
      mimeType: "",
      fallbackFormat: "",
      reason:
        "This model does not support the structured output required to build product context.",
    },
    ...sourceIssues,
  ];
}

export function modelSupportsProductContextContract(provider: AiProvider, model: string) {
  return modelInputSupport(provider, model)?.structuredOutputs === true;
}

export function modelSupportsProductSources(
  provider: AiProvider,
  model: string,
  sources: ProductSource[],
) {
  return productContextCompatibilityIssues(provider, model, sources).length === 0;
}

export function firstCompatibleModel(provider: AiProvider, sources: ProductSource[]) {
  return (
    AI_MODEL_OPTIONS[provider].find((option) =>
      modelSupportsProductSources(provider, option.id, sources),
    )?.id ?? null
  );
}

export function leastExpensiveCompatibleModel(
  sources: ProductSource[],
  preferredProvider?: AiProvider,
) {
  const requirements = mediaRequirements(sources);
  if (!requirements.length) return null;

  const compatibleCandidates = requirements
    .map((requirement) => catalog.formatFallbacks[requirement.fallbackFormat] ?? [])
    .reduce((shared, candidates) =>
      shared.filter((candidate) =>
        candidates.some(
          (other) => other.provider === candidate.provider && other.model === candidate.model,
        ),
      ),
    );

  const verifiedCandidates = compatibleCandidates.filter(({ provider, model }) =>
    modelSupportsProductSources(provider, model, sources),
  );
  return (
    verifiedCandidates.find(({ provider }) => provider === preferredProvider) ??
    verifiedCandidates[0] ??
    null
  );
}

export function modelDisplayName(provider: AiProvider, model: string) {
  return AI_MODEL_OPTIONS[provider].find((option) => option.id === model)?.label ?? model;
}

export function unsupportedMaterialLabel(issues: Array<{ source: ProductSource | null }>) {
  const names = [
    ...new Set(issues.flatMap(({ source }) => (source ? [source.filename ?? source.label] : []))),
  ];
  return names.join(", ");
}

export function productContextIncompatibilityMessage(
  provider: AiProvider,
  model: string,
  sources: ProductSource[],
) {
  const issues = productContextCompatibilityIssues(provider, model, sources);
  const contractIssue = issues.find((issue) => issue.kind === "contract");
  if (contractIssue)
    return `${modelDisplayName(provider, model)} cannot build product context because it does not support structured output.`;
  const material = unsupportedMaterialLabel(issues);
  return `${modelDisplayName(provider, model)} cannot use ${material}. Remove the unsupported product material to use this model.`;
}
