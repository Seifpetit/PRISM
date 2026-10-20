# Cross-provider pricing overview

This page is an orientation aid for current, broadly relevant text-generation models. It
intentionally omits specialized modalities, cache-write details, tools, and legacy models; each
provider guide preserves the full reference.

## Contents

- [OpenAI](#openai)
- [Anthropic](#anthropic)
- [Gemini](#gemini)
- [DeepSeek](#deepseek)
- [Cost calculation](#cost-calculation)
- [Provider guides](#provider-guides)

## OpenAI

| Model         | Role                         | Standard input / output |
| ------------- | ---------------------------- | ----------------------: |
| GPT-5.6 Sol   | Highest-capability reasoning |                $5 / $30 |
| GPT-5.6 Terra | General-purpose reasoning    |                $2 / $12 |
| GPT-5.6 Luna  | Economical, high-volume      |           $0.20 / $1.20 |
| GPT-5.6 Cyber | Cybersecurity                |            $12.50 / $75 |
| GPT-5.3 Codex | Code generation              |             $1.75 / $14 |

GPT-5.6 values are Standard short-context rates.

## Anthropic

| Model            | Family | Standard input / output |
| ---------------- | ------ | ----------------------: |
| Claude Fable 5   | Fable  |               $10 / $50 |
| Claude Mythos 5  | Mythos |               $10 / $50 |
| Claude Opus 5    | Opus   |                $5 / $25 |
| Claude Sonnet 5  | Sonnet |                $2 / $10 |
| Claude Haiku 4.5 | Haiku  |                 $1 / $5 |

## Gemini

| Model                  | Role                          | Standard input / output |
| ---------------------- | ----------------------------- | ----------------------: |
| Gemini 3.6 Flash       | General-purpose               |           $1.50 / $7.50 |
| Gemini 3.5 Flash       | General-purpose               |              $1.50 / $9 |
| Gemini 3.5 Flash-Lite  | Economical, high-volume       |           $0.30 / $2.50 |
| Gemini 3.1 Pro Preview | Pro preview, up to 200K input |                $2 / $12 |
| Gemini 2.5 Pro         | Pro, up to 200K input         |             $1.25 / $10 |
| Gemini 2.5 Flash       | General-purpose               |           $0.30 / $2.50 |
| Gemini 2.5 Flash-Lite  | Economical, high-volume       |           $0.10 / $0.40 |

Audio inputs and prompts over 200K tokens can use different rates.

## DeepSeek

| Model             | Role       | Uncached input / output |
| ----------------- | ---------- | ----------------------: |
| DeepSeek V4 Flash | Flash tier |           $0.14 / $0.28 |
| DeepSeek V4 Pro   | Pro tier   |          $0.435 / $0.87 |

DeepSeek cached-input rates are substantially lower and are documented in the provider guide.

## Cost calculation

All token rates above are USD per 1 million tokens.

```text
token_cost_usd =
  sum((billable_token_quantity / 1,000,000) * matching_token_rate)
```

Select the exact model, mode, context tier, modality, and cache category before applying the
formula. Add per-request, per-image, per-second, storage, runtime, and tool charges separately in
their published billing units.

## Provider guides

- [OpenAI full pricing reference](providers/openai.md)
- [Anthropic full pricing reference](providers/anthropic.md)
- [Gemini full pricing reference](providers/gemini.md)
- [DeepSeek full pricing reference](providers/deepseek.md)

## Source

- Sources: official provider pricing pages linked in each provider guide
- Retrieved: 2026-08-11T21:27:01+02:00 (Europe/Berlin)
- Unit: USD per 1 million tokens unless otherwise noted
