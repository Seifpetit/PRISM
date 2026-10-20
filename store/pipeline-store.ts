import { create } from "zustand";
import { api, type PipelineTask } from "@/api/api";
import { moveInList, type PipelineStageId } from "@/lib/pipeline";
import { useAppStore } from "@/store/use-app-store";

const NONE: PipelineTask[] = [];
const message = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

interface PipelineState {
  tasksByProduct: Record<string, PipelineTask[]>;
  loaded: Record<string, boolean>;
  error: string | null;
  /** The task open in the pipeline's drawer. */
  selectedTaskId: string | null;
  /** A task that has just arrived on the board: it is scrolled to, focused and given a brief highlight. */
  freshTaskId: string | null;
  load: (productId: string) => Promise<void>;
  /** Sends an ad to the pipeline as a new task in Planned; resolves with it, or null if it could not be created. */
  send: (productId: string, ad: { id: string; reference: string }, variant?: string) => Promise<PipelineTask | null>;
  move: (productId: string, id: string, stage: PipelineStageId, index?: number) => Promise<void>;
  update: (productId: string, patch: Parameters<typeof api.updatePipelineTask>[0]) => Promise<void>;
  remove: (productId: string, id: string) => Promise<void>;
  select: (id: string | null) => void;
  /** Opens the Pipeline page on a task. With `arrived`, the task is also focused and briefly highlighted. */
  showTask: (id: string, arrived?: boolean) => void;
  clearFresh: () => void;
  dismissError: () => void;
}

export const usePipelineStore = create<PipelineState>((set, get) => {
  const replace = (productId: string, task: PipelineTask) =>
    set((state) => ({ tasksByProduct: { ...state.tasksByProduct, [productId]: (state.tasksByProduct[productId] ?? NONE).map((existing) => (existing.id === task.id ? task : existing)) } }));

  return {
    tasksByProduct: {},
    loaded: {},
    error: null,
    selectedTaskId: null,
    freshTaskId: null,
    load: async (productId) => {
      try {
        const tasks = await api.pipelineTasks({ productId });
        set((state) => ({ tasksByProduct: { ...state.tasksByProduct, [productId]: tasks }, loaded: { ...state.loaded, [productId]: true }, error: null }));
      } catch (error) {
        set({ error: message(error, "The pipeline could not be loaded.") });
      }
    },
    send: async (productId, ad, variant) => {
      try {
        const task = await api.createPipelineTask({ adId: ad.id, adRef: ad.reference, ...(variant?.trim() ? { variant: variant.trim() } : {}) });
        set((state) => ({ tasksByProduct: { ...state.tasksByProduct, [productId]: [...(state.tasksByProduct[productId] ?? NONE), task] }, loaded: { ...state.loaded, [productId]: true }, error: null }));
        return task;
      } catch (error) {
        set({ error: message(error, "The ad could not be sent to the pipeline.") });
        return null;
      }
    },
    // The board moves at once; if the server refuses, it goes back to what it was.
    move: async (productId, id, stage, index) => {
      const before = get().tasksByProduct[productId] ?? NONE;
      set((state) => ({ tasksByProduct: { ...state.tasksByProduct, [productId]: moveInList(before, id, stage, index ?? null) }, error: null }));
      try {
        replace(productId, await api.movePipelineTask({ id, stage, ...(index === undefined ? {} : { index }) }));
        // The server renumbers the whole column, so read it back rather than trust the guess.
        void get().load(productId);
      } catch (error) {
        set((state) => ({ tasksByProduct: { ...state.tasksByProduct, [productId]: before }, error: message(error, "The task could not be moved.") }));
      }
    },
    update: async (productId, patch) => {
      try {
        replace(productId, await api.updatePipelineTask(patch));
        set({ error: null });
      } catch (error) {
        set({ error: message(error, "The task could not be saved.") });
      }
    },
    remove: async (productId, id) => {
      try {
        await api.deletePipelineTask({ id });
        set((state) => ({
          tasksByProduct: { ...state.tasksByProduct, [productId]: (state.tasksByProduct[productId] ?? NONE).filter((task) => task.id !== id) },
          selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
          error: null,
        }));
      } catch (error) {
        set({ error: message(error, "The task could not be deleted.") });
      }
    },
    select: (id) => set({ selectedTaskId: id }),
    showTask: (id, arrived = false) => {
      set({ selectedTaskId: id, freshTaskId: arrived ? id : null });
      useAppStore.getState().setActiveTab("pipeline");
    },
    clearFresh: () => set({ freshTaskId: null }),
    dismissError: () => set({ error: null }),
  };
});

export const EMPTY_TASKS = NONE;
