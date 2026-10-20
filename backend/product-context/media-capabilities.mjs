import { readFileSync } from "node:fs";

const catalogUrl = new URL("../../data/product-source-capabilities.json", import.meta.url);
const catalog = JSON.parse(readFileSync(catalogUrl, "utf8"));

function modelInputSupport(capabilities, model) {
  const override = capabilities.modelInputOverrides?.[model];
  if (override) return override;
  if (capabilities.unsupportedModelIdPrefixes?.some((prefix) => model?.startsWith(prefix))) {
    return { images: false, documents: false, structuredOutputs: false };
  }
  const supportedByFamily = capabilities.modelIdPrefixes?.some((prefix) =>
    model?.startsWith(prefix),
  );
  const structuredOutputs = capabilities.structuredOutputModelIdPrefixes?.some((prefix) =>
    model?.startsWith(prefix),
  );
  return supportedByFamily ? { images: true, documents: true, structuredOutputs } : null;
}

export function supportsProductContextContract(provider, model) {
  const capabilities = catalog.providers[provider];
  return modelInputSupport(capabilities, model)?.structuredOutputs === true;
}

export function unsupportedMediaInputs(provider, model, mediaInputs) {
  const capabilities = catalog.providers[provider];
  if (!capabilities) return mediaInputs;
  const inputSupport = modelInputSupport(capabilities, model);
  return mediaInputs.filter((input) => {
    if (!inputSupport) return true;
    if (input.kind === "image" && !inputSupport.images) return true;
    if (input.kind === "document" && !inputSupport.documents) return true;
    if (input.kind === "image") return !capabilities.imageMimeTypes.includes(input.mimeType);
    if (input.kind === "document") return !capabilities.documentMimeTypes.includes(input.mimeType);
    return true;
  });
}
