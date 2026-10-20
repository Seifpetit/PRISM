import { bearerHeaders, messageText, requestJson } from "./http.mjs";

// A second, image-generation provider, registered under its own name ("openai_image") so its usage shape
// (no prompt caching, no reasoning tokens — see ai-cost-tracker/normalizers/openai-image.mjs) never mixes
// with the text provider's. Same OPENAI_API_KEY, a different endpoint and pricing kind.
export const name = "openai_image";
export const apiKeyEnv = "OPENAI_API_KEY";
export const defaultModel = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
// Marks this adapter as outside the AI_MODEL text-default fallback in canonical-caller.mjs: AI_MODEL names a
// text model for the app's default text provider, and would never be a valid image-generation model.
export const kind = "image";

const apiBaseUrl = () => process.env.OPENAI_API_BASE_URL ?? "https://api.openai.com/v1";

function lastUserPrompt(messages) {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  return lastUser ? messageText(lastUser) : "";
}

/**
 * Text-to-image only: this call never sends image input, so it always prices against the model's text-prompt
 * rate for input and its image-output rate for output (ai-cost-tracker/pricing-openai-image.mjs).
 */
export async function call({ apiKey, model, messages, options = {}, signal }) {
  const prompt = lastUserPrompt(messages);
  const payload = await requestJson({
    url: `${apiBaseUrl()}/images/generations`,
    init: {
      method: "POST",
      headers: bearerHeaders(apiKey),
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size: options.imageSize ?? "1024x1024",
        quality: options.imageQuality ?? "low",
      }),
      signal,
    },
    provider: name,
  });

  const image = payload.data?.[0] ?? null;
  return {
    text: "",
    raw: payload,
    imageBase64: image?.b64_json ?? null,
    metadata: {
      inputTokens: payload.usage?.input_tokens ?? null,
      outputTokens: payload.usage?.output_tokens ?? null,
      providerRequestId: null,
    },
  };
}
