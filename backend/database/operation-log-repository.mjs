import { randomUUID } from "node:crypto";
import { getDatabasePool, isDatabaseConfigured, withDatabaseTransaction } from "./client.mjs";
import { sanitizeOperationPayload } from "./sanitize-payload.mjs";

export function operationAttemptId(operationId, attempt) {
  return `${operationId}:attempt:${attempt}`;
}

function requireWorkspaceId(workspaceId) {
  if (!workspaceId) throw new TypeError("Operation persistence requires a workspace ID.");
}

async function upsertPayload(
  client,
  {
    id,
    workspaceId,
    operationId,
    attemptId = null,
    scope,
    direction,
    value,
    traceStatus = "captured",
    representation = "normalized",
    schemaVersion = "operation-log-v1",
    preserveExisting = false,
  },
) {
  const sanitized = traceStatus === "captured" ? sanitizeOperationPayload(value) : null;
  const conflictAction = preserveExisting
    ? "do nothing"
    : `do update set
      trace_status = excluded.trace_status,
      content_json = excluded.content_json,
      schema_version = excluded.schema_version,
      redaction_status = excluded.redaction_status,
      byte_size = excluded.byte_size,
      content_hash = excluded.content_hash,
      updated_at = now()
      where operation_payloads.workspace_id = excluded.workspace_id`;
  await client.query(
    `
    insert into operation_payloads (
      id, workspace_id, operation_id, attempt_id, scope, direction, representation, trace_status,
      content_json, schema_version, redaction_status, byte_size, content_hash
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    on conflict (id) ${conflictAction}
  `,
    [
      id,
      workspaceId,
      operationId,
      attemptId,
      scope,
      direction,
      representation,
      traceStatus,
      sanitized?.content ?? null,
      schemaVersion,
      sanitized?.redactionStatus ?? "not_required",
      sanitized?.byteSize ?? null,
      sanitized?.contentHash ?? null,
    ],
  );
}

export async function beginAiOperationAttempt({
  workspaceId,
  operationId = randomUUID(),
  operationType,
  generationId = null,
  attempt = 1,
  provider,
  model,
  startedAt = new Date().toISOString(),
  request,
  requestOptions,
  related = {},
}) {
  requireWorkspaceId(workspaceId);
  if (!isDatabaseConfigured())
    return { operationId, attemptId: operationAttemptId(operationId, attempt) };
  const attemptId = operationAttemptId(operationId, attempt);
  await withDatabaseTransaction(async (client) => {
    await client.query(
      `
      insert into operations (
        id, workspace_id, operation_type, status, started_at,
        product_id, strategy_node_id, creative_id, generation_id
      ) values ($1,$2,$3,'running',$4,$5,$6,$7,$8)
      on conflict (id) do update set
        status = 'running',
        updated_at = now()
      where operations.workspace_id = excluded.workspace_id
    `,
      [
        operationId,
        workspaceId,
        operationType,
        startedAt,
        related.productId ?? null,
        related.strategyNodeId ?? null,
        related.creativeId ?? null,
        generationId,
      ],
    );
    await client.query(
      `
      insert into operation_attempts (
        id, workspace_id, operation_id, attempt_number, cost_source, provider,
        service, model, status, started_at, request_options
      ) values ($1,$2,$3,$4,'ai',$5,'ai_model',$6,'running',$7,$8)
      on conflict (id) do update set
        status = 'running', request_options = excluded.request_options, updated_at = now()
      where operation_attempts.workspace_id = excluded.workspace_id
    `,
      [
        attemptId,
        workspaceId,
        operationId,
        attempt,
        provider,
        model,
        startedAt,
        requestOptions ?? null,
      ],
    );
    await upsertPayload(client, {
      id: `${operationId}:input`,
      workspaceId,
      operationId,
      scope: "operation",
      direction: "input",
      value: request,
      preserveExisting: true,
    });
    await upsertPayload(client, {
      id: `${operationId}:output`,
      workspaceId,
      operationId,
      scope: "operation",
      direction: "output",
      traceStatus: "untraced",
      preserveExisting: true,
    });
    await upsertPayload(client, {
      id: `${attemptId}:input`,
      workspaceId,
      operationId,
      attemptId,
      scope: "attempt",
      direction: "input",
      value: request,
    });
    await upsertPayload(client, {
      id: `${attemptId}:output`,
      workspaceId,
      operationId,
      attemptId,
      scope: "attempt",
      direction: "output",
      traceStatus: "untraced",
    });
  });
  return { operationId, attemptId };
}

