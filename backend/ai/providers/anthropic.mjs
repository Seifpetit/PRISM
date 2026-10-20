import { jsonHeaders, commonChatOptions, messageText, requestJson } from "./http.mjs";
import { modelOption } from "./model-metadata.mjs";

export const name = "anthropic";
export const apiKeyEnv = "ANTHROPIC_API_KEY";
export const defaultModel = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

const apiBaseUrl = () => process.env.ANTHROPIC_API_BASE_URL ?? "https://api.anthropic.com/v1";

function anthropicContent(content) {
  if (!Array.isArray(content)) return messageText({ content });
  return content.map((part) => {
    if (part.type === "input_text") return { type: "text", text: part.text };
    if (part.type === "product_document") {
      return {
        type: "document",
        source: { type: "base64", media_type: part.mimeType, data: part.data },
      };
    }
    if (part.type === "product_image") {
      return {
        type: "image",
        source: { type: "base64", media_type: part.mimeType, data: part.data },
      };
    }
    return { type: "text", text: JSON.stringify(part) };
  });
}

export async function call({
  apiKey,
  model,
  messages,
  system,
  options = {},
  outputSchema,
  signal,
}) {
  const payload = await requestJson({
    url: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com/v1/messages",
    init: {
      method: "POST",
      headers: jsonHeaders({
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      }),
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? 1024,
        ...(system ? { system } : {}),
        messages: messages
          .filter((message) => message.role !== "system")
          .map((message) => ({ role: message.role, content: anthropicContent(message.content) })),
        ...commonChatOptions(options),
      }),
      signal,
    },
    provider: name,
  });

  return {
    text:
      payload.content
        ?.filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("\n") ?? "",
    raw: payload,
    metadata: {
      inputTokens: payload.usage?.input_tokens ?? null,
      outputTokens: payload.usage?.output_tokens ?? null,
      providerRequestId: payload.id ?? null,
      structuredOutput: {
        requested: Boolean(outputSchema),
        applied: false,
        reason: outputSchema
          ? "provider_native_schema_not_configured"
          : "no_output_schema_requested",
      },
    },
  };
}

export async function listModels({ apiKey, signal }) {
  const payload = await requestJson({
    url: process.env.ANTHROPIC_MODELS_URL ?? `${apiBaseUrl()}/models?limit=1000`,
    init: {
      method: "GET",
      headers: jsonHeaders({ "anthropic-version": "2023-06-01", "x-api-key": apiKey }),
      signal,
    },
    provider: name,
  });
  return (payload.data ?? [])
    .filter((model) => model?.id)
    .map((model) => modelOption(model.id, model.display_name ?? model.id));
}
