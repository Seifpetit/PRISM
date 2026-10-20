import * as anthropic from "./anthropic.mjs";
import * as deepseek from "./deepseek.mjs";
import * as gemini from "./gemini.mjs";
import * as openai from "./openai.mjs";
import * as openaiImage from "./openai-image.mjs";
import * as perplexity from "./perplexity.mjs";

export const builtInProviders = new Map([
  [openai.name, openai],
  [openaiImage.name, openaiImage],
  [anthropic.name, anthropic],
  [deepseek.name, deepseek],
  [gemini.name, gemini],
  [perplexity.name, perplexity],
]);
