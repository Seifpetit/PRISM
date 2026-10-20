export type ChildGenerationAnimationStyle = "prism-invocation";

export interface AnimateChildGenerationParams {
  parentNodeId: string;
  childNodeIds: string[];
  childEdgeIds: string[];
  duration?: number;
  onComplete?: () => void;
  root?: HTMLElement | null;
  signal?: AbortSignal;
  style?: ChildGenerationAnimationStyle;
}

const DEFAULT_DURATION = 650;
const CHARGE_DURATION = 500;
const CHILD_REVEAL_DELAY = 540;
const EDGE_REVEAL_DELAY = 600;
const REDUCED_MOTION_DURATION = 180;
const activeRuns = new WeakMap<HTMLElement, AbortController>();

function elementsByDataId<T extends HTMLElement | SVGGElement>(
  root: HTMLElement,
  selector: string,
  attribute: "id" | "generationEdgeId",
) {
  return new Map(
    Array.from(root.querySelectorAll<T>(selector)).flatMap((element) => {
      const value = attribute === "id" ? element.dataset.id : element.dataset.generationEdgeId;
      return value ? [[value, element] as const] : [];
    }),
  );
}

function schedule(timers: Set<number>, callback: () => void, delay: number) {
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    callback();
  }, delay);
  timers.add(timer);
}

function waitForAnimation(duration: number, signal: AbortSignal | undefined, timers: Set<number>) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Child generation animation aborted", "AbortError"));
      return;
    }
    const finish = () => {
      timers.delete(timer);
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const abort = () => {
      window.clearTimeout(timer);
      timers.delete(timer);
      reject(new DOMException("Child generation animation aborted", "AbortError"));
    };
    const timer = window.setTimeout(finish, duration);
    timers.add(timer);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

/**
 * Measures the parent once, then creates only three short-lived FX elements:
 * a perimeter charge, a port core, and a directional streak. No child geometry
 * is measured because canonical cards resolve in place.
 */
type InvocationGeometry = {
  chargeLeft: number;
  chargeTop: number;
  chargeWidth: number;
  chargeHeight: number;
  portX: number;
  portY: number;
};

function measureInvocationGeometry(root: HTMLElement, parent: HTMLElement): InvocationGeometry {
  // Keep all layout reads together before any animation-state writes.
  const rootRect = root.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  return {
    chargeLeft: parentRect.left - rootRect.left - 4,
    chargeTop: parentRect.top - rootRect.top - 4,
    chargeWidth: parentRect.width + 8,
    chargeHeight: parentRect.height + 8,
    portX: parentRect.right - rootRect.left,
    portY: parentRect.top + parentRect.height / 2 - rootRect.top,
  };
}

function createInvocationOverlay(root: HTMLElement, geometry: InvocationGeometry) {
  // All writes are made while detached, then committed with one append.
  const layer = document.createElement("div");
  layer.className = "prism-child-generation-overlay";
  layer.setAttribute("aria-hidden", "true");

  const charge = document.createElement("div");
  charge.className = "prism-child-generation-charge";
  charge.style.left = `${geometry.chargeLeft}px`;
  charge.style.top = `${geometry.chargeTop}px`;
  charge.style.width = `${geometry.chargeWidth}px`;
  charge.style.height = `${geometry.chargeHeight}px`;
  layer.appendChild(charge);

  const core = document.createElement("div");
  core.className = "prism-child-generation-port-core";
  core.style.left = `${geometry.portX - 9}px`;
  core.style.top = `${geometry.portY - 9}px`;
  layer.appendChild(core);

  const streak = document.createElement("div");
  streak.className = "prism-child-generation-streak";
  streak.style.left = `${geometry.portX + 3}px`;
  streak.style.top = `${geometry.portY - 1}px`;
  layer.appendChild(streak);

  root.appendChild(layer);
  return layer;
}

/**
 * Reveals canonical generated children at their final coordinates. The effect
 * never updates graph data, node positions, edge geometry, or the viewport.
 */
export async function animateChildGeneration({
  parentNodeId,
  childNodeIds,
  childEdgeIds,
  duration = DEFAULT_DURATION,
  onComplete,
  root = document.querySelector<HTMLElement>("[data-strategy-graph-root]"),
  signal,
  style = "prism-invocation",
}: AnimateChildGenerationParams): Promise<void> {
  const timers = new Set<number>();
  let overlay: HTMLElement | null = null;
  let childNodes: HTMLElement[] = [];
  let childEdges: SVGGElement[] = [];
  let runController: AbortController | null = null;
  let removeExternalAbortListener: (() => void) | null = null;

  const revealEverything = () => {
    childNodes.forEach((node) => {
      node.dataset.generationReveal = "visible";
      node.style.removeProperty("--prism-child-reveal-delay");
    });
    childEdges.forEach((edge) => (edge.dataset.generationReveal = "visible"));
  };

  try {
    if (!root || style !== "prism-invocation") return;

    // A new invocation for the same canvas supersedes the old visual-only run.
    // Each run still settles through its own finally block.
    activeRuns.get(root)?.abort();
    runController = new AbortController();
    activeRuns.set(root, runController);
    const abortFromExternalSignal = () => runController?.abort();
    if (signal?.aborted) runController.abort();
    else if (signal) {
      signal.addEventListener("abort", abortFromExternalSignal, { once: true });
      removeExternalAbortListener = () =>
        signal.removeEventListener("abort", abortFromExternalSignal);
    }

    const nodeById = elementsByDataId<HTMLElement>(root, ".react-flow__node[data-id]", "id");
    const edgeById = elementsByDataId<SVGGElement>(
      root,
      "[data-generation-edge-id]",
      "generationEdgeId",
    );
    const parent = nodeById.get(parentNodeId);
    childNodes = childNodeIds
      .map((id) => nodeById.get(id))
      .filter((node): node is HTMLElement => Boolean(node));
    childEdges = childEdgeIds
      .map((id) => edgeById.get(id))
      .filter((edge): edge is SVGGElement => Boolean(edge));
    if (!parent || childNodes.length !== childNodeIds.length) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const geometry = reducedMotion ? null : measureInvocationGeometry(root, parent);
    childNodes.forEach((node, index) => {
      node.dataset.generationReveal = "hidden";
      node.style.setProperty("--prism-child-reveal-delay", `${index * 50}ms`);
    });
    childEdges.forEach((edge) => (edge.dataset.generationReveal = "hidden"));

    if (reducedMotion) {
      childNodes.forEach((node) => (node.dataset.generationReveal = "revealing"));
      childEdges.forEach((edge) => (edge.dataset.generationReveal = "revealing"));
      await waitForAnimation(REDUCED_MOTION_DURATION, runController.signal, timers);
      return;
    }

    overlay = createInvocationOverlay(root, geometry!);
    schedule(
      timers,
      () => childNodes.forEach((node) => (node.dataset.generationReveal = "revealing")),
      CHILD_REVEAL_DELAY,
    );
    schedule(
      timers,
      () => childEdges.forEach((edge) => (edge.dataset.generationReveal = "revealing")),
      EDGE_REVEAL_DELAY,
    );

    // Keep the whole cue short; duration remains a caller-controlled hint, not
    // a second visual phase after the charge.
    const totalDuration = Math.max(1_000, Math.min(1_080, duration + 350));
    await waitForAnimation(Math.max(totalDuration, CHARGE_DURATION), runController.signal, timers);
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
  } finally {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
    removeExternalAbortListener?.();
    if (root && runController && activeRuns.get(root) === runController) activeRuns.delete(root);
    overlay?.remove();
    revealEverything();
    onComplete?.();
  }
}