export async function completeAiOperationAttempt({
  workspaceId,
  operationId,
  attemptId,
  response,
  providerRequestId,
  completedAt = new Date().toISOString(),
  durationMs,
}) {
  requireWorkspaceId(workspaceId);
  if (!isDatabaseConfigured()) return;
  await withDatabaseTransaction(async (client) => {
    await client.query(
      `
      update operation_attempts set
        status = 'success', completed_at = $2, duration_ms = $3, provider_request_id = $4, updated_at = now()
      where id = $1 and workspace_id = $5
    `,
      [attemptId, completedAt, durationMs, providerRequestId ?? null, workspaceId],
    );
    await client.query(
      `
      update operations set status = 'success', completed_at = $2,
        error_stage = null, error_code = null, error_message = null, updated_at = now()
      where id = $1 and workspace_id = $3
    `,
      [operationId, completedAt, workspaceId],
    );
    await upsertPayload(client, {
      id: `${attemptId}:output`,
      workspaceId,
      operationId,
      attemptId,
      scope: "attempt",
      direction: "output",
      value: {
        text: response?.text ?? null,
        metadata: response?.metadata ?? null,
        provider: response?.provider ?? null,
        model: response?.model ?? null,
      },
    });
    if (response?.raw !== undefined) {
      await upsertPayload(client, {
        id: `${attemptId}:output:raw`,
        workspaceId,
        operationId,
        attemptId,
        scope: "attempt",
        direction: "output",
        representation: "raw",
        value: response.raw,
      });
    }
  });
}

export async function completeOperationOutput({
  workspaceId,
  operationId,
  output,
  completedAt = new Date().toISOString(),
  related = {},
}) {
  requireWorkspaceId(workspaceId);
  if (!isDatabaseConfigured()) return;
  await withDatabaseTransaction(async (client) => {
    const update = await client.query(
      `
      update operations set
        status = 'success', completed_at = $2,
        product_id = coalesce(product_id, $3),
        strategy_node_id = coalesce(strategy_node_id, $4),
        creative_id = coalesce(creative_id, $5),
        error_stage = null, error_code = null, error_message = null,
        updated_at = now()
      where id = $1 and workspace_id = $6
    `,
      [
        operationId,
        completedAt,
        related.productId ?? null,
        related.strategyNodeId ?? null,
        related.creativeId ?? null,
        workspaceId,
      ],
    );
    if (!update.rowCount) return;
    await upsertPayload(client, {
      id: `${operationId}:output`,
      workspaceId,
      operationId,
      scope: "operation",
      direction: "output",
      value: output,
    });
  });
}

export async function failOperation({
  workspaceId,
  operationId,
  stage,
  error,
  completedAt = new Date().toISOString(),
}) {
  requireWorkspaceId(workspaceId);
  if (!isDatabaseConfigured()) return;
  const code = typeof error?.code === "string" ? error.code : null;
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown operation error");
  await getDatabasePool().query(
    `
    update operations set
      status = 'error', completed_at = $2, error_stage = $3, error_code = $4, error_message = $5, updated_at = now()
    where id = $1 and workspace_id = $6
  `,
    [operationId, completedAt, stage, code, message, workspaceId],
  );
}

export async function failAiOperationAttempt({
  workspaceId,
  operationId,
  attemptId,
  error,
  completedAt = new Date().toISOString(),
  durationMs,
}) {
  requireWorkspaceId(workspaceId);
  if (!isDatabaseConfigured()) return;
  const code = typeof error?.code === "string" ? error.code : null;
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown operation error");
  await withDatabaseTransaction(async (client) => {
    await client.query(
      `
      update operation_attempts set
        status = 'error', completed_at = $2, duration_ms = $3, error_stage = 'provider_call',
        error_code = $4, error_message = $5, updated_at = now()
      where id = $1 and workspace_id = $6
    `,
      [attemptId, completedAt, durationMs, code, message, workspaceId],
    );
    await client.query(
      `
      update operations set status = 'error', completed_at = $2, error_stage = 'provider_call',
        error_code = $3, error_message = $4, updated_at = now()
      where id = $1 and workspace_id = $5
    `,
      [operationId, completedAt, code, message, workspaceId],
    );
  });
}

