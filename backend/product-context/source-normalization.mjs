import { ProductContextDomainError } from "./errors.mjs";

function inspectionEvidence(inspection) {
  return {
    sourceType: "deterministic-url-inspection",
    requestedUrl: inspection.fetch.requestedUrl,
    finalUrl: inspection.fetch.finalUrl,
    classification: inspection.classification,
    listingScope: inspection.listingScope,
    confidence: inspection.confidence,
    signals: inspection.signals,
    candidates: inspection.candidates,
    evidence: inspection.evidence,
    classificationPolicyVersion: inspection.classificationPolicyVersion,
  };
}

function hasTextEvidence(source) {
  return typeof source.value === "string" && source.value.trim().length > 0;
}

function isReady(source) {
  return source?.status === "ready";
}

function sourceDescriptor(source) {
  const { value: _value, previewUrl: _previewUrl, ...descriptor } = source;
  return descriptor;
}

function uploadedAsset(source) {
  if (typeof source?.value !== "string") return null;
  try {
    const asset = JSON.parse(source.value);
    return asset?.version === 1 && typeof asset.kind === "string" ? asset : null;
  } catch {
    return null;
  }
}

function isBase64(value) {
  return typeof value === "string" && value.length > 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function imageData(value) {
  const match =
    typeof value === "string"
      ? /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value)
      : null;
  return match ? { mimeType: match[1].toLowerCase(), data: match[2], dataUrl: value } : null;
}

function mediaInputFor(source) {
  const asset = uploadedAsset(source);
  if (!asset) return null;

  if (source.type === "file" && asset.kind === "document" && isBase64(asset.data)) {
    return {
      kind: "document",
      data: asset.data,
      mimeType: source.mimeType ?? "application/octet-stream",
      filename: source.filename ?? "product-material",
    };
  }

  if (source.type === "image" && asset.kind === "image") {
    const image = imageData(asset.dataUrl);
    return image ? { kind: "image", ...image, filename: source.filename ?? "product-image" } : null;
  }

  if (source.type === "video" && asset.kind === "video_frames" && Array.isArray(asset.frames)) {
    const frames = asset.frames.map(imageData).filter(Boolean).slice(0, 3);
    return frames.length
      ? frames.map((frame, index) => ({
          kind: "image",
          ...frame,
          filename: `${source.filename ?? "product-video"} frame ${index + 1}`,
        }))
      : null;
  }

  return null;
}

async function normalizeUrlSource(source, dependencies) {
  const storedSource = dependencies.getStoredSource?.(source.id);
  const inspection =
    storedSource?.inspection ?? (await dependencies.inspectProductUrl(source.value));

  if (inspection.fetch.status === "UNREACHABLE") {
    dependencies.updateStoredSource?.(source.id, {
      ...storedSource,
      ...source,
      status: "error",
      inspection,
    });
    return { kind: "unreachable", source, inspection };
  }

  if (inspection.classification === "LISTING") {
    return { kind: "listing", source, inspection };
  }

  return {
    kind: inspection.classification === "PRODUCT" ? "product" : "unknown",
    source: {
      ...source,
      status: "ready",
      value: JSON.stringify(inspectionEvidence(inspection)),
    },
    inspection,
  };
}

/**
 * URL sources are converted to deterministic page evidence before synthesis.
 * Unknown pages remain weak evidence; unreachable sources are deliberately
 * excluded so one failed URL cannot block otherwise usable material.
 */
export async function normalizeProductContextSources(inputSources, dependencies) {
  const usableSources = [];
  const mediaInputs = [];
  const listingSources = [];
  const unreachableSources = [];

  for (const source of inputSources) {
    if (!source || !isReady(source)) continue;

    if (source.type === "url") {
      if (!hasTextEvidence(source)) continue;
      const normalized = await normalizeUrlSource(source, dependencies);
      if (normalized.kind === "listing") listingSources.push(normalized);
      else if (normalized.kind === "unreachable") unreachableSources.push(normalized);
      else usableSources.push(normalized.source);
      continue;
    }

    const mediaInput = mediaInputFor(source);
    if (mediaInput) {
      usableSources.push(sourceDescriptor(source));
      mediaInputs.push(...(Array.isArray(mediaInput) ? mediaInput : [mediaInput]));
      continue;
    }

    // This keeps compatibility with future server-side document extraction,
    // where an intake layer supplies plain extracted evidence in value.
    if (hasTextEvidence(source)) usableSources.push(source);
  }

  if (listingSources.length) {
    throw new ProductContextDomainError(
      "URL_REQUIRES_PRODUCT_SELECTION",
      "Select one product from the listing before building product context.",
      { details: { sourceIds: listingSources.map(({ source }) => source.id) } },
    );
  }

  if (!usableSources.length) {
    throw new ProductContextDomainError(
      "PRODUCT_CONTEXT_NO_USABLE_SOURCES",
      "Add usable product material before building product context.",
      {
        details: {
          unreachableSourceIds: unreachableSources.map(({ source }) => source.id),
          message:
            "A URL must be inspectable, and uploads must contain readable document, image, or video evidence.",
        },
      },
    );
  }

  return { usableSources, mediaInputs, unreachableSources };
}
