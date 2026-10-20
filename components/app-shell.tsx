"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AvatarDetailPanel } from "@/components/avatar-detail-panel";
import { ControlAccentSync } from "@/components/control-accent-sync";
import { OnboardingHeader } from "@/components/onboarding-header";
import { DemoSignIn } from "@/components/demo-sign-in";
import { EmptyProduct } from "@/components/new-product/empty-product";
import { CreativesWorkspace } from "@/components/creatives/creatives-workspace";
import { PipelineView } from "@/components/pipeline/pipeline-view";
import { PerformanceView } from "@/components/performance/performance-view";
import { CampaignDrawer } from "@/components/campaign/campaign-drawer";
import { ComposerDrawer } from "@/components/campaign/composer-drawer";
import { ConceptDrawer } from "@/components/campaign/concept-drawer";
import { LineageGrammar } from "@/components/lineage-grammar";
import { LineageInspector } from "@/components/lineage-inspector";
import { IngredientPromptInspector } from "@/components/ingredient-prompt-inspector";
import { TargetAvatarInspector } from "@/components/target-avatar-inspector";
import { SettingsShell } from "@/components/settings/settings-shell";
import { StrategyCanvas } from "@/components/strategy-canvas";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";
import type { AuthSession } from "@/types/auth";
import { restoreSession, signInWithoutPassword, signOut } from "@/services/auth";

