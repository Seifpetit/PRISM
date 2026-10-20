"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { BarChart3, Compass, Database, Globe, Images, KanbanSquare, LogOut, Plug, Plus, Repeat, UserRound, type LucideIcon } from "lucide-react";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { NotesButton } from "@/components/notes-button";
import { Select } from "@/components/ui/select";
import { h } from "@/lib/h";
import { ThemeControl } from "@/components/theme-provider";
import { useAppStore } from "@/store/use-app-store";
import type { AuthSession } from "@/types/auth";
import type { AppTab } from "@/types/strategy";

const productTabs: Array<{ id: AppTab; label: string; icon: LucideIcon }> = [
  { id: "strategy", label: "Strategy", icon: Compass },
  { id: "creatives", label: "Creatives", icon: Images },
  { id: "pipeline", label: "Pipeline", icon: KanbanSquare },
  { id: "performance", label: "Performance", icon: BarChart3 },
];

export function AppHeader({
  session,
  onSignOut,
}: {
  session: AuthSession;
  onSignOut: () => void;
}) {
  const user = session.user;
  const products = useAppStore((state) => state.products);
  const activeBrandId = useAppStore((state) => state.activeBrandId);
  const activeProductId = useAppStore((state) => state.activeProductId);
  const activeTab = useAppStore((state) => state.activeTab);
  const setActiveProduct = useAppStore((state) => state.setActiveProduct);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
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
    const productId = activeProductId ?? brandProducts[0]?.id ?? null;
    if (productId) setActiveProduct(productId);
    else setActiveTab("strategy");
  }

  const selector = (
    labelText: string,
    value: string,
    onChange: (value: string) => void,
    options: Array<{ id: string; name: string }>,
    prominent = false,
    placeholder?: string,
  ) =>
    h(
      "div",
      {
        className: `header-select group relative flex min-w-0 items-center ${prominent ? "is-product" : ""}`,
      },
      h("span", { className: "header-select-label", "aria-hidden": true }, labelText),
      h(Select, {
        ariaLabel: labelText,
        value,
        onChange,
        options: options.map((option) => ({ value: option.id, label: option.name })),
        chevronSize: 14,
        placeholder,
        wrapperClassName: `flex-1 ${prominent ? "sm:max-w-[340px]" : "sm:max-w-[190px]"}`,
        className: "header-select-button w-full font-semibold text-ink focus-visible:outline-none",
      }),
    );

  return h(
    "header",
    {
      className: [
        !activeProductId ? "new-product-app-header" : "",
        "app-header-neu",
        "relative grid h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b",
        "border-border-default bg-panel px-3 sm:px-5",
      ]
        .filter(Boolean)
        .join(" "),
    },
    h(
      "div",
      { className: "flex min-w-0 items-center gap-2" },

      h(
        "button",
        {
          type: "button",
          onClick: returnToBrandStrategy,
          className:
            "prism-home-button mr-2 grid h-[52px] w-[52px] shrink-0 place-items-center " +
            "rounded-md focus-visible:outline-none focus-visible:ring-2 " +
            "focus-visible:ring-lineage focus-visible:ring-offset-2",
          "aria-label": "Return to brand strategy workspace",
          title: "Brand strategy",
        },
        h("img", {
          src: "/landing/assets/logo.png",
          alt: "",
          className: "h-[42px] w-[42px] object-contain",
          "aria-hidden": true,
        }),
      ),

      selector(
        "Product",
        activeProductId ?? "",
        (value) => setActiveProduct(value || null),
        brandProducts,
        true,
        "Select product",
      ),

      activeProductId && activeTab !== "profile"
        ? h(
            "button",
            {
              type: "button",
              onClick: () => setActiveProduct(null),
              className:
                "header-new-product prism-anchor-action h-[42px] min-w-[42px] shrink-0 justify-center whitespace-nowrap px-3 text-xs font-semibold text-ink " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage focus-visible:ring-offset-2",
              title: "Start a new product",
              "aria-label": "New product",
            },
            h(Plus, { size: 14, className: "prism-anchor-action-icon" }),
            h("span", { className: "prism-anchor-action-label hidden min-[1280px]:inline" }, "New product"),
          )
        : null,
    ),
    activeProductId && activeTab !== "profile"
      ? h(
          "nav",
          {
            className: "app-nav-bar flex items-center gap-1 whitespace-nowrap",
            "aria-label": "Product views",
          },
          ...productTabs.map((tab) =>
            h(
              "button",
              {
                key: tab.id,
                type: "button",
                onClick: () => setActiveTab(tab.id),
                className: `app-nav-tab ${activeTab === tab.id ? "is-active" : ""}`,
                "aria-current": activeTab === tab.id ? "page" : undefined,
              },
              h(tab.icon, { size: 16, strokeWidth: 2, "aria-hidden": true }),
              h("span", { className: "text-[11px] font-semibold leading-none" }, tab.label),
            ),
          ),
        )
      : h("div", { "aria-hidden": true }),
    h(
      "div",
      { className: "flex shrink-0 items-center justify-self-end gap-1.5 sm:gap-2" },
      process.env.NODE_ENV !== "production" && activeProductId
        ? h(
            "a",
            {
              href: "/landing/index.html",
              target: "_blank",
              rel: "noreferrer",
              className:
                "header-landing-button grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border-default " +
                "text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
              "aria-label": "Open the landing page",
              title: "Landing page (opens in a new tab)",
            },
            h(Globe, { size: 16, "aria-hidden": true }),
          )
        : null,
      h(NotesButton),
      h(ThemeControl),
      h(
        "div",
        { ref: accountMenuRef, className: "relative ml-0.5" },
        h(
          "button",
          {
            type: "button",
            onClick: () => setAccountMenuOpen((current) => !current),
            className:
              "app-avatar-button grid h-8 w-8 place-items-center rounded-full border " +
              "border-border-default bg-bg-input text-[10px] font-bold text-ink " +
              "hover:border-border-strong hover:bg-bg-elevated " +
              "focus-visible:outline-none focus-visible:ring-2 " +
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
                  "account-menu absolute right-0 top-[calc(100%+8px)] z-[90] w-48 " +
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
                    openSettings("data");
                  },
                  className:
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-2 " +
                    "text-left text-xs font-semibold text-ink hover:bg-canvas " +
                    "focus-visible:outline-none focus-visible:ring-2 " +
                    "focus-visible:ring-lineage",
                },
                h(Database, { size: 15, className: "text-muted" }),
                "Data",
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
    ),
    h(ConfirmationDialog, { open: logoutDialogOpen, title: "Log out of Prism?", description: "You would need to sign in again to return to this workspace.", confirmLabel: "Log out", onCancel: () => setLogoutDialogOpen(false), onConfirm: () => { setLogoutDialogOpen(false); onSignOut(); } }),
  );
}
