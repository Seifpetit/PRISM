# OpenAI

OpenAI pricing varies by model, context size, processing mode, and modality. The flagship text
models are shown first; realtime, image, audio, tools, and historical models are separated below.

## Contents

- [At a glance](#at-a-glance)
- [Text and reasoning](#text-and-reasoning)
- [Realtime](#realtime)
- [Image generation](#image-generation)
- [Audio and transcription](#audio-and-transcription)
- [Tools and non-model charges](#tools-and-non-model-charges)
- [Processing modes](#processing-modes)
- [Fine-tuning](#fine-tuning)
- [Cost calculation](#cost-calculation)
- [Legacy and deprecated](#legacy-and-deprecated)
- [Source](#source)

## At a glance

| Model         | Role                         | Standard input / output |
| ------------- | ---------------------------- | ----------------------: |
| GPT-5.6 Sol   | Highest-capability reasoning |                $5 / $30 |
| GPT-5.6 Terra | General-purpose reasoning    |                $2 / $12 |
| GPT-5.6 Luna  | Economical, high-volume      |           $0.20 / $1.20 |

These are short-context Standard rates in USD per 1 million tokens.

## Text and reasoning

### GPT-5.6 Sol

**Current · Highest-capability reasoning**

Model ID: `gpt-5.6-sol`

#### Short context

| Usage        | Standard | Batch / Flex |   Fast |
| ------------ | -------: | -----------: | -----: |
| Input        |       $5 |        $2.50 |    $10 |
| Cached input |    $0.50 |        $0.25 |     $1 |
| Cache write  |    $6.25 |       $3.125 | $12.50 |
| Output       |      $30 |          $15 |    $60 |

#### Long context

| Usage        | Standard | Batch / Flex | Fast |
| ------------ | -------: | -----------: | ---: |
| Input        |      $10 |           $5 |  $20 |
| Cached input |       $1 |        $0.50 |   $2 |
| Cache write  |   $12.50 |        $6.25 |  $25 |
| Output       |      $45 |       $22.50 |  $90 |

### GPT-5.6 Terra

**Current · General-purpose reasoning**

Model ID: `gpt-5.6-terra`

#### Short context

| Usage        | Standard | Batch / Flex |  Fast |
| ------------ | -------: | -----------: | ----: |
| Input        |       $2 |           $1 |    $4 |
| Cached input |    $0.20 |        $0.10 | $0.40 |
| Cache write  |    $2.50 |        $1.25 |    $5 |
| Output       |      $12 |           $6 |   $24 |

#### Long context

| Usage        | Standard | Batch / Flex |  Fast |
| ------------ | -------: | -----------: | ----: |
| Input        |       $4 |           $2 |    $8 |
| Cached input |    $0.40 |        $0.20 | $0.80 |
| Cache write  |       $5 |        $2.50 |   $10 |
| Output       |      $18 |           $9 |   $36 |

### GPT-5.6 Luna

**Current · Economical, high-volume**

Model ID: `gpt-5.6-luna`

#### Short context

| Usage        | Standard | Batch / Flex |  Fast |
| ------------ | -------: | -----------: | ----: |
| Input        |    $0.20 |        $0.10 | $0.40 |
| Cached input |    $0.02 |        $0.01 | $0.04 |
| Cache write  |    $0.25 |       $0.125 | $0.50 |
| Output       |    $1.20 |        $0.60 | $2.40 |

#### Long context

| Usage        | Standard | Batch / Flex |  Fast |
| ------------ | -------: | -----------: | ----: |
| Input        |    $0.40 |        $0.20 | $0.80 |
| Cached input |    $0.04 |        $0.02 | $0.08 |
| Cache write  |    $0.50 |        $0.25 |    $1 |
| Output       |    $1.80 |        $0.90 | $3.60 |

### GPT-5.6 Cyber

**Current · Cybersecurity**

Model ID: `gpt-5.6-cyber`

| Usage        | Standard short-context rate |
| ------------ | --------------------------: |
| Input        |                      $12.50 |
| Cached input |                       $1.25 |
| Cache write  |                     $15.625 |
| Output       |                         $75 |

No long-context rate is published in this snapshot.

### Chat Latest

**Current · ChatGPT model API access**

Model ID: `chat-latest`

| Usage        | Standard |
| ------------ | -------: |
| Input        |       $5 |
| Cached input |    $0.50 |
| Output       |      $30 |

### GPT-5.3 Codex

**Current · Code generation**

Model ID: `gpt-5.3-codex`

| Usage        | Standard |  Fast |
| ------------ | -------: | ----: |
| Input        |    $1.75 | $3.50 |
| Cached input |   $0.175 | $0.35 |
| Output       |      $14 |   $28 |

## Realtime

Realtime prices are USD per 1 million modality tokens.

### GPT Realtime 2.1

**Current**

Model ID: `gpt-realtime-2.1`

| Modality | Input | Cached input |        Output |
| -------- | ----: | -----------: | ------------: |
| Audio    |   $32 |        $0.40 |           $64 |
| Text     |    $4 |        $0.40 |           $24 |
| Image    |    $5 |        $0.50 | Not published |

### GPT Realtime 2.1 Mini

**Current**

Model ID: `gpt-realtime-2.1-mini`

| Modality | Input | Cached input |        Output |
| -------- | ----: | -----------: | ------------: |
| Audio    |   $10 |        $0.30 |           $20 |
| Text     | $0.60 |        $0.06 |         $2.40 |
| Image    | $0.80 |        $0.08 | Not published |

## Image generation

### GPT Image 2

**Current**

Model ID: `gpt-image-2`

| Usage              | Standard |  Batch |
| ------------------ | -------: | -----: |
| Image input        |       $8 |     $4 |
| Cached image input |       $2 |     $1 |
| Image output       |      $30 |    $15 |
| Text input         |       $5 |  $2.50 |
| Cached text input  |    $1.25 | $0.625 |

Prices are USD per 1 million tokens. The official image-generation guide also provides a calculator
for per-image estimates.

## Audio and transcription

### Live translation and transcription

| Model                    | Use                |   Estimated cost |
| ------------------------ | ------------------ | ---------------: |
| `gpt-realtime-translate` | Live translation   |  $0.034 / minute |
| `gpt-live-transcribe`    | Live transcription |  $0.017 / minute |
| `gpt-realtime-whisper`   | Live transcription |  $0.017 / minute |
| `gpt-transcribe`         | File transcription | $0.0045 / minute |

### Token-priced transcription

| Model                    | Input / output |  Estimated cost |
| ------------------------ | -------------: | --------------: |
| `gpt-4o-transcribe`      |    $2.50 / $10 | $0.006 / minute |
| `gpt-4o-mini-transcribe` |     $1.25 / $5 | $0.003 / minute |

Token prices are USD per 1 million tokens. Per-minute values are published estimates rather than
additional token charges.

## Tools and non-model charges

### Web search

| Search type                          |             Price | Search-content tokens       |
| ------------------------------------ | ----------------: | --------------------------- |
| Web search                           | $10 / 1,000 calls | Billed at model input rates |
| Image web search                     | $10 / 1,000 calls | Billed at model input rates |
| Preview search, reasoning models     | $10 / 1,000 calls | Billed at model input rates |
| Preview search, non-reasoning models | $25 / 1,000 calls | Free                        |

For non-preview web search with `gpt-4o-mini` or `gpt-4.1-mini`, search content is billed as a fixed
block of 8,000 input tokens per call.

### Containers

| Container memory | Published 20-minute price |
| ---------------- | ------------------------: |
| 1 GB             |                     $0.03 |
| 4 GB             |                     $0.12 |
| 16 GB            |                     $0.48 |
| 64 GB            |                     $1.92 |

Container pricing covers Hosted Shell and Code Interpreter. Eligible sessions are billed by the
minute with a five-minute minimum.

### Storage and File Search

| Item                     |               Price | Free allowance or scope           |
| ------------------------ | ------------------: | --------------------------------- |
| File Search storage      |      $0.10 / GB-day | First 1 GB free                   |
| File Search tool calls   | $2.50 / 1,000 calls | Responses API only                |
| Agent Kit upload storage |      $0.10 / GB-day | First 1 GB per account each month |

GB means a binary gigabyte: 2^30 bytes.

Responses, Chat Completions, Realtime, Batch, and Assistants do not have a separate API-call fee.
Model and tool usage is billed through the applicable rates above.

## Processing modes

### Standard

Standard is the baseline synchronous price shown for each model.

### Batch

Batch uses the published discounted rates. For GPT-5.6 Sol, Terra, and Luna, the Batch values are
shown in each model table.

### Flex

The flagship-model Flex rates in this snapshot match their Batch rates.

### Fast

Priority processing was renamed Fast mode on 2026-07-30. Requests may use either
`service_tier: "priority"` or `service_tier: "fast"`.

### Regional processing

Eligible data-residency models released on or after 2026-03-05 receive a 10% uplift, equivalent to
multiplying the applicable price by 1.1. Amazon Bedrock pricing is billed through AWS and may differ
from direct OpenAI pricing.

## Fine-tuning

### O4 Mini 2025-04-16

**Existing fine-tuning users only**

Model ID: `o4-mini-2025-04-16`

The fine-tuning platform is no longer available to new users. Existing users can continue creating
training jobs during the wind-down period, and existing fine-tuned models remain available until
their base models are deprecated.

Training costs $100 per hour in every configuration below.

#### Standard data policy

| Usage        | Standard | Batch |
| ------------ | -------: | ----: |
| Input        |       $4 |    $2 |
| Cached input |       $1 | $0.50 |
| Output       |      $16 |    $8 |

#### With data sharing

| Usage        | Standard | Batch |
| ------------ | -------: | ----: |
| Input        |       $2 |    $1 |
| Cached input |    $0.50 | $0.25 |
| Output       |       $8 |    $4 |

Tokens used for model grading in reinforcement fine-tuning are billed at the selected model's token
rates.

## Cost calculation

```text
cost_usd =
  (uncached_input_tokens / 1,000,000) * input_rate
  + (cached_input_tokens / 1,000,000) * cached_input_rate
  + (cache_write_tokens / 1,000,000) * cache_write_rate
  + (output_tokens / 1,000,000) * output_rate
  + request_charges
  + storage_charges
  + generated_media_charges
```

Select the model, context tier, processing mode, and regional multiplier before applying the
formula.

Example for GPT-5.6 Terra, Standard short context, with 100,000 uncached input tokens and 20,000
output tokens:

```text
input  = 100,000 / 1,000,000 * $2  = $0.20
output =  20,000 / 1,000,000 * $12 = $0.24
total  = $0.44
```

## Legacy and deprecated

### Sora 2

**Deprecated**

Model ID: `sora-2`

| Size | Dimensions                              |       Standard |          Batch |
| ---- | --------------------------------------- | -------------: | -------------: |
| 720p | 720x1280 portrait or 1280x720 landscape | $0.10 / second | $0.05 / second |

### Sora 2 Pro

**Deprecated**

Model ID: `sora-2-pro`

| Size  | Dimensions                                |       Standard |          Batch |
| ----- | ----------------------------------------- | -------------: | -------------: |
| 720p  | 720x1280 portrait or 1280x720 landscape   | $0.30 / second | $0.15 / second |
| 1024p | 1024x1792 portrait or 1792x1024 landscape | $0.50 / second | $0.25 / second |
| 1080p | 1080x1920 portrait or 1920x1080 landscape | $0.70 / second | $0.35 / second |

## Source

- Official pricing page: https://developers.openai.com/api/docs/pricing
- Retrieved: 2026-08-11T21:27:01+02:00 (Europe/Berlin)
- Unit: USD per 1 million tokens unless otherwise noted
