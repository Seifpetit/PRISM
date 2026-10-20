import { useMemo } from "react";
import { useAppStore } from "@/store/use-app-store";

export interface CampaignLabels {
  avatar: (id: string) => string;
  angle: (id: string) => string;
  offer: (id: string) => string;
}

/** Names for the persona, angle and offer ids a concept points at, for the active product. */
export function useCampaignLabels(): CampaignLabels {
  const activeProductId = useAppStore((state) => state.activeProductId);
  const avatars = useAppStore((state) => (activeProductId ? state.targetAvatarsByProduct[activeProductId] : undefined));
  const nodes = useAppStore((state) => state.nodes);
  return useMemo(() => {
    const avatarNames = new Map((avatars ?? []).map((avatar) => [avatar.id, avatar.label]));
    const nodeNames = new Map(nodes.map((node) => [node.id, node.label]));
    return {
      avatar: (id) => avatarNames.get(id) ?? "Removed persona",
      angle: (id) => nodeNames.get(id) ?? "Removed angle",
      offer: (id) => nodeNames.get(id) ?? "Removed offer",
    };
  }, [avatars, nodes]);
}