export async function importCostLedgerEntry(client, entry, { historical = false } = {}) {
  const workspaceId = entry.workspaceId;
  if (!workspaceId) throw new TypeError("Cost persistence requires a workspace ID.");
  const operationId = entry.operationId ?? entry.parentGenerationId ?? `untraced:${entry.id}`;
  const attempt = Number.isInteger(entry.attempt) && entry.attempt > 0 ? entry.attempt : 1;
  const attemptId = operationAttemptId(operationId, attempt);
  const occurredAt = entry.occurredAt ?? entry.createdAt ?? new Date().toISOString();
  const operationStatus = historical ? "untraced" : "success";

  await client.query(
    `
    insert into operations (
      id, workspace_id, operation_type, status, started_at, completed_at, generation_id
    ) values ($1,$2,$3,$4,$5,$6,$7)
    on conflict (id) do update set
      operation_type = excluded.operation_type,
      generation_id = coalesce(operations.generation_id, excluded.generation_id),
      updated_at = now()
    where operations.workspace_id = excluded.workspace_id
  `,
    [
      operationId,
      workspaceId,
      entry.operation,
      operationStatus,
      occurredAt,
      historical ? null : entry.createdAt,
      entry.parentGenerationId ?? null,
    ],
  );
  await client.query(
    `
    insert into operation_attempts (
      id, workspace_id, operation_id, attempt_number, cost_source, provider, service, model, status,
      started_at, completed_at, provider_request_id, request_options
    ) values ($1,$2,$3,$4,'ai',$5,'ai_model',$6,'success',$7,$8,$9,$10)
    on conflict (id) do update set
      provider_request_id = excluded.provider_request_id,
      request_options = excluded.request_options,
      updated_at = now()
    where operation_attempts.workspace_id = excluded.workspace_id
  `,
    [
      attemptId,
      workspaceId,
      operationId,
      attempt,
      entry.provider,
      entry.model,
      occurredAt,
      entry.createdAt,
      entry.providerRequestId ?? null,
      entry.requestContext ?? null,
    ],
  );

  for (const [id, scope, direction, relatedAttemptId] of [
    [`${operationId}:input`, "operation", "input", null],
    [`${operationId}:output`, "operation", "output", null],
    [`${attemptId}:input`, "attempt", "input", attemptId],
    [`${attemptId}:output`, "attempt", "output", attemptId],
  ]) {
    await client.query(
      `
      insert into operation_payloads (
        id, workspace_id, operation_id, attempt_id, scope, direction,
        representation, trace_status, redaction_status
      ) values ($1,$2,$3,$4,$5,$6,'normalized','untraced','not_required')
      on conflict (id) do nothing
    `,
      [id, workspaceId, operationId, relatedAttemptId, scope, direction],
    );
  }

  await client.query(
    `
    insert into operation_costs (
      id, workspace_id, attempt_id, status, amount, currency, raw_usage, normalized_usage,
      pricing_snapshot, cost_breakdown, unpriced_reason, recorded_at
    ) values ($1,$2,$3,$4,$5,'USD',$6,$7,$8,$9,$10,$11)
    on conflict (id) do update set
      status = excluded.status,
      amount = excluded.amount,
      raw_usage = excluded.raw_usage,
      normalized_usage = excluded.normalized_usage,
      pricing_snapshot = excluded.pricing_snapshot,
      cost_breakdown = excluded.cost_breakdown,
      unpriced_reason = excluded.unpriced_reason
    where operation_costs.workspace_id = excluded.workspace_id
  `,
    [
      entry.id,
      workspaceId,
      attemptId,
      entry.cost.status,
      entry.cost.usd,
      entry.rawUsage ?? null,
      entry.normalizedUsage ?? null,
      entry.pricing ?? null,
      entry.cost.breakdown ?? null,
      entry.cost.reason ?? null,
      entry.createdAt,
    ],
  );
  return { operationId, attemptId, costId: entry.id };
}

