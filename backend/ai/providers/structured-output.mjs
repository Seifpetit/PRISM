const schemaKeys = new Set([
  "type",
  "properties",
  "items",
  "required",
  "additionalProperties",
  "enum",
  "description",
]);

function supportedSchema(value) {
  if (Array.isArray(value)) return value.map(supportedSchema);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => schemaKeys.has(key))
      .map(([key, child]) => {
        if (key === "properties" && child && typeof child === "object") {
          return [
            key,
            Object.fromEntries(
              Object.entries(child).map(([name, schema]) => {
                return [name, supportedSchema(schema)];
              }),
            ),
          ];
        }
        return [key, supportedSchema(child)];
      }),
  );
}

export function nativeJsonSchema(outputSchema) {
  return outputSchema ? supportedSchema(outputSchema) : null;
}

export function structuredOutputName(outputSchema) {
  const source = outputSchema?.$id?.split("/").at(-1) ?? "structured_output";
  return source.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}
