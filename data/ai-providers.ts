import type { AiProvider } from "@/types/strategy";

export const AI_PROVIDER_META: Record<
  AiProvider,
  {
    label: string;
    shortLabel: string;
    iconUrl: string;
    docsUrl: string;
    accent: string;
    soft: string;
  }
> = {
  openai: {
    label: "OpenAI",
    shortLabel: "OpenAI",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/simple-icons/15.16.0/openai.svg",
    docsUrl: "https://platform.openai.com/docs/api-reference/models",
    accent: "#10A37F",
    soft: "#E8F7F2",
  },
  anthropic: {
    label: "Anthropic",
    shortLabel: "Claude",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/simple-icons/15.16.0/anthropic.svg",
    docsUrl: "https://platform.claude.com/docs/en/api/models",
    accent: "#D97757",
    soft: "#FDF0EB",
  },
  deepseek: {
    label: "DeepSeek",
    shortLabel: "DeepSeek",
    iconUrl: "/provider-icons/deepseek.svg",
    docsUrl: "https://api-docs.deepseek.com/",
    accent: "#4D6BFE",
    soft: "#EDF1FF",
  },
  gemini: {
    label: "Google Gemini",
    shortLabel: "Gemini",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/simple-icons/15.16.0/googlegemini.svg",
    docsUrl: "https://ai.google.dev/api/models",
    accent: "#4285F4",
    soft: "#EDF4FF",
  },
  perplexity: {
    label: "Perplexity",
    shortLabel: "Perplexity",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/simple-icons/15.16.0/perplexity.svg",
    docsUrl: "https://docs.perplexity.ai/api-reference/models-get",
    accent: "#20808D",
    soft: "#E8F6F7",
  },
};
