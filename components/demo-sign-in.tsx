"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { h } from "@/lib/h";

export function DemoSignIn({
  onSignIn,
}: {
  onSignIn: (input: { displayName: string; email: string }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = displayName.trim();
    const nextEmail = email.trim().toLowerCase();
    if (!nextName || !nextEmail) {
      setError("Enter a name and email to continue.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await onSignIn({ displayName: nextName, email: nextEmail });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Sign in failed.");
    } finally {
      setPending(false);
    }
  }

  return h(
    "main",
    { className: "onboard-signin" },
    h(
      "section",
      { className: "onboard-signin-card" },
      h("img", { src: "/landing/assets/logo.png", alt: "", className: "onboard-signin-mark", "aria-hidden": true }),
      h("h1", null, "Let's bring in your first product."),
      h("p", { className: "onboard-signin-sub" }, "One quick step, then straight to it."),
      h(
        "form",
        { onSubmit: submit },
        h("input", {
          value: displayName,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDisplayName(event.target.value),
          autoComplete: "name",
          autoFocus: true,
          placeholder: "Your name",
        }),
        h("input", {
          type: "email",
          value: email,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setEmail(event.target.value),
          autoComplete: "email",
          placeholder: "Email",
        }),
        error ? h("p", { role: "alert", className: "onboard-signin-error" }, error) : null,
        h(
          "button",
          { type: "submit", disabled: pending },
          pending
            ? h(LoaderCircle, { size: 16, className: "animate-spin", "aria-hidden": true })
            : null,
          pending ? "Signing in" : "Continue",
          pending ? null : h(ArrowRight, { size: 16, "aria-hidden": true }),
        ),
      ),
      h(
        "p",
        { className: "onboard-signin-note" },
        "Local development preview. Any name and email works — this isn't secure authentication.",
      ),
    ),
  );
}
