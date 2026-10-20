"use client";

// Post-review onboarding step: "have you tested this product yet?" branching
// into either placeholder ad/fulfillment integrations, or a lightweight
// first-offer capture. Frontend-only for now — no integration is real yet.

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { h } from "@/lib/h";
import { api } from "@/api/api";
import { AD_INTEGRATIONS, FULFILLMENT_INTEGRATIONS, type IntegrationDef } from "@/lib/integrations";

type Step = "tested" | "ads" | "fulfillment" | "offer-question" | "offer-form";

function OnboardCard({
  wide,
  children,
}: {
  wide?: boolean;
  children?: React.ReactNode;
}) {
  return h(
    "main",
    { className: "onboard-signin is-overlay" },
    h("section", { className: `onboard-signin-card${wide ? " is-wide" : ""}` }, children),
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return h(
    "button",
    { type: "button", className: "onboard-back-link", onClick },
    h(ArrowLeft, { size: 12, "aria-hidden": true }),
    "Back",
  );
}

function YesNoQuestion({
  title,
  sub,
  onBack,
  onYes,
  onNo,
}: {
  title: string;
  sub: string;
  onBack?: () => void;
  onYes: () => void;
  onNo: () => void;
}) {
  return h(
    OnboardCard,
    null,
    onBack ? h(BackLink, { onClick: onBack }) : null,
    h("img", { src: "/landing/assets/logo.png", alt: "", className: "onboard-signin-mark", "aria-hidden": true }),
    h("h1", null, title),
    h("p", { className: "onboard-signin-sub" }, sub),
    h(
      "div",
      { className: "onboard-choice-row" },
      h("button", { type: "button", className: "onboard-choice-button", onClick: onYes }, "Yes"),
      h("button", { type: "button", className: "onboard-choice-button", onClick: onNo }, "No"),
    ),
  );
}

function IntegrationRow({
  def,
  connected,
  checking,
  onToggle,
}: {
  def: IntegrationDef;
  /** Ignored for def.disabled; for backend-checked ids this reflects a real env-key check. */
  connected: boolean;
  checking?: boolean;
  onToggle: () => void;
}) {
  const Icon = def.icon;
  return h(
    "div",
    { className: `onboard-integration-row${def.disabled ? " is-disabled" : ""}` },
    h(
      "span",
      { className: "onboard-integration-icon", style: { background: def.iconBg } },
      h(Icon, { size: 19, color: "#fff", "aria-hidden": true }),
    ),
    h(
      "div",
      { className: "onboard-integration-copy" },
      h("p", { className: "onboard-integration-name" }, def.name),
      h("p", { className: "onboard-integration-hint" }, def.hint),
    ),
    def.disabled
      ? h("span", { className: "onboard-integration-connect is-disabled" }, "Coming soon")
      : def.backendChecked
        ? h(
            "span",
            { className: `onboard-integration-connect${connected ? " is-connected" : ""} is-status` },
            checking ? "Checking…" : connected ? "Connected" : "Not connected yet",
          )
        : h(
            "button",
            {
              type: "button",
              className: `onboard-integration-connect${connected ? " is-connected" : ""}`,
              onClick: onToggle,
              "aria-pressed": connected,
            },
            connected ? "Connected" : "Connect",
          ),
  );
}

function IntegrationStep({
  title,
  sub,
  items,
  connected,
  checkingStatus,
  onToggle,
  onBack,
  onContinue,
  continueLabel,
  pending,
}: {
  title: string;
  sub: string;
  items: IntegrationDef[];
  connected: Record<string, boolean>;
  checkingStatus?: boolean;
  onToggle: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
  continueLabel: string;
  pending?: boolean;
}) {
  return h(
    OnboardCard,
    { wide: true },
    h(BackLink, { onClick: onBack }),
    h("img", { src: "/landing/assets/logo.png", alt: "", className: "onboard-signin-mark", "aria-hidden": true }),
    h("h1", null, title),
    h("p", { className: "onboard-signin-sub" }, sub),
    h(
      "div",
      { className: "onboard-integration-list" },
      ...items.map((def) =>
        h(IntegrationRow, {
          key: def.id,
          def,
          connected: Boolean(connected[def.id]),
          checking: def.backendChecked && checkingStatus,
          onToggle: () => onToggle(def.id),
        }),
      ),
    ),
    h(
      "button",
      {
        type: "button",
        className: "onboarding-confirm-button mt-6 w-full py-2.5 text-sm",
        style: { marginTop: 24 },
        onClick: onContinue,
        disabled: pending,
      },
      pending ? "Setting up…" : continueLabel,
    ),
    h(
      "button",
      { type: "button", className: "onboard-skip-link", onClick: onContinue, disabled: pending },
      "Skip for now",
    ),
  );
}

export function TestingAndIntegrations({
  onDone,
  pending = false,
}: {
  /** Reaches the workflow canvas — call at the end of every path. */
  onDone: () => void;
  pending?: boolean;
}) {
  const [step, setStep] = useState<Step>("tested");
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [offerTitle, setOfferTitle] = useState("");
  const [offerDescription, setOfferDescription] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .integrationStatus()
      .then((statuses) => {
        if (cancelled) return;
        setConnected((current) => {
          const next = { ...current };
          for (const status of statuses) next[status.id] = status.connected;
          return next;
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCheckingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: string) {
    setConnected((current) => ({ ...current, [id]: !current[id] }));
  }

  if (step === "tested") {
    return h(YesNoQuestion, {
      title: "Did you already test this product?",
      sub: "We'll tailor the next step to where you're at.",
      onYes: () => setStep("ads"),
      onNo: () => setStep("offer-question"),
    });
  }

  if (step === "ads") {
    return h(IntegrationStep, {
      title: "Link your ad platform",
      sub: "Connect where you're already running ads. Nothing is wired up yet — this just marks intent.",
      items: AD_INTEGRATIONS,
      connected,
      checkingStatus,
      onToggle: toggle,
      onBack: () => setStep("tested"),
      onContinue: () => setStep("fulfillment"),
      continueLabel: "Continue",
    });
  }

  if (step === "fulfillment") {
    return h(IntegrationStep, {
      title: "Link your storefront",
      sub: "Connect where orders and delivery happen. Nothing is wired up yet — this just marks intent.",
      items: FULFILLMENT_INTEGRATIONS,
      connected,
      checkingStatus,
      onToggle: toggle,
      onBack: () => setStep("ads"),
      onContinue: onDone,
      continueLabel: "Enter the workspace",
      pending,
    });
  }

  if (step === "offer-question") {
    return h(YesNoQuestion, {
      title: "Do you have your first offer in mind?",
      sub: "An offer is how you'll package and price this product.",
      onBack: () => setStep("tested"),
      onYes: () => setStep("offer-form"),
      onNo: onDone,
    });
  }

  // offer-form
  return h(
    OnboardCard,
    { wide: true },
    h(BackLink, { onClick: () => setStep("offer-question") }),
    h("img", { src: "/landing/assets/logo.png", alt: "", className: "onboard-signin-mark", "aria-hidden": true }),
    h("h1", null, "What's the offer?"),
    h("p", { className: "onboard-signin-sub" }, "A short title and description is enough for now."),
    h(
      "form",
      {
        className: "onboard-offer-form",
        onSubmit: (event: React.FormEvent) => {
          event.preventDefault();
          onDone();
        },
      },
      h(
        "div",
        null,
        h("label", { htmlFor: "onboard-offer-title" }, "Title"),
        h("input", {
          id: "onboard-offer-title",
          value: offerTitle,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setOfferTitle(event.target.value),
          placeholder: "e.g. Buy 2, get 1 free",
        }),
      ),
      h(
        "div",
        null,
        h("label", { htmlFor: "onboard-offer-description" }, "Description"),
        h("textarea", {
          id: "onboard-offer-description",
          value: offerDescription,
          onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
            setOfferDescription(event.target.value),
          placeholder: "What does this offer include, and why does it make saying yes easier?",
        }),
      ),
      h(
        "button",
        {
          type: "submit",
          className: "onboarding-confirm-button w-full py-2.5 text-sm",
          style: { marginTop: 6 },
          disabled: pending,
        },
        pending ? "Setting up…" : "Continue",
      ),
    ),
  );
}
