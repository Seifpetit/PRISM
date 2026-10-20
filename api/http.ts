/** Transport-only GraphQL HTTP request builder. */

import { getSessionToken } from "@/lib/session-token";

export interface HttpRequest {
  url: string;
  init: RequestInit;
}

export interface GraphQLHttpInput {
  endpoint?: string;
  operationName: string;
  query: string;
  variables?: Record<string, unknown>;
  signal?: AbortSignal;
}

const defaultEndpoint = () => process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT ?? "/graphql";

export function buildGraphQLHttpRequest(input: GraphQLHttpInput): HttpRequest {
  const token = getSessionToken();
  return {
    url: input.endpoint ?? defaultEndpoint(),
    init: {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        operationName: input.operationName,
        query: input.query,
        variables: input.variables ?? {},
      }),
      signal: input.signal,
    },
  };
}

export async function sendHttpRequest<T>(request: HttpRequest): Promise<T> {
  const response = await fetch(request.url, request.init);
  const payload = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (!response.ok || payload.errors?.length) {
    const message =
      payload.errors?.map((error) => error.message).join(", ") ||
      `HTTP request failed (${response.status})`;
    throw new Error(message);
  }
  return payload.data as T;
}
