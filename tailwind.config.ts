import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg-canvas)",
        surface: "var(--bg-panel)",
        ink: "var(--text-primary)",
        muted: "var(--text-muted)",
        // Plain keys so `bg-panel`, `bg-elevated`, etc. generate real utilities —
        // Tailwind names a color utility `{property}-{key}`, so a key that already
        // includes "bg-" (below) only ever produces the doubled `bg-bg-panel` form.
        // Keep both: existing "bg-bg-*" call sites still resolve, new "bg-panel"
        // call sites now resolve too. Never name a color key with its own utility
        // prefix baked in — add the plain key instead.
        app: "var(--bg-app)",
        panel: "var(--bg-panel)",
        elevated: "var(--bg-elevated)",
        input: "var(--bg-input)",
        "bg-app": "var(--bg-app)",
        "bg-canvas": "var(--bg-canvas)",
        "bg-panel": "var(--bg-panel)",
        "bg-elevated": "var(--bg-elevated)",
        "bg-input": "var(--bg-input)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        "border-subtle": "var(--border-subtle)",
        "border-default": "var(--border-default)",
        "border-strong": "var(--border-strong)",
        lineage: "#2864DC",
        lime: "#B8F06A",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "SFMono-Regular", "Consolas", "monospace"],
      },
      boxShadow: {
        node: "0 1px 2px rgba(21,23,26,.08), 0 6px 18px rgba(21,23,26,.04)",
      },
    },
  },
  plugins: [],
} satisfies Config;
