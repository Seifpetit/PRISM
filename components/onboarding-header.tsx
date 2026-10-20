"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, Plug, Repeat, UserRound } from "lucide-react";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";
import type { AuthSession } from "@/types/auth";

/** Minimal header shown while there's no active product yet (onboarding / new product flow). */
export function OnboardingHeader({
  session,
  onSignOut,
}: {
  session: AuthSession;
  onSignOut: () => void;
}) {
  const user = session.user;
  const products = useAppStore((state) => state.products);
  const activeBrandId = useAppStore((state) => state.activeBrandId);
  const setActiveProduct = useAppStore((state) => state.setActiveProduct);
  const openSettings = useAppStore((state) => state.openSettings);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const logoutConfirmRef = useRef<HTMLButtonElement | null>(null);
  const brandProducts = products.filter((product) => product.brandId === activeBrandId);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        accountMenuOpen &&
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (logoutDialogOpen) setLogoutDialogOpen(false);
      else setAccountMenuOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [accountMenuOpen, logoutDialogOpen]);

  useEffect(() => {
    if (logoutDialogOpen) logoutConfirmRef.current?.focus();
  }, [logoutDialogOpen]);

  function returnToBrandStrategy() {
    const productId = brandProducts[0]?.id ?? null;
    if (productId) setActiveProduct(productId);
  }

  return h(
    "div",
    { className: "new-product-app-header contents" },
    h(
      "button",
      {
        type: "button",
        onClick: returnToBrandStrategy,
        className:
          "prism-home-button fixed left-5 top-5 z-[70] grid h-14 w-14 shrink-0 " +
          "place-items-center rounded-full border border-border-default bg-panel " +
          "shadow-[0_8px_20px_rgb(21_23_26/.12)] focus-visible:outline-none " +
          "focus-visible:ring-2 focus-visible:ring-lineage focus-visible:ring-offset-2",
        "aria-label": "Return to brand strategy workspace",
        title: "Brand strategy",
      },
      h("img", {
        src: "/landing/assets/logo.png",
        alt: "",
        className: "h-9 w-9 object-contain",
        "aria-hidden": true,
      }),
    ),
    h(
      "div",
      { ref: accountMenuRef, className: "fixed right-5 top-5 z-[70]" },
      h(
        "button",
        {
          type: "button",
          onClick: () => setAccountMenuOpen((current) => !current),
          className:
            "app-avatar-button grid h-11 w-11 place-items-center rounded-full border " +
            "border-border-default bg-panel text-[10px] font-bold text-ink " +
            "shadow-[0_8px_20px_rgb(21_23_26/.12)] hover:border-border-strong " +
            "hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 " +
            "focus-visible:ring-lineage",
          "aria-label": "Open user menu",
          "aria-haspopup": "menu",
          "aria-expanded": accountMenuOpen,
        },
        user.displayName
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      ),
      accountMenuOpen
        ? h(
            "div",
            {
              role: "menu",
              className:
                "absolute right-0 top-[calc(100%+8px)] z-[90] w-48 " +
                "overflow-hidden rounded-lg border border-border-default bg-panel " +
                "p-1.5 opacity-100 shadow-[0_12px_30px_rgb(21_23_26/.16)]",
            },
            h(
              "div",
              { className: "border-b border-border-subtle px-2.5 py-2" },
              h("p", { className: "text-xs font-semibold text-ink" }, user.displayName),
              h("p", { className: "mt-0.5 truncate text-[10px] text-muted" }, user.email),
              h(
                "p",
                { className: "mt-1 truncate text-[9px] uppercase tracking-wide text-muted" },
                `${session.workspace.name} · ${session.workspace.role}`,
              ),
            ),
            h(
              "button",
              {
                type: "button",
                role: "menuitem",
                onClick: () => {
                  setAccountMenuOpen(false);
                  openSettings("profile");
                },
                className:
                  "mt-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 " +
                  "text-left text-xs font-semibold text-ink hover:bg-canvas " +
                  "focus-visible:outline-none focus-visible:ring-2 " +
                  "focus-visible:ring-lineage",
              },
              h(UserRound, { size: 15, className: "text-muted" }),
              "My profile",
            ),
            h(
              "button",
              {
                type: "button",
                role: "menuitem",
                onClick: () => {
                  setAccountMenuOpen(false);
                  openSettings("integrations");
                },
                className:
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 " +
                  "text-left text-xs font-semibold text-ink hover:bg-canvas " +
                  "focus-visible:outline-none focus-visible:ring-2 " +
                  "focus-visible:ring-lineage",
              },
              h(Plug, { size: 15, className: "text-muted" }),
              "Integrations",
            ),
            h(
              "button",
              {
                type: "button",
                role: "menuitem",
                onClick: () => {
                  setAccountMenuOpen(false);
                  onSignOut();
                },
                className:
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 " +
                  "text-left text-xs font-semibold text-ink hover:bg-canvas " +
                  "focus-visible:outline-none focus-visible:ring-2 " +
                  "focus-visible:ring-lineage",
              },
              h(Repeat, { size: 15, className: "text-muted" }),
              "Switch account",
            ),
            h(
              "button",
              {
                type: "button",
                role: "menuitem",
                onClick: () => {
                  setAccountMenuOpen(false);
                  setLogoutDialogOpen(true);
                },
                className:
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left " +
                  "text-xs font-semibold text-red-700 hover:bg-red-50 " +
                  "focus-visible:outline-none focus-visible:ring-2 " +
                  "focus-visible:ring-red-300",
              },
              h(LogOut, { size: 15 }),
              "Log out",
            ),
          )
        : null,
    ),
    h(ConfirmationDialog, {
      open: logoutDialogOpen,
      title: "Log out of Prism?",
      description: "You would need to sign in again to return to this workspace.",
      confirmLabel: "Log out",
      onCancel: () => setLogoutDialogOpen(false),
      onConfirm: () => {
        setLogoutDialogOpen(false);
        onSignOut();
      },
    }),
  );
}
