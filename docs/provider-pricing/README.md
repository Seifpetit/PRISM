# Provider pricing handbook

This folder contains human-facing pricing references for the AI providers used by the project. The
Markdown guides prioritize navigation and explanation; no application code parses them.

## Provider guides

| Provider  | Primary coverage                      | Guide                               |
| --------- | ------------------------------------- | ----------------------------------- |
| OpenAI    | Text, realtime, image, audio, tools   | [OpenAI](providers/openai.md)       |
| Anthropic | Claude models, caching, tools         | [Anthropic](providers/anthropic.md) |
| Gemini    | Text, media, audio, embeddings, tools | [Gemini](providers/gemini.md)       |
| DeepSeek  | V4 text models and caching            | [DeepSeek](providers/deepseek.md)   |
| Perplexity | Sonar token and search-context fees  | [Perplexity](providers/perplexity.md) |

For a compact comparison of the main current text models, see the
[cross-provider overview](normalized-token-rates.md).

## Reading the guides

- Token prices are USD per 1 million tokens unless a section states otherwise.
- Status labels separate current, preview, deprecated, and shut-down models.
- Per-call, per-image, per-second, storage, and tool charges retain their provider-specific billing
  units.
- Retrieval timestamps record when the official pricing page was inspected; they do not guarantee
  that a provider has kept a price unchanged.

## Structured snapshots

The adjacent JSON files retain the normalized pricing snapshots separately from the human
documentation. Editing a Markdown guide does not change a JSON rate.

Production cost tracking should record the catalog version used for each call, use provider-reported
usage quantities, and reconcile against provider billing exports for credits, taxes, discounts,
rounding, and hidden adjustments.

## Snapshot

- Prepared: 2026-08-11T21:27:01+02:00 (Europe/Berlin)
- Currency: USD unless a provider states otherwise
