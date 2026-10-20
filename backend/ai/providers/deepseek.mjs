import { bearerHeaders, messageText, requestJson } from "./http.mjs";
import { modelOption } from "./model-metadata.mjs";

export const name = "deepseek";
export const apiKeyEnv = "DEEPSEEK_API_KEY";
export const defaultModel = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";

const apiBaseUrl = () => process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";

/**
 * DeepSeek V4 exposes an OpenAI-compatible Chat Completions endpoint. Its
 * JSON Output mode guarantees JSON syntax, while our server remains the
 * authority for JSON-schema validation and the single controlled retry.
 *
 * Thinking mode is deliberately not sent here: DeepSeek enables it by default.
 * The canonical caller does not expose provider-specific thinking controls.
 */
export async function call({
  apiKey,
  model,
  messages,
  system,
  options = {},
  outputSchema,
  signal,
}) {
  if (messages.some((message) => Array.isArray(message.content))) {
    throw new TypeError(
      "deepseek: image and document product material is not supported by the DeepSeek API.",
    );
  }
  const canonicalMessages = system ? [{ role: "system", content: system }, ...messages] : messages;
  const payload = await requestJson({
    url: `${apiBaseUrl()}/chat/completions`,
    init: {
      method: "POST",
      headers: bearerHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages: canonicalMessages.map((message) => ({
          role: message.role,
          content: messageText(message),
        })),
        ...(options.maxTokens === undefined ? {} : { max_tokens: options.maxTokens }),
        ...(outputSchema ? { response_format: { type: "json_object" } } : {}),
      }),
      signal,
    },
    provider: name,
  });

  return {
    text: payload.choices?.[0]?.message?.content ?? "",
    raw: payload,
    metadata: {
      inputTokens: payload.usage?.prompt_tokens ?? null,
      outputTokens: payload.usage?.completion_tokens ?? null,
      providerRequestId: payload.id ?? null,
      structuredOutput: {
        requested: Boolean(outputSchema),
        applied: Boolean(outputSchema),
        mode: outputSchema ? "json_object" : null,
        reason: outputSchema ? "server_schema_validation_required" : "no_output_schema_requested",
      },
    },
  };
}

export async function listModels() {
  return [
    modelOption("deepseek-v4-flash", "DeepSeek V4 Flash"),
    modelOption("deepseek-v4-pro", "DeepSeek V4 Pro"),
  ];
}