export async function mirrorCostLedgerEntry(entry) {
  if (!isDatabaseConfigured()) return;
  requireWorkspaceId(entry.workspaceId);
  await withDatabaseTransaction((client) => importCostLedgerEntry(client, entry));
}

export async function readDatabaseCostLedgerEntries({ workspaceId, limit } = {}) {
  if (!workspaceId) throw new TypeError("Cost reads require a workspace ID.");
  const params = [workspaceId];
  const limitClause = Number.isInteger(limit) && limit > 0 ? "limit $2" : "";
  if (limitClause) params.push(limit);
  const { rows } = await getDatabasePool().query(
    `
    select
      c.id,
      c.recorded_at,
      a.started_at,
      a.provider,
      a.model,
      a.provider_request_id,
      o.operation_type,
      o.id as operation_id,
      o.generation_id,
      a.attempt_number,
      a.request_options,
      c.raw_usage,
      c.normalized_usage,
      c.status as cost_status,
      c.amount,
      c.unpriced_reason,
      c.cost_breakdown,
      c.pricing_snapshot
    from operation_costs c
    join operation_attempts a
      on a.workspace_id = c.workspace_id and a.id = c.attempt_id
    join operations o
      on o.workspace_id = a.workspace_id and o.id = a.operation_id
    where c.workspace_id = $1
    order by a.started_at desc, c.recorded_at desc
    ${limitClause}
  `,
    params,
  );
  return rows.map((row) => ({
    id: row.id,
    createdAt: iso(row.recorded_at),
    occurredAt: iso(row.started_at),
    provider: row.provider,
    model: row.model,
    providerRequestId: row.provider_request_id,
    operation: row.operation_type,
    operationId: row.operation_id,
    parentGenerationId: row.generation_id,
    attempt: row.attempt_number,
    requestContext: row.request_options,
    rawUsage: row.raw_usage,
    normalizedUsage: row.normalized_usage,
    cost: {
      status: row.cost_status,
      usd: row.amount === null ? null : String(row.amount),
      reason: row.unpriced_reason,
      breakdown: row.cost_breakdown,
    },
    pricing: row.pricing_snapshot,
  }));
}

function iso(value) {
  return value instanceof Date ? value.toISOString() : (value ?? null);
}

function payloadRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    traceStatus: row.trace_status,
    representation: row.representation,
    content: row.content_json ?? row.content_text ?? null,
    redactionStatus: row.redaction_status,
    byteSize: row.byte_size,
  };
}

