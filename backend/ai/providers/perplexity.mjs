import { bearerHeaders, commonChatOptions, messageText, requestJson } from "./http.mjs";
import { modelOption } from "./model-metadata.mjs";
import { nativeJsonSchema, structuredOutputName } from "./structured-output.mjs";

export const name = "perplexity";
export const apiKeyEnv = "PERPLEXITY_API_KEY";
export const defaultModel = process.env.PERPLEXITY_MODEL ?? "sonar";

function responseFormatName(outputSchema) {
  return structuredOutputName(outputSchema).replace(/[^a-zA-Z0-9]/g, "") || "structuredoutput";
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
  const canonicalMessages = system ? [{ role: "system", content: system }, ...messages] : messages;
  const schema = nativeJsonSchema(outputSchema);
  const payload = await requestJson({
    url: process.env.PERPLEXITY_BASE_URL ?? "https://api.perplexity.ai/v1/sonar",
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
        ...commonChatOptions(options),
        ...(schema
          ? {
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: responseFormatName(outputSchema),
                  schema,
                },
              },
            }
          : {}),
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
        applied: Boolean(schema),
        reason: schema ? null : "no_output_schema_requested",
      },
    },
  };
}

export async function listModels({ apiKey, signal }) {
  const payload = await requestJson({
    url: process.env.PERPLEXITY_MODELS_URL ?? "https://api.perplexity.ai/v1/models",
    init: { method: "GET", headers: bearerHeaders(apiKey), signal },
    provider: name,
  });
  return (payload.data ?? [])
    .filter((model) => model?.id)
    .map((model) => modelOption(model.id, model.id));
}
