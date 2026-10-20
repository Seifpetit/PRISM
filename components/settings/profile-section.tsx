"use client";

import { useState } from "react";
import { Check, Pencil, Pipette } from "lucide-react";
import { BannerImage, BannerModal } from "@/components/settings/banner-modal";
import { ACCENT_PRESETS, readableOn, useControlRoomAppearance } from "@/lib/control-room-appearance";
import { h } from "@/lib/h";
import type { AuthSession } from "@/types/auth";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function SectionLabel({ children }: { children: React.ReactNode }) {
  return h("h2", { className: "text-[13px] font-semibold text-ink" }, children);
}

function AccentPicker({ accent, onChange }: { accent: string; onChange: (hex: string) => void }) {
  const preset = ACCENT_PRESETS.some((item) => item.value.toLowerCase() === accent.toLowerCase());
  return h(
    "div",
    { className: "grid grid-cols-7 gap-2.5" },
    ...ACCENT_PRESETS.map((item) => {
      const selected = item.value.toLowerCase() === accent.toLowerCase();
      return h(
        "button",
        {
          key: item.value,
          type: "button",
          onClick: () => onChange(item.value),
          "aria-pressed": selected,
          "aria-label": item.label,
          title: item.label,
          className:
            "grid aspect-square w-full place-items-center rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100",
          style: {
            background: item.value,
            color: readableOn(item.value),
            boxShadow: selected ? `0 0 0 2px var(--bg-panel), 0 0 0 4px ${item.value}` : "inset 0 0 0 1px rgba(0,0,0,.12)",
            ["--tw-ring-color" as string]: item.value,
          },
        },
        selected ? h(Check, { size: 18, strokeWidth: 3, "aria-hidden": true }) : null,
      );
    }),
    // Any colour: the native picker, shown as one more swatch.
    h(
      "label",
      {
        title: "Pick any colour",
        className:
          "relative grid aspect-square w-full cursor-pointer place-items-center overflow-hidden rounded-full transition-transform hover:scale-110 focus-within:ring-2 focus-within:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100",
        style: {
          background: preset ? "conic-gradient(#f03e3e, #f59f00, #40c057, #15aabf, #4c6ef5, #ae3ec9, #f03e3e)" : accent,
          color: preset ? "#fff" : readableOn(accent),
          boxShadow: preset ? "inset 0 0 0 1px rgba(0,0,0,.12)" : `0 0 0 2px var(--bg-panel), 0 0 0 4px ${accent}`,
          ["--tw-ring-color" as string]: accent,
        },
      },
      h(Pipette, { size: 17, strokeWidth: 2.5, "aria-hidden": true, style: { filter: preset ? "drop-shadow(0 1px 2px rgba(0,0,0,.5))" : undefined } }),
      h("input", {
        type: "color",
        value: accent.toLowerCase(),
        "aria-label": "Custom accent colour",
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value.toUpperCase()),
        className: "absolute inset-0 h-full w-full cursor-pointer opacity-0",
      }),
    ),
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return h(
    "div",
    { className: "flex items-baseline justify-between gap-4 py-2" },
    h("dt", { className: "shrink-0 text-[11px] text-muted" }, label),
    h("dd", { className: "min-w-0 truncate text-[12px] font-medium text-ink", title: value }, value),
  );
}

/** The account that is signed in, dressed with a banner and an accent colour of the person's choosing. The banner's
 * controls stay out of sight until it is hovered (or focused), then a single edit button opens them in a dialog. */
export function ProfileSettingsSection({ session }: { session: AuthSession }) {
  const { user, workspace } = session;
  const { appearance, update } = useControlRoomAppearance(user.id);
  const banner = appearance.banner;
  const [editing, setEditing] = useState(false);

  return h(
    "section",
    { className: "px-5 py-6 sm:px-8 lg:px-10", "aria-labelledby": "profile-settings-title" },
    h(
      "div",
      { className: "mx-auto max-w-[1120px]" },
      h(
        "div",
        { className: "overflow-hidden rounded-2xl border border-[#DDE0E4] bg-white shadow-[0_1px_2px_rgb(21_23_26/.04)]" },
        h(
          "div",
          { className: "group relative h-[clamp(200px,34vh,320px)]" },
          h(BannerImage, { src: banner.url, color: banner.color, className: "absolute inset-0" }),
          h("div", { className: "pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/45 to-transparent" }),
          h(
            "button",
            {
              type: "button",
              onClick: () => setEditing(true),
              "aria-label": "Edit banner",
              title: "Edit banner",
              className:
                "absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white opacity-0 shadow-[0_4px_14px_rgba(0,0,0,.3)] backdrop-blur-[3px] transition-opacity duration-150 hover:bg-black/75 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white group-hover:opacity-100 [@media(hover:none)]:opacity-100 motion-reduce:transition-none",
            },
            h(Pencil, { size: 17, "aria-hidden": true }),
          ),
          banner.photographer
            ? h(
                "a",
                {
                  href: banner.pageUrl ?? banner.photographerUrl ?? "https://www.pexels.com",
                  target: "_blank",
                  rel: "noopener noreferrer",
                  className: "absolute bottom-2 right-3 rounded-md bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-[2px] hover:bg-black/60",
                },
                `Photo by ${banner.photographer} on Pexels`,
              )
            : null,
        ),
        h(
          "div",
          { className: "relative flex items-end gap-4 px-6 pb-5" },
          h(
            "div",
            {
              className: "-mt-10 grid h-[84px] w-[84px] shrink-0 place-items-center rounded-full text-2xl font-bold",
              style: { background: "var(--control-accent)", color: "var(--control-accent-ink)", boxShadow: "0 0 0 4px var(--bg-panel), 0 6px 16px rgba(21,23,26,.2)" },
              "aria-hidden": true,
            },
            initials(user.displayName),
          ),
          h(
            "div",
            { className: "min-w-0 pb-0.5" },
            h("h1", { id: "profile-settings-title", className: "truncate text-xl font-semibold tracking-[-.02em] text-ink" }, user.displayName),
            h("p", { className: "mt-0.5 truncate text-xs text-muted" }, `${user.email} · ${workspace.name}`),
          ),
        ),
      ),
      h(
        "div",
        { className: "mt-5 grid gap-5 md:grid-cols-2" },
        h(
          "div",
          { className: "rounded-2xl border border-[#DDE0E4] bg-white p-5" },
          h("div", { className: "mb-3.5" }, h(SectionLabel, null, "Accent color")),
          h(AccentPicker, { accent: appearance.accent, onChange: (accent: string) => update({ accent }) }),
          h("p", { className: "mt-3.5 text-[11px] leading-4 text-muted" }, "Used for small highlights across the Control room."),
        ),
        h(
          "div",
          { className: "rounded-2xl border border-[#DDE0E4] bg-white px-5 py-3" },
          h("dl", { className: "divide-y divide-[#ECEEF1]" }, h(Detail, { label: "Name", value: user.displayName }), h(Detail, { label: "Email", value: user.email }), h(Detail, { label: "Workspace", value: `${workspace.name} · ${workspace.role}` })),
        ),
      ),
    ),
    h(BannerModal, {
      open: editing,
      onClose: () => setEditing(false),
      banner,
      themes: appearance.themes,
      onBanner: (choice) => update({ banner: choice }),
      onThemes: (themes) => update({ themes }),
    }),
  );
}
