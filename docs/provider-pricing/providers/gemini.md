# Gemini Developer API

Gemini pricing varies by model, modality, processing mode, prompt length, and cache usage.
General-purpose models come first; image, video, audio, embedding, robotics, and historical models
are separated below.

## Contents

- [At a glance](#at-a-glance)
- [General models](#general-models)
- [Image and video generation](#image-and-video-generation)
- [Live audio and text-to-speech](#live-audio-and-text-to-speech)
- [Embeddings](#embeddings)
- [Robotics and computer use](#robotics-and-computer-use)
- [Tools and agents](#tools-and-agents)
- [Processing modes](#processing-modes)
- [Caching](#caching)
- [Cost calculation](#cost-calculation)
- [Legacy and shut down](#legacy-and-shut-down)
- [Source](#source)

## At a glance

| Model                  | Role                          | Standard input / output |
| ---------------------- | ----------------------------- | ----------------------: |
| Gemini 3.6 Flash       | General-purpose               |           $1.50 / $7.50 |
| Gemini 3.5 Flash       | General-purpose               |              $1.50 / $9 |
| Gemini 3.5 Flash-Lite  | Economical, high-volume       |           $0.30 / $2.50 |
| Gemini 3.1 Pro Preview | Pro preview, up to 200K input |                $2 / $12 |
| Gemini 2.5 Pro         | Pro, up to 200K input         |             $1.25 / $10 |
| Gemini 2.5 Flash       | General-purpose               |           $0.30 / $2.50 |
| Gemini 2.5 Flash-Lite  | Economical, high-volume       |           $0.10 / $0.40 |

These are Standard rates in USD per 1 million tokens. Audio and long-prompt rates can differ and are
shown with each model.

## General models

### Gemini 3.6 Flash

**Current · General-purpose**

Model ID: `gemini-3.6-flash`

| Mode     | Input | Output | Cache read |
| -------- | ----: | -----: | ---------: |
| Standard | $1.50 |  $7.50 |      $0.15 |
| Batch    | $0.75 |  $3.75 |     $0.075 |
| Flex     | $0.75 |  $3.75 |     $0.075 |
| Priority | $2.70 | $13.50 |      $0.27 |

- Input rates apply to the listed modalities.
- Cache storage is $1 per 1 million cached tokens per hour in every mode.
- Output includes thinking tokens.

### Gemini 3.5 Flash

**Current · General-purpose**

Model ID: `gemini-3.5-flash`

| Mode     | Input | Output | Cache read |
| -------- | ----: | -----: | ---------: |
| Standard | $1.50 |     $9 |      $0.15 |
| Batch    | $0.75 |  $4.50 |     $0.075 |
| Flex     | $0.75 |  $4.50 |      $0.08 |
| Priority | $2.70 | $16.20 |      $0.27 |

- Cache storage is $1 per 1 million cached tokens per hour in every mode.
- Output includes thinking tokens.

### Gemini 3.5 Flash-Lite

**Current · Economical, high-volume**

Model ID: `gemini-3.5-flash-lite`

| Mode     | Input | Output | Cache read |
| -------- | ----: | -----: | ---------: |
| Standard | $0.30 |  $2.50 |      $0.03 |
| Batch    | $0.15 |  $1.25 |      $0.02 |
| Flex     | $0.15 |  $1.25 |      $0.02 |
| Priority | $0.54 |  $4.50 |      $0.05 |

- Input rates apply to text, image, video, and audio.
- Cache storage is $1 per 1 million cached tokens per hour in every mode.
- Output includes thinking tokens.

### Gemini 3.1 Flash-Lite

**Current**

Model ID: `gemini-3.1-flash-lite`

| Mode     | Text / image / video input | Audio input |
| -------- | -------------------------: | ----------: |
| Standard |                      $0.25 |       $0.50 |
| Batch    |                     $0.125 |       $0.25 |
| Flex     |                     $0.125 |       $0.25 |
| Priority |                      $0.45 |       $0.90 |

| Mode     | Output | Text / image / video cache read | Audio cache read |
| -------- | -----: | ------------------------------: | ---------------: |
| Standard |  $1.50 |                          $0.025 |            $0.05 |
| Batch    |  $0.75 |                         $0.0125 |           $0.025 |
| Flex     |  $0.75 |                         $0.0125 |           $0.025 |
| Priority |  $2.70 |                          $0.045 |            $0.09 |

Cache storage rates:

- Standard: $1 per 1 million cached tokens per hour
- Batch and Flex: $0.50 per 1 million cached tokens per hour
- Priority: $1.80 per 1 million cached tokens per hour

### Gemini 3.1 Pro Preview

**Preview**

Model IDs:

- `gemini-3.1-pro-preview`
- `gemini-3.1-pro-preview-customtools`

The input-length bracket selects all three token rates in a row.

#### Standard

| Usage      | Prompt up to 200K | Prompt over 200K |
| ---------- | ----------------: | ---------------: |
| Input      |                $2 |               $4 |
| Output     |               $12 |              $18 |
| Cache read |             $0.20 |            $0.40 |

Cache storage is $4.50 per 1 million cached tokens per hour.

#### Batch

| Usage      | Prompt up to 200K | Prompt over 200K |
| ---------- | ----------------: | ---------------: |
| Input      |                $1 |               $2 |
| Output     |                $6 |               $9 |
| Cache read |             $0.20 |            $0.40 |

Cache storage is $4.50 per 1 million cached tokens per hour.

#### Flex

| Usage      | Prompt up to 200K | Prompt over 200K |
| ---------- | ----------------: | ---------------: |
| Input      |                $1 |               $2 |
| Output     |                $6 |               $9 |
| Cache read |             $0.20 |            $0.40 |

Cache storage is $4.50 per 1 million cached tokens per hour.

#### Priority

| Usage      | Prompt up to 200K | Prompt over 200K |
| ---------- | ----------------: | ---------------: |
| Input      |             $3.60 |            $7.20 |
| Output     |            $21.60 |           $32.40 |
| Cache read |             $0.36 |            $0.72 |

Cache storage is $8.10 per 1 million cached tokens per hour.

### Gemini 3 Flash Preview

**Preview**

Model ID: `gemini-3-flash-preview`

| Mode     | Text / image / video input | Audio input | Output |
| -------- | -------------------------: | ----------: | -----: |
| Standard |                      $0.50 |          $1 |     $3 |
| Batch    |                      $0.25 |       $0.50 |  $1.50 |
| Flex     |                      $0.25 |       $0.50 |  $1.50 |
| Priority |                      $0.90 |       $1.80 |  $5.40 |

| Mode     | Text / image / video cache read | Audio cache read | Storage |
| -------- | ------------------------------: | ---------------: | ------: |
| Standard |                           $0.05 |            $0.10 |      $1 |
| Batch    |                           $0.05 |            $0.10 |      $1 |
| Flex     |                           $0.05 |            $0.10 |      $1 |
| Priority |                           $0.09 |            $0.18 |   $1.80 |

Storage is USD per 1 million cached tokens per hour.

### Gemini 2.5 Pro

**Current · Pro**

Model ID: `gemini-2.5-pro`

The input-length bracket selects all three token rates in a row.

#### Standard

| Usage      | Prompt up to 200K | Prompt over 200K |
| ---------- | ----------------: | ---------------: |
| Input      |             $1.25 |            $2.50 |
| Output     |               $10 |              $15 |
| Cache read |            $0.125 |            $0.25 |

Cache storage is $4.50 per 1 million cached tokens per hour.

#### Batch

| Usage      | Prompt up to 200K | Prompt over 200K |
| ---------- | ----------------: | ---------------: |
| Input      |            $0.625 |            $1.25 |
| Output     |                $5 |            $7.50 |
| Cache read |            $0.125 |            $0.25 |

Cache storage is $4.50 per 1 million cached tokens per hour.

#### Flex

| Usage      | Prompt up to 200K | Prompt over 200K |
| ---------- | ----------------: | ---------------: |
| Input      |            $0.625 |            $1.25 |
| Output     |                $5 |            $7.50 |
| Cache read |            $0.125 |            $0.25 |

Cache storage is $4.50 per 1 million cached tokens per hour.

#### Priority

| Usage      | Prompt up to 200K | Prompt over 200K |
| ---------- | ----------------: | ---------------: |
| Input      |             $2.25 |            $4.50 |
| Output     |               $18 |              $27 |
| Cache read |            $0.225 |            $0.45 |

Cache storage is $8.10 per 1 million cached tokens per hour.

### Gemini 2.5 Flash

**Current · General-purpose**

Model ID: `gemini-2.5-flash`

| Mode     | Text / image / video input | Audio input | Output |
| -------- | -------------------------: | ----------: | -----: |
| Standard |                      $0.30 |          $1 |  $2.50 |
| Batch    |                      $0.15 |       $0.50 |  $1.25 |
| Flex     |                      $0.15 |       $0.50 |  $1.25 |
| Priority |                      $0.54 |       $1.80 |  $4.50 |

| Mode     | Text / image / video cache read | Audio cache read | Storage |
| -------- | ------------------------------: | ---------------: | ------: |
| Standard |                           $0.03 |            $0.10 |      $1 |
| Batch    |                           $0.03 |            $0.10 |      $1 |
| Flex     |                           $0.03 |            $0.10 |      $1 |
| Priority |                          $0.054 |            $0.18 |   $1.80 |

Storage is USD per 1 million cached tokens per hour.

### Gemini 2.5 Flash-Lite

**Current · Economical, high-volume**

Model ID: `gemini-2.5-flash-lite`

| Mode     | Text / image / video input | Audio input | Output |
| -------- | -------------------------: | ----------: | -----: |
| Standard |                      $0.10 |       $0.30 |  $0.40 |
| Batch    |                      $0.05 |       $0.15 |  $0.20 |
| Flex     |                      $0.05 |       $0.15 |  $0.20 |
| Priority |                      $0.18 |       $0.54 |  $0.72 |

| Mode     | Text / image / video cache read | Audio cache read | Storage |
| -------- | ------------------------------: | ---------------: | ------: |
| Standard |                           $0.01 |            $0.03 |      $1 |
| Batch    |                           $0.01 |            $0.03 |      $1 |
| Flex     |                           $0.01 |            $0.03 |      $1 |
| Priority |                          $0.018 |           $0.054 |   $1.80 |

Storage is USD per 1 million cached tokens per hour.

### Gemini 2.5 Flash-Lite Preview

**Preview**

Model ID: `gemini-2.5-flash-lite-preview-09-2025`

This preview has the same Standard, Batch, Flex, Priority, cache-read, and cache-storage rates as
Gemini 2.5 Flash-Lite above.

## Image and video generation

### Gemini Omni Flash Preview

**Preview · Video generation and editing**

Model ID: `gemini-omni-flash-preview`

| Usage                 | Standard rate |
| --------------------- | ------------: |
| Input, all modalities |         $1.50 |
| Text output           |            $9 |
| Video output          |        $17.50 |

Video output is billed at 5,792 tokens per second of 720p video, approximately $0.10 per second at
Standard pricing.

### Gemini 3.1 Flash Image

**Current**

Model ID: `gemini-3.1-flash-image`

| Usage              | Standard | Batch |
| ------------------ | -------: | ----: |
| Text / image input |    $0.50 | $0.25 |
| Text output        |       $3 | $1.50 |
| Image output       |      $60 |   $30 |

Per-image output prices:

| Size | Standard |  Batch |
| ---- | -------: | -----: |
| 0.5K |   $0.045 | $0.022 |
| 1K   |   $0.067 | $0.034 |
| 2K   |   $0.101 | $0.050 |
| 4K   |   $0.151 | $0.076 |

### Gemini 3.1 Flash-Lite Image

**Current**

Model ID: `gemini-3.1-flash-lite-image`

| Usage                      | Standard |  Batch |
| -------------------------- | -------: | -----: |
| Text / image / video input |    $0.25 | $0.125 |
| Text output                |    $1.50 |  $0.75 |
| Image output               |      $30 |    $15 |

A 1K output image costs $0.0336 in Standard mode or $0.0168 in Batch.

### Gemini 3 Pro Image

**Current**

Model ID: `gemini-3-pro-image`

| Mode     | Input                       | Text output |          Image output |
| -------- | --------------------------- | ----------: | --------------------: |
| Standard | Text / image $2             |         $12 |                  $120 |
| Batch    | Text $1; image $0.0006 each |          $6 | Per-image rates below |
| Flex     | Text $1; image $0.0006 each |          $6 | Per-image rates below |
| Priority | Text / image $3.60          |      $21.60 |                  $216 |

Standard image input is set at 560 tokens, approximately $0.0011 per image.

Per-image output prices:

| Size     | Standard | Batch / Flex |
| -------- | -------: | -----------: |
| 1K or 2K |   $0.134 |       $0.067 |
| 4K       |    $0.24 |        $0.12 |

### Gemini 2.5 Flash Image

**Preview**

Model ID: `gemini-2.5-flash-image`

| Mode     | Text / image input | Image output |
| -------- | -----------------: | -----------: |
| Standard |              $0.30 |  $0.039 each |
| Batch    |              $0.15 | $0.0195 each |
| Flex     |              $0.15 | $0.0195 each |
| Priority |              $0.54 | $0.0702 each |

Image output is priced at $30 per 1 million tokens. An image up to 1024x1024 uses 1,290 tokens,
producing the Standard per-image estimate above.

### Veo 3.1

**Preview · Video generation**

Model IDs:

- `veo-3.1-generate-preview`
- `veo-3.1-fast-generate-preview`
- `veo-3.1-lite-generate-preview`

| Tier     |           720p |          1080p |             4K |
| -------- | -------------: | -------------: | -------------: |
| Standard | $0.40 / second | $0.40 / second | $0.60 / second |
| Fast     | $0.10 / second | $0.12 / second | $0.30 / second |
| Lite     | $0.05 / second | $0.08 / second |  Not published |

### Lyria 3

**Preview · Music generation**

| Model                  | Output         |        Price |
| ---------------------- | -------------- | -----------: |
| `lyria-3-clip-preview` | 30-second clip | $0.04 / song |
| `lyria-3-pro-preview`  | Full song      | $0.08 / song |

## Live audio and text-to-speech

### Gemini 3.5 Live Translate

**Preview**

Model ID: `gemini-3.5-live-translate-preview`

| Usage        | Token rate | Approximate minute rate |
| ------------ | ---------: | ----------------------: |
| Audio input  |      $3.50 |                 $0.0053 |
| Audio output |        $21 |                 $0.0315 |

Audio is billed at 25 tokens per second, approximately $0.0368 per minute for combined input and
output.

### Gemini 3.1 Flash Live

**Preview**

Model ID: `gemini-3.1-flash-live-preview`

| Modality      | Input |        Output |
| ------------- | ----: | ------------: |
| Text          | $0.75 |         $4.50 |
| Audio         |    $3 |           $12 |
| Image / video |    $1 | Not published |

- Effective audio input: approximately $0.005 per minute.
- Effective audio output: approximately $0.018 per minute.
- Effective image/video input: approximately $0.002 per minute.

### Gemini 2.5 Flash Native Audio

**Preview**

Model ID: `gemini-2.5-flash-native-audio-preview-12-2025`

| Modality                          | Input | Output |
| --------------------------------- | ----: | -----: |
| Text                              | $0.50 |     $2 |
| Audio / video input; audio output |    $3 |    $12 |

### Text-to-speech models

**Preview**

| Model                          | Standard input / output | Batch input / output |
| ------------------------------ | ----------------------: | -------------------: |
| `gemini-3.1-flash-tts-preview` |                $1 / $20 |          $0.50 / $10 |
| `gemini-2.5-flash-preview-tts` |             $0.50 / $10 |           $0.25 / $5 |
| `gemini-2.5-pro-preview-tts`   |                $1 / $20 |          $0.50 / $10 |

Input is text and output is audio. Gemini 3.1 Flash TTS audio output is billed at 25 tokens per
second.

## Embeddings

### Gemini Embedding 2

**Current · Input only**

Model ID: `gemini-embedding-2`

| Modality    | Standard |  Batch |
| ----------- | -------: | -----: |
| Text input  |    $0.20 |  $0.10 |
| Image input |    $0.45 | $0.225 |
| Audio input |    $6.50 |  $3.25 |
| Video input |      $12 |     $6 |

Equivalent direct rates:

- Image: $0.00012 each Standard; $0.00006 Batch
- Audio: $0.00016 per second Standard; $0.00008 Batch
- Video: $0.00079 per frame Standard; $0.000395 Batch

### Gemini Embedding 001

**Current · Input only**

Model ID: `gemini-embedding-001`

| Mode     | Input price |
| -------- | ----------: |
| Standard |       $0.15 |
| Batch    |      $0.075 |

## Robotics and computer use

### Gemini Robotics ER 2 Preview

**Preview**

Model ID: `gemini-robotics-er-2-preview`

| Usage                 | Standard | Batch |
| --------------------- | -------: | ----: |
| Input, all modalities |       $2 |    $1 |
| Output                |      $10 |    $5 |
| Cache read            |    $0.20 | $0.10 |

Cache storage is $1 per 1 million cached tokens per hour.

### Gemini Robotics ER 2 Streaming Preview

**Preview**

Model ID: `gemini-robotics-er-2-streaming-preview`

| Usage                 | Standard |
| --------------------- | -------: |
| Input, all modalities |       $2 |
| Output                |      $10 |

### Gemini Robotics ER 1.6 Preview

**Preview**

Model ID: `gemini-robotics-er-1.6-preview`

| Modality             | Standard input | Batch input |
| -------------------- | -------------: | ----------: |
| Text / image / video |             $1 |       $0.50 |
| Audio                |             $2 |          $1 |

| Usage  | Standard | Batch |
| ------ | -------: | ----: |
| Output |       $5 | $2.50 |

### Gemini 2.5 Computer Use Preview

**Preview**

Model ID: `gemini-2.5-computer-use-preview-10-2025`

| Usage  | Prompt up to 200K | Prompt over 200K |
| ------ | ----------------: | ---------------: |
| Input  |             $1.25 |            $2.50 |
| Output |               $10 |              $15 |

### Gemma 4

**Free tier only**

Model ID: `gemma-4`

Input, output, and cache reads are free. No paid API rate is published.

## Tools and agents

### Search and Maps

| Tool                     |        Price after allowance | Free allowance                             |
| ------------------------ | ---------------------------: | ------------------------------------------ |
| Gemini 3 Google Search   |         $14 / 1,000 requests | 5,000 requests per month across Gemini 3   |
| Gemini 2.5 Google Search | $35 / 1,000 grounded prompts | 1,500 per day where listed                 |
| Google Maps              | $25 / 1,000 grounded prompts | 1,500 per day; 10,000 for Pro where listed |

A customer request may issue multiple Google Search queries. Billing follows the provider's metered
request or grounded-prompt quantity.

### Token-billed tools

- Code execution uses the selected model's rates. Generated code and results are output tokens;
  reused results are input tokens.
- URL Context is charged as input tokens at the selected model's input rate.
- Computer Use context is charged at the selected model's token rates.
- File Search embeddings cost $0.15 per 1 million tokens. Retrieved document tokens use the selected
  model's regular token rates.
- The Custom Tools endpoint uses Gemini 3.1 Pro Preview rates.

### Agents

Deep Research and managed-agent inference bills the underlying model's input, output, intermediate
input, and reasoning tokens. Tool calls use their normal tool prices. Managed-agent environment
compute is free during the preview period.

Google AI Studio usage is free in regions where that free access is available.

## Processing modes

### Standard

Standard is the baseline synchronous price shown for each model.

### Batch

Batch commonly reduces model token rates by 50%, but calculations must use the exact Batch row
published for the selected model.

### Flex

Flex uses the exact published Flex rate. It can share token prices with Batch while retaining a
different cache-read or storage rate.

### Priority

Priority uses the higher published Priority rate for the selected model.

## Caching

Cached-context reads and cache storage are separate charges:

- Cache read is charged per 1 million cached tokens used by a request.
- Cache storage is charged per 1 million stored cached tokens per hour.
- Storage rates vary by model and processing mode.
- PDF and document tokens use the image-token rate and appear as document prompt-token details.

Do not charge the same cached token as both fresh input and cached input. Use the category-specific
usage quantities returned by the provider.

## Cost calculation

```text
cost_usd =
  (fresh_input_tokens / 1,000,000) * input_rate
  + (cached_input_tokens / 1,000,000) * cache_read_rate
  + (output_tokens_including_thinking / 1,000,000) * output_rate
  + (stored_cached_tokens / 1,000,000) * cache_hours * storage_rate
  + tool_charges
  + generated_media_charges
```

Select the model, modality, processing mode, and prompt-length bracket before applying the formula.

Example for Gemini 3.6 Flash Standard with 100,000 fresh input tokens and 20,000 output tokens:

```text
input  = 100,000 / 1,000,000 * $1.50 = $0.15
output =  20,000 / 1,000,000 * $7.50 = $0.15
total  = $0.30
```

## Legacy and shut down

### Gemini 2.0 Flash

**Shut down on 2026-06-01**

Model ID: `gemini-2.0-flash`

| Usage                           | Standard |  Batch |
| ------------------------------- | -------: | -----: |
| Text / image / video input      |    $0.10 |  $0.05 |
| Audio input                     |    $0.70 |  $0.35 |
| Output                          |    $0.40 |  $0.20 |
| Text / image / video cache read |   $0.025 | $0.025 |
| Audio cache read                |   $0.175 | $0.175 |

Cache storage was $1 per 1 million cached tokens per hour.

### Gemini 2.0 Flash-Lite

**Shut down on 2026-06-01**

Model ID: `gemini-2.0-flash-lite`

| Usage  | Standard |   Batch |
| ------ | -------: | ------: |
| Input  |   $0.075 | $0.0375 |
| Output |    $0.30 |   $0.15 |

### Imagen 4

**Deprecated · Scheduled shutdown 2026-08-17**

| Model                           | Price per image |
| ------------------------------- | --------------: |
| `imagen-4.0-fast-generate-001`  |           $0.02 |
| `imagen-4.0-generate-001`       |           $0.04 |
| `imagen-4.0-ultra-generate-001` |           $0.06 |

### Veo 3

**Shut down on 2026-06-30**

Model IDs:

- `veo-3.0-generate-001`
- `veo-3.0-fast-generate-001`

| Published variant |          Price |
| ----------------- | -------------: |
| Standard          | $0.40 / second |
| Fast, 720p        | $0.10 / second |
| Fast, 1080p       | $0.12 / second |
| Fast, 4K          | $0.30 / second |

### Veo 2

**Shut down on 2026-06-30**

Model ID: `veo-2.0-generate-001`

Generated video cost $0.35 per second.

## Source

- Official pricing page: https://ai.google.dev/gemini-api/docs/pricing
- Retrieved: 2026-08-11T21:27:01+02:00 (Europe/Berlin)
- Unit: USD per 1 million tokens unless otherwise noted
