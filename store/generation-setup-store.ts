import { create } from "zustand";
import type { GenerationContextRequest } from "@/api/api";
import {
  contextRequest,
  instructionKey,
  MAX_INSTRUCTIONS,
  readSelections,
  saveSelections,
  toggled,
  type GeneratorId,
  type Selections,
} from "@/lib/generation-setup";

interface GenerationSetupState {
  /** Selected library sources per product and generator; remembered across reloads. */
  selections: Selections;
  /** Instructions for the next run of a generator on a product; kept in memory and cleared once a run has used them. */
  instructions: Record<string, string>;
  select: (productId: string, generator: GeneratorId, ids: string[]) => void;
  toggle: (productId: string, generator: GeneratorId, id: string) => void;
  /** Takes a source out of every selection of a product, after it was deleted. */
  forget: (productId: string, id: string) => void;
  setInstructions: (productId: string, generator: GeneratorId, text: string) => void;
  /** The context to send with a generation of this generator on this product, or undefined when nothing was chosen. */
  requestFor: (productId: string, generator: GeneratorId) => GenerationContextRequest | undefined;
  /** A run used its instructions: they were for that run only. */
  finishRun: (productId: string, generator: GeneratorId) => void;
}

export const useGenerationSetup = create<GenerationSetupState>((set, get) => ({
  selections: readSelections(),
  instructions: {},
  select: (productId, generator, ids) =>
    set((state) => {
      const selections = { ...state.selections, [productId]: { ...state.selections[productId], [generator]: ids } };
      saveSelections(selections);
      return { selections };
    }),
  toggle: (productId, generator, id) => get().select(productId, generator, toggled(get().selections[productId]?.[generator] ?? [], id)),
  forget: (productId, id) =>
    set((state) => {
      const current = state.selections[productId];
      if (!current) return {};
      const next = Object.fromEntries(Object.entries(current).map(([generator, ids]) => [generator, (ids ?? []).filter((value) => value !== id)]));
      const selections = { ...state.selections, [productId]: next };
      saveSelections(selections);
      return { selections };
    }),
  setInstructions: (productId, generator, text) =>
    set((state) => ({ instructions: { ...state.instructions, [instructionKey(productId, generator)]: text.slice(0, MAX_INSTRUCTIONS) } })),
  requestFor: (productId, generator) => {
    const state = get();
    return contextRequest(state.selections[productId]?.[generator] ?? [], state.instructions[instructionKey(productId, generator)] ?? "");
  },
  finishRun: (productId, generator) =>
    set((state) => {
      const key = instructionKey(productId, generator);
      if (!state.instructions[key]) return {};
      const instructions = { ...state.instructions };
      delete instructions[key];
      return { instructions };
    }),
}));
