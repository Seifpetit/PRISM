import type { AiModelInput, GenerationContextRequest } from "@/api/api";
import { api } from "@/api/api";
import { mockRequest } from "@/services/mock-client";
import type {
  AudienceExploration,
  AngleExploration,
  AudienceNode,
  AngleNode,
  CreativeTypeNode,
  ExecutionNode,
  StrategyNode,
  LineageHistoryEvent,
  TargetAvatar,
  AvatarCanvas,
} from "@/types/strategy";

export async function getStrategy(input: {
  productId: string;
  lineageMode?: "strategy_lineage" | "creative_exploration";
}): Promise<StrategyNode[]> {
  return mockRequest(() => api.productStrategy(input), 220);
}
export async function getLineageHistory(input: { productId: string }): Promise<LineageHistoryEvent[]> { return api.lineageHistory(input); }
export async function deleteStrategySubtree(input: { nodeId: string }): Promise<LineageHistoryEvent> { return api.deleteStrategySubtree(input); }

export async function updateStrategyNodePosition(input: {
  nodeId: string;
  x: number;
  y: number;
}): Promise<boolean> {
  return api.updateStrategyNodePosition(input);
}

export async function generateCreativeExplorationAngles(input: {
  productId: string;
  ai?: AiModelInput;
  context?: GenerationContextRequest;
}): Promise<AngleNode[]> {
  return mockRequest(() => api.generateCreativeExplorationAngles(input));
}

export async function generateCreativeExplorationOffers(input: {
  productId: string;
  ai?: AiModelInput;
  context?: GenerationContextRequest;
}): Promise<StrategyNode[]> {
  return mockRequest(() => api.generateCreativeExplorationOffers(input));
}

export async function generateCreativeExplorationTargetAvatars(input: {
  productId: string;
  ai?: AiModelInput;
  count?: number;
  context?: GenerationContextRequest;
}): Promise<TargetAvatar[]> {
  return mockRequest(() => api.generateCreativeExplorationTargetAvatars(input));
}

export async function getTargetAvatars(input: { productId: string }): Promise<TargetAvatar[]> {
  return mockRequest(() => api.targetAvatars(input), 0);
}

export async function deleteTargetAvatarRemote(input: {
  productId: string;
  avatarId: string;
}): Promise<TargetAvatar[]> {
  return api.deleteTargetAvatar(input);
}

export async function resetTargetAvatarsRemote(input: { productId: string }): Promise<boolean> {
  return api.resetTargetAvatars(input);
}

export async function getAvatarCanvas(input: { productId: string }): Promise<AvatarCanvas | null> {
  return mockRequest(() => api.avatarCanvas(input), 0);
}

export async function saveAvatarCanvasRemote(input: {
  productId: string;
  canvas: AvatarCanvas;
}): Promise<boolean> {
  return api.saveAvatarCanvas(input);
}

