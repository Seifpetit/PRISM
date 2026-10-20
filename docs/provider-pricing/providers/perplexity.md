# Perplexity

The Sonar API bills token usage and, for Sonar, Sonar Pro, and Sonar Reasoning Pro, a request fee
based on the reported search-context size. Perplexity returns a cost object in `usage`; Prism treats
its `total_cost` as the authoritative per-call charge when present.

## Snapshot coverage

The structured snapshot records the official Sonar token rates and context-size request fees.
Sonar Deep Research has additional citation, search-query, and reasoning dimensions. Prism records
an exact provider-reported total for it when available; it deliberately reports `partial` rather
than reconstructing a total when those dimensions are absent.

## Source

- https://docs.perplexity.ai/docs/getting-started/pricing

Snapshot retrieved 2026-08-28. Prices may change; application cost rows retain their pricing
snapshot for reconciliation.