export function AppShell() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [identityReady, setIdentityReady] = useState(false);
  // TEMPORARY (dev-only): preview the sign-in page without actually signing
  // out, so it stays reachable from the dev onboarding stage nav. Remove once
  // onboarding is settled.
  const [devSignInPreview, setDevSignInPreview] = useState(false);
  const products = useAppStore((state) => state.products);
  const nodes = useAppStore((state) => state.nodes);
  const activeProductId = useAppStore((state) => state.activeProductId);
  const activeTab = useAppStore((state) => state.activeTab);
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const targetAvatarInspectorOpen = useAppStore((state) => state.targetAvatarInspectorOpen);
  const inspectorKind = useAppStore((state) => state.inspectorKind);
  const avatarDetailId = useAppStore((state) => state.avatarDetailId);
  const selectedAvatarId = useAppStore((state) => state.selectedAvatarId);
  const composerKind = useAppStore((state) => state.composerKind);
  const selectedConceptId = useAppStore((state) => state.selectedConceptId);
  const campaignPanelOpen = useAppStore((state) => state.campaignPanelOpen);
  const activeCampaignId = useAppStore((state) => state.activeCampaignId);
  const avatarCanvasByProduct = useAppStore((state) => state.avatarCanvasByProduct);
  const targetAvatarsByProduct = useAppStore((state) => state.targetAvatarsByProduct);
  const generationError = useAppStore((state) => state.generationError);
  const clearGenerationError = useAppStore((state) => state.clearGenerationError);
  const loadWorkspace = useAppStore((state) => state.loadWorkspace);
  const resetWorkspace = useAppStore((state) => state.resetWorkspace);
  const activeProduct = products.find((product) => product.id === activeProductId);
  const detailAvatar = activeProductId
    ? (targetAvatarsByProduct[activeProductId] ?? []).find((avatar) => avatar.id === avatarDetailId)
    : undefined;
  const selectedAvatarNode =
    activeProductId && selectedAvatarId
      ? (() => {
          const placed = Boolean(
            avatarCanvasByProduct[activeProductId]?.positions[selectedAvatarId],
          );
          const avatar = (targetAvatarsByProduct[activeProductId] ?? []).find(
            (item) => item.id === selectedAvatarId,
          );
          return placed && avatar ? avatar : undefined;
        })()
      : undefined;
  const productNodes = nodes.filter((node) => node.productId === activeProductId);
  // Strategy, Creatives and Performance fill the window and scroll inside themselves: their drawers can be as tall as the window and Performance can keep its range controls in view.
  const isFullHeightWorkspace = Boolean(activeProductId && activeProduct && (activeTab === "strategy" || activeTab === "creatives" || activeTab === "performance"));
  const showInspector = Boolean(
    selectedNodeId &&
    productNodes.some((node) => node.id === selectedNodeId) &&
    activeTab === "strategy",
  );

  useEffect(() => {
    void (async () => {
      const restored = await restoreSession();
      try {
        if (restored) await loadWorkspace();
        setSession(restored);
      } finally {
        setIdentityReady(true);
      }
    })();
  }, [loadWorkspace]);

  if (!identityReady) return h("div", { className: "min-h-screen bg-canvas" });
  if (!session || devSignInPreview)
    return h(
      "div",
      { className: "relative min-h-screen" },
      h(DemoSignIn, {
        onSignIn: async (input) => {
          const nextSession = await signInWithoutPassword(input);
          await loadWorkspace();
          setSession(nextSession);
          setDevSignInPreview(false);
        },
      }),
      // TEMPORARY (dev-only): escape hatch back out of the preview.
      process.env.NODE_ENV !== "production" && session && devSignInPreview
        ? h(
            "button",
            {
              type: "button",
              onClick: () => setDevSignInPreview(false),
              className:
                "fixed right-4 top-4 z-[100] rounded-full border border-[#DDE0E4] bg-white/95 " +
                "px-3 py-1.5 text-[10px] font-semibold text-muted shadow-[0_6px_16px_rgba(21,23,26,.16)] " +
                "backdrop-blur hover:text-ink",
            },
            "Exit sign-in preview",
          )
        : null,
    );

  return h(
    "div",
    {
      className: isFullHeightWorkspace
        ? "flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-canvas"
        : "min-h-screen bg-canvas",
    },
    h(ControlAccentSync, { userId: session.user.id }),
    activeProductId && activeProduct
      ? h(AppHeader, {
          session,
          onSignOut: async () => {
            await signOut();
            resetWorkspace();
            setSession(null);
          },
        })
      : h(OnboardingHeader, {
          session,
          onSignOut: async () => {
            await signOut();
            resetWorkspace();
            setSession(null);
          },
        }),
    generationError
      ? h(
          "div",
          {
            role: "alert",
            className:
              "fixed right-4 top-20 z-[80] flex max-w-sm items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800 shadow-lg",
          },
          h(AlertCircle, { size: 15, className: "mt-0.5 shrink-0" }),
          h("span", { className: "flex-1 leading-5" }, generationError),
          h(
            "button",
            {
              type: "button",
              onClick: clearGenerationError,
              className: "font-semibold underline",
              "aria-label": "Dismiss error",
            },
            "Dismiss",
          ),
        )
      : null,
    activeTab === "profile"
      ? h(SettingsShell, { session })
      : !activeProductId || !activeProduct
        ? h(EmptyProduct, {
            onDevPreviewSignIn:
              process.env.NODE_ENV !== "production" ? () => setDevSignInPreview(true) : undefined,
          })
        : h(
            "main",
            { className: "flex min-h-0 flex-1 flex-col overflow-hidden" },
            activeTab === "strategy"
              ? h(
                  "div",
                  { className: "flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row" },
                  h(
                    "div",
                    { className: "relative flex min-h-0 min-w-0 flex-1 flex-col" },
                    h(LineageGrammar),
                    h(StrategyCanvas, { productNodes }),
                  ),
                  composerKind
                    ? h(ComposerDrawer)
                    : selectedConceptId
                    ? h(ConceptDrawer, { key: selectedConceptId, conceptId: selectedConceptId })
                    : campaignPanelOpen && activeCampaignId
                      ? h(CampaignDrawer, { key: activeCampaignId, campaignId: activeCampaignId })
                      : showInspector
                        ? h(LineageInspector)
                        : (selectedAvatarNode ?? detailAvatar)
                          ? h(AvatarDetailPanel, { avatar: (selectedAvatarNode ?? detailAvatar)! })
                          : targetAvatarInspectorOpen
                            ? inspectorKind === "avatar"
                              ? h(TargetAvatarInspector)
                              : h(IngredientPromptInspector, { kind: inspectorKind })
                            : null,
                )
              : null,
            activeTab === "creatives"
              ? h("div", { className: "flex min-h-0 flex-1 flex-col overflow-hidden" }, h(CreativesWorkspace))
              : null,
            activeTab === "pipeline"
              ? h("div", { className: "flex min-h-0 flex-1 flex-col overflow-hidden" }, h(PipelineView, { productId: activeProductId, productName: activeProduct.name }))
              : null,
            activeTab === "performance"
              ? h(
                  "div",
                  { className: "min-h-0 flex-1 overflow-auto" },
                  h(PerformanceView, { productId: activeProductId, productName: activeProduct.name }),
                )
              : null,
          ),
  );
}
