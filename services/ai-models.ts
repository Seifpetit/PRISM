import { api } from "@/api/api";
import { mockRequest } from "@/services/mock-client";
import { AI_MODEL_OPTIONS, type AiModelOption, type AiProvider } from "@/types/strategy";

/**
 * Model discovery is requested through our backend so provider API keys never
 * enter the browser. The local catalog keeps the selector useful when the
 * backend or provider key is unavailable during prototype work.
 */
export async function getAiModels(provider: AiProvider): Promise<AiModelOption[]> {
  try {
    const models = await mockRequest(() => api.aiModels(provider), 180);
    return models.length ? models : AI_MODEL_OPTIONS[provider];
  } catch {
    return AI_MODEL_OPTIONS[provider];
  }
}
