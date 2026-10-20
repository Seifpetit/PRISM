export type OperationLogStatus = "running" | "success" | "error" | "cancelled" | "untraced";

export interface OperationFlag {
  id: string;
  label: string;
  detail?: string;
  tone: "neutral" | "warning" | "danger";
}

export interface OperationPayload {
  id: string;
  traceStatus: "captured" | "untraced" | "redacted" | "blocked" | string;
  representation: "normalized" | "raw" | "reference" | string;
  content: unknown | null;
  redactionStatus: "not_required" | "redacted" | "blocked" | string;
  byteSize?: number | null;
}

export interface OperationError {
  stage?: string | null;
  code?: string | null;
  message?: string | null;
}

export interface OperationCost {
  status: string;
  usd: string | null;
  currency: string;
  reason?: string | null;
  breakdown?: unknown;
  pricing?: unknown;
}

export interface OperationAttempt {
  id: string;
  attemptNumber: number;
  costSource: string;
  provider?: string | null;
  service?: string | null;
  model?: string | null;
  status: OperationLogStatus;
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  providerRequestId?: string | null;
  requestOptions?: Record<string, unknown> | null;
  flags?: OperationFlag[] | null;
  error?: OperationError | null;
  request?: OperationPayload | null;
  response?: OperationPayload | null;
  rawResponse?: OperationPayload | null;
  usage?: Record<string, unknown> | null;
  cost?: OperationCost | null;
}

export interface OperationLog {
  id: string;
  operationType: string;
  status: OperationLogStatus;
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  input?: OperationPayload | null;
  output?: OperationPayload | null;
  attempts: OperationAttempt[];
  totalCostUsd?: string | null;
  error?: OperationError | null;
  related: {
    productId?: string | null;
    strategyNodeId?: string | null;
    creativeId?: string | null;
    generationId?: string | null;
  };
}
