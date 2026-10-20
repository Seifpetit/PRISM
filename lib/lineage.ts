import { STRATEGY_TYPES, type StrategyNode, type StrategyNodeType } from "@/types/strategy";

export function getLineage(nodeId: string, nodes: StrategyNode[]): StrategyNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const lineage: StrategyNode[] = [];
  const visited = new Set<string>();
  let current = byId.get(nodeId);

  while (current && !visited.has(current.id)) {
    lineage.unshift(current);
    visited.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return lineage;
}

export function getDescendantIds(nodeId: string, nodes: StrategyNode[]): Set<string> {
  const descendants = new Set<string>();
  const queue = [nodeId];
  while (queue.length) {
    const parentId = queue.shift()!;
    nodes.forEach((node) => {
      if (node.parentId === parentId && !descendants.has(node.id)) {
        descendants.add(node.id);
        queue.push(node.id);
      }
    });
  }
  return descendants;
}

export function getChildren(nodeId: string, nodes: StrategyNode[]): StrategyNode[] {
  return nodes.filter((node) => node.parentId === nodeId);
}

export function getNextType(type: StrategyNodeType): StrategyNodeType | null {
  const index = (STRATEGY_TYPES as readonly string[]).indexOf(type);
  return index >= 0 && index < STRATEGY_TYPES.length - 1 ? STRATEGY_TYPES[index + 1] : null;
}

export function getTypeLabel(type: StrategyNodeType, plural = false): string {
  const labels: Record<StrategyNodeType, [string, string]> = {
    product: ["Product", "Products"],
    audience: ["Audience", "Audiences"],
    angle: ["Angle", "Angles"],
    creativeType: ["Creative type", "Creative types"],
    execution: ["Execution", "Executions"],
    creative: ["Creative", "Creatives"],
    creativeConcept: ["Creative concept", "Creative concepts"],
    offer: ["Offer", "Offers"],
  };
  return labels[type][plural ? 1 : 0];
}

export function getGenerationLabel(type: StrategyNodeType): string | null {
  const next = getNextType(type);
  return next ? `Generate ${getTypeLabel(next, true).toLowerCase()}` : null;
}

export function getGenerationActionLabel(type: StrategyNodeType): string | null {
  return getGenerationLabel(type);
}
