"use client";

import { useEffect } from "react";
import { readableOn, useControlRoomAppearance } from "@/lib/control-room-appearance";

/**
 * Personal settings' accent picker used to reach only the Control room, because `--control-accent` was set as an
 * inline style on `SettingsShell`'s own wrapper (a CSS custom property only cascades to that element's
 * descendants). This mirrors the same value onto the document root instead, so the rest of the app — the Strategy
 * canvas contour, the header chrome, anywhere else that wants the person's own "third color" instead of a fixed
 * Prism brand color or a plain light/dark theme token — can read `var(--control-accent)` too. Renders nothing.
 */
export function ControlAccentSync({ userId }: { userId: string }) {
  const { appearance } = useControlRoomAppearance(userId);
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--control-accent", appearance.accent);
    root.style.setProperty("--control-accent-ink", readableOn(appearance.accent));
  }, [appearance.accent]);
  return null;
}
