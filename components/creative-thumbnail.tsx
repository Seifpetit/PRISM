import { h } from "@/lib/h";

const themes: Record<string, { bg: string; glow: string; label: string }> = {
  blue: { bg: "bg-[#C8D9F8]", glow: "bg-[#2864DC]", label: "MORNING 01" },
  warm: { bg: "bg-[#E8D5C4]", glow: "bg-[#D68A54]", label: "DAY ONE" },
  ink: { bg: "bg-[#20242A]", glow: "bg-[#B8F06A]", label: "PRESSURE TEST" },
  night: { bg: "bg-[#C7C6DC]", glow: "bg-[#4D4C77]", label: "03:07 AM" },
  aqua: { bg: "bg-[#C9E8E4]", glow: "bg-[#2D8B86]", label: "AIR FLOW" },
  lime: { bg: "bg-[#E2F7C4]", glow: "bg-[#2864DC]", label: "ALIGNMENT" },
  paper: { bg: "bg-[#E9E7E0]", glow: "bg-[#15171A]", label: "3 SIGNS" },
};

export function CreativeThumbnail({
  theme,
  compact = false,
}: {
  theme: string;
  compact?: boolean;
}) {
  const colors = themes[theme] ?? themes.blue;
  return h(
    "div",
    {
      className: `relative overflow-hidden ${colors.bg} ${compact ? "h-16 w-24 rounded-md" : "aspect-[4/5] w-full"}`,
      "aria-hidden": true,
    },
    h("div", {
      className: `absolute -right-[8%] top-[12%] h-[52%] w-[62%] rounded-[45%] ${colors.glow} opacity-85`,
    }),
    h("div", {
      className:
        "absolute bottom-[18%] left-[14%] h-[38%] w-[54%] rotate-[-7deg] rounded-[48%] bg-white shadow-[0_12px_30px_rgba(21,23,26,.18)]",
    }),
    h(
      "div",
      {
        className:
          "absolute left-3 top-3 font-mono text-[8px] font-semibold tracking-[.14em] text-ink/70",
      },
      colors.label,
    ),
    h(
      "div",
      {
        className:
          "absolute bottom-2.5 right-3 rounded-full bg-white/80 px-2 py-0.5 font-mono text-[7px] text-ink",
      },
      "CLOUD PILLOW",
    ),
  );
}
