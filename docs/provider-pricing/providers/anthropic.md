# Anthropic

Anthropic prices Claude usage by input and output tokens, with separate rates for prompt-cache
writes and reads. Batch and Fast processing alter the base model rates.

## Contents

- [At a glance](#at-a-glance)
- [Current model families](#current-model-families)
- [Prompt caching](#prompt-caching)
- [Batch and Fast mode](#batch-and-fast-mode)
- [Tools and agents](#tools-and-agents)
- [Marketplace billing](#marketplace-billing)
- [Cost calculation](#cost-calculation)
- [Older model pricing](#older-model-pricing)
- [Source](#source)

## At a glance

| Model            | Family | Standard input / output |
| ---------------- | ------ | ----------------------: |
| Claude Fable 5   | Fable  |               $10 / $50 |
| Claude Mythos 5  | Mythos |               $10 / $50 |
| Claude Opus 5    | Opus   |                $5 / $25 |
| Claude Sonnet 5  | Sonnet |                $2 / $10 |
| Claude Haiku 4.5 | Haiku  |                 $1 / $5 |

Prices are USD per 1 million tokens.

## Current model families

### Claude Fable 5 and Claude Mythos 5

**Current**

These two models share the same published rates.

| Usage  | Standard | Batch |
| ------ | -------: | ----: |
| Input  |      $10 |    $5 |
| Output |      $50 |   $25 |

### Claude Opus family

**Current rates**

These models share the same published rates:

- Claude Opus 5
- Claude Opus 4.8
- Claude Opus 4.7
- Claude Opus 4.6
- Claude Opus 4.5

| Usage  | Standard |  Batch |
| ------ | -------: | -----: |
| Input  |       $5 |  $2.50 |
| Output |      $25 | $12.50 |

### Claude Sonnet 5

**Current**

| Usage  | Standard | Batch |
| ------ | -------: | ----: |
| Input  |       $2 |    $1 |
| Output |      $10 |    $5 |

### Claude Sonnet 4 family

**Current rates**

These models share the same published rates:

- Claude Sonnet 4.6
- Claude Sonnet 4.5
- Claude Sonnet 4

| Usage  | Standard | Batch |
| ------ | -------: | ----: |
| Input  |       $3 | $1.50 |
| Output |      $15 | $7.50 |

### Claude Haiku 4.5

**Current**

| Usage  | Standard | Batch |
| ------ | -------: | ----: |
| Input  |       $1 | $0.50 |
| Output |       $5 | $2.50 |

## Prompt caching

Prompt caching has three independently billed token categories:

- A 5-minute cache write costs 1.25 times the model's base input rate.
- A 1-hour cache write costs 2 times the model's base input rate.
- A cache read costs 0.1 times the model's base input rate.

### Current cache rates

| Model group          | 5-minute write | 1-hour write | Cache read |
| -------------------- | -------------: | -----------: | ---------: |
| Fable 5 / Mythos 5   |         $12.50 |          $20 |         $1 |
| Opus 5 through 4.5   |          $6.25 |          $10 |      $0.50 |
| Sonnet 5             |          $2.50 |           $4 |      $0.20 |
| Sonnet 4.6 through 4 |          $3.75 |           $6 |      $0.30 |
| Haiku 4.5            |          $1.25 |           $2 |      $0.10 |

Cache rates are USD per 1 million tokens.

## Batch and Fast mode

### Batch

Batch processing halves the standard input and output rates. The Batch values are shown beside each
model family above.

### Fast mode

Fast mode is available at these rates for Claude Opus 5 and Claude Opus 4.8:

| Usage  | Fast rate |
| ------ | --------: |
| Input  |       $10 |
| Output |       $50 |

Fast mode cannot be combined with the Batch API.

Prompt-cache and data-residency modifiers still apply when Fast mode is used.

### US-only inference

US-only inference applies a 1.1 times multiplier to all token categories for Claude 4.6 and later.

## Tools and agents

- Web search costs $10 per 1,000 searches, plus normal token usage.
- Web fetch has no surcharge beyond normal token usage.
- Code execution costs $0.05 per container-hour after 1,550 free hours each month.
- Charged code-execution usage has a five-minute minimum.
- Code execution has no execution surcharge when paired with web search or web fetch.
- Managed Agent runtime costs $0.08 per running session-hour.
- Managed Agent runtime accrues only while the session status is running.

Built-in tool definitions also add billable input tokens:

| Feature                    | Models                            | Added input tokens |
| -------------------------- | --------------------------------- | -----------------: |
| Bash definition            | Opus 5, 4.8, and 4.7              |                325 |
| Bash definition            | Opus 4.6, Sonnet 4.6, and earlier |                244 |
| Text editor `20250429`     | Claude 4.x                        |                700 |
| Computer-use system prompt | Claude 4.x                        |            466–499 |
| Computer-use definition    | Claude 4.x                        |                735 |

## Marketplace billing

- Claude Platform on AWS converts rated USD usage to Claude Capacity Units at $0.01 per unit.
- Claude in Microsoft Foundry uses Claude Capacity Units at $0.01 per unit.
- Microsoft Foundry US Data Zone Standard uses the same 1.1 times multiplier as US inference
  geography.

## Cost calculation

```text
cost_usd =
  (uncached_input_tokens / 1,000,000) * input_rate
  + (five_minute_cache_write_tokens / 1,000,000) * five_minute_write_rate
  + (one_hour_cache_write_tokens / 1,000,000) * one_hour_write_rate
  + (cache_read_tokens / 1,000,000) * cache_read_rate
  + (output_tokens / 1,000,000) * output_rate
  + tool_charges
  + runtime_charges
```

Example for Claude Sonnet 5 with 100,000 uncached input tokens and 20,000 output tokens:

```text
input  = 100,000 / 1,000,000 * $2  = $0.20
output =  20,000 / 1,000,000 * $10 = $0.20
total  = $0.40
```

## Older model pricing

### Claude Opus 4.1 and Claude Opus 4

These models share the same published rates.

| Usage  | Standard |  Batch |
| ------ | -------: | -----: |
| Input  |      $15 |  $7.50 |
| Output |      $75 | $37.50 |

| Cache operation |   Rate |
| --------------- | -----: |
| 5-minute write  | $18.75 |
| 1-hour write    |    $30 |
| Cache read      |  $1.50 |

### Claude Haiku 3.5

| Usage  | Standard | Batch |
| ------ | -------: | ----: |
| Input  |    $0.80 | $0.40 |
| Output |       $4 |    $2 |

| Cache operation |  Rate |
| --------------- | ----: |
| 5-minute write  |    $1 |
| 1-hour write    | $1.60 |
| Cache read      | $0.08 |

## Source

- Official pricing page: https://platform.claude.com/docs/en/about-claude/pricing
- Retrieved: 2026-08-11T21:27:01+02:00 (Europe/Berlin)
- Unit: USD per 1 million tokens unless otherwise noted
