// Backward-compatible entry point for existing imports.
export {
  AiConfigurationError,
  callAiModel,
  isAiConfigured,
  listAiModels,
  listAiProviders,
  registerAiProvider,
} from "./canonical-caller.mjs";