export async function readDatabaseOperationLogs({ workspaceId, limit = 100 } = {}) {
  if (!workspaceId) throw new TypeError("Operation reads require a workspace ID.");
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 500) : 100;
  const pool = getDatabasePool();
  const { rows: operations } = await pool.query(
    `
    select * from operations
    where workspace_id = $1 order by started_at desc limit $2
  `,
    [workspaceId, safeLimit],
  );
  if (!operations.length) return [];
  const operationIds = operations.map((operation) => operation.id);
  const operationIdPlaceholders = operationIds.map((_, index) => `$${index + 1}`).join(", ");
  const { rows: attempts } = await pool.query(
    `
      select * from operation_attempts
    where workspace_id = $${operationIds.length + 1}
      and operation_id in (${operationIdPlaceholders})
    order by operation_id, attempt_number
  `,
    [...operationIds, workspaceId],
  );
  const { rows: payloads } = await pool.query(
    `
      select * from operation_payloads
    where workspace_id = $${operationIds.length + 1}
      and operation_id in (${operationIdPlaceholders})
    order by created_at
  `,
    [...operationIds, workspaceId],
  );
  const attemptIds = attempts.map((attempt) => attempt.id);
  const costs = attemptIds.length
    ? (
        await pool.query(
          `select * from operation_costs where workspace_id = $${attemptIds.length + 1}
            and attempt_id in (${attemptIds
            .map((_, index) => `$${index + 1}`)
            .join(", ")}) order by recorded_at`,
          [...attemptIds, workspaceId],
        )
      ).rows
    : [];

  const payloadsByOperation = new Map();
  const payloadsByAttempt = new Map();
  payloads.forEach((payload) => {
    const target = payload.attempt_id ? payloadsByAttempt : payloadsByOperation;
    const key = payload.attempt_id ?? payload.operation_id;
    const items = target.get(key) ?? [];
    items.push(payload);
    target.set(key, items);
  });
  const costsByAttempt = new Map();
  costs.forEach((cost) => {
    const items = costsByAttempt.get(cost.attempt_id) ?? [];
    items.push(cost);
    costsByAttempt.set(cost.attempt_id, items);
  });
  const attemptsByOperation = new Map();
  attempts.forEach((attempt) => {
    const items = attemptsByOperation.get(attempt.operation_id) ?? [];
    items.push(attempt);
    attemptsByOperation.set(attempt.operation_id, items);
  });

  return operations.map((operation) => {
    const operationPayloads = payloadsByOperation.get(operation.id) ?? [];
    const operationAttempts = (attemptsByOperation.get(operation.id) ?? []).map((attempt) => {
      const attemptPayloads = payloadsByAttempt.get(attempt.id) ?? [];
      const attemptCosts = costsByAttempt.get(attempt.id) ?? [];
      const primaryCost = attemptCosts[0] ?? null;
      return {
        id: attempt.id,
        attemptNumber: attempt.attempt_number,
        costSource: attempt.cost_source,
        provider: attempt.provider,
        service: attempt.service,
        model: attempt.model,
        status: attempt.status,
        startedAt: iso(attempt.started_at),
        completedAt: iso(attempt.completed_at),
        durationMs: attempt.duration_ms,
        providerRequestId: attempt.provider_request_id,
        requestOptions: attempt.request_options,
        flags: [
          ...(Array.isArray(attempt.flags) ? attempt.flags : []),
          ...(attempt.attempt_number > 1
            ? [
                {
                  id: "retry",
                  label: "Retry attempt",
                  detail: `Attempt ${attempt.attempt_number}`,
                  tone: "warning",
                },
              ]
            : []),
        ],
        error: attempt.error_message
          ? {
              stage: attempt.error_stage,
              code: attempt.error_code,
              message: attempt.error_message,
            }
          : null,
        request: payloadRecord(
          attemptPayloads.find(
            (payload) => payload.direction === "input" && payload.representation === "normalized",
          ),
        ),
        response: payloadRecord(
          attemptPayloads.find(
            (payload) => payload.direction === "output" && payload.representation === "normalized",
          ),
        ),
        rawResponse: payloadRecord(
          attemptPayloads.find(
            (payload) => payload.direction === "output" && payload.representation === "raw",
          ),
        ),
        usage: primaryCost?.normalized_usage ?? null,
        cost: primaryCost
          ? {
              status: primaryCost.status,
              usd: primaryCost.amount === null ? null : String(primaryCost.amount),
              currency: primaryCost.currency.trim(),
              reason: primaryCost.unpriced_reason,
              breakdown: primaryCost.cost_breakdown,
              pricing: primaryCost.pricing_snapshot,
            }
          : null,
      };
    });
    const totalCost = operationAttempts.reduce((sum, attempt) => {
      const value =
        attempt.cost?.usd === null || attempt.cost?.usd === undefined
          ? null
          : Number(attempt.cost.usd);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
    const hasPricedCost = operationAttempts.some(
      (attempt) => attempt.cost?.usd !== null && attempt.cost?.usd !== undefined,
    );
    return {
      id: operation.id,
      operationType: operation.operation_type,
      status: operation.status,
      startedAt: iso(operation.started_at),
      completedAt: iso(operation.completed_at),
      durationMs: operation.completed_at
        ? Math.max(
            0,
            new Date(operation.completed_at).getTime() - new Date(operation.started_at).getTime(),
          )
        : null,
      input: payloadRecord(
        operationPayloads.find(
          (payload) => payload.direction === "input" && payload.representation === "normalized",
        ),
      ),
      output: payloadRecord(
        operationPayloads.find(
          (payload) => payload.direction === "output" && payload.representation === "normalized",
        ),
      ),
      attempts: operationAttempts,
      totalCostUsd: hasPricedCost ? String(totalCost) : null,
      error: operation.error_message
        ? {
            stage: operation.error_stage,
            code: operation.error_code,
            message: operation.error_message,
          }
        : null,
      related: {
        productId: operation.product_id,
        strategyNodeId: operation.strategy_node_id,
        creativeId: operation.creative_id,
        generationId: operation.generation_id,
      },
    };
  });
}
