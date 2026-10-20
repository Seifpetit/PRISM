import type { Metadata } from "next";
import "@xyflow/react/dist/style.css";
import "./globals.css";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/features.css";
import "../styles/primitives.css";
import "../styles/legacy.css";
import { h } from "@/lib/h";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Prism",

  description:
    "Know what to make next. Start with your product, find new ideas, and see what works.",

  icons: {
    icon: [{ url: "/landing/assets/logo.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const themeBootstrap = `try{var p=localStorage.getItem('prism-theme')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}`;
  return h(
    "html",
    { lang: "en", suppressHydrationWarning: true },
    h("head", null, h("script", { dangerouslySetInnerHTML: { __html: themeBootstrap } })),
    h("body", null, h(ThemeProvider, null, children)),
  );
}
