# DeepSeek

DeepSeek currently exposes two V4 text-generation models. Pricing separates uncached input, cached
input, and generated output.

## Contents

- [At a glance](#at-a-glance)
- [Current models](#current-models)
- [Caching behavior](#caching-behavior)
- [Cost calculation](#cost-calculation)
- [Billing notes](#billing-notes)
- [Source](#source)

## At a glance

| Model             | Role       | Uncached input / output |
| ----------------- | ---------- | ----------------------: |
| DeepSeek V4 Flash | Flash tier |           $0.14 / $0.28 |
| DeepSeek V4 Pro   | Pro tier   |          $0.435 / $0.87 |

Prices are USD per 1 million tokens.

## Current models

### DeepSeek V4 Flash

**Current**

| Usage          |   Price |
| -------------- | ------: |
| Cached input   | $0.0028 |
| Uncached input |   $0.14 |
| Output         |   $0.28 |

- Model ID: `deepseek-v4-flash`
- Context window: 1 million tokens
- Maximum output: 384,000 tokens

### DeepSeek V4 Pro

**Current**

| Usage          |     Price |
| -------------- | --------: |
| Cached input   | $0.003625 |
| Uncached input |    $0.435 |
| Output         |     $0.87 |

- Model ID: `deepseek-v4-pro`
- Context window: 1 million tokens
- Maximum output: 384,000 tokens

## Caching behavior

DeepSeek enables context caching by default. A cache hit and a cache miss use different input rates.

The response usage object provides these fields:

- `prompt_tokens`: total prompt usage
- `prompt_cache_hit_tokens`: cached prompt usage
- `prompt_cache_miss_tokens`: uncached prompt usage
- `completion_tokens`: generated output usage
- `completion_tokens_details.reasoning_tokens`: thinking usage when returned

The prompt-token relationship is:

```text
prompt_tokens = prompt_cache_hit_tokens + prompt_cache_miss_tokens
```

Reasoning tokens are reported separately when available, but the pricing page does not publish a
separate reasoning-token rate. Thinking is enabled by default.

## Cost calculation

```text
cost_usd =
  (cache_miss_tokens / 1,000,000) * cache_miss_rate
  + (cache_hit_tokens / 1,000,000) * cache_hit_rate
  + (output_tokens / 1,000,000) * output_rate
```

Example for DeepSeek V4 Flash with 100,000 uncached input tokens and 20,000 output tokens:

```text
input  = 100,000 / 1,000,000 * $0.14 = $0.0140
output =  20,000 / 1,000,000 * $0.28 = $0.0056
total  = $0.0196
```

## Billing notes

- DeepSeek deducts token charges from granted balance first when both granted and topped-up balances
  are available.
- Product prices may change; retain the pricing snapshot used for each call.

## Source

- Official pricing page: https://api-docs.deepseek.com/quick_start/pricing/
- Retrieved: 2026-08-11T21:27:01+02:00 (Europe/Berlin)
- Unit: USD per 1 million tokens unless otherwise noted
