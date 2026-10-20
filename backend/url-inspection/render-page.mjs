import { existsSync } from "node:fs";
import { assertSafeWebsiteTarget, validateWebsiteUrl } from "./fetch-page.mjs";
import { RenderMode } from "./types.mjs";

const defaultRenderTimeoutMs = 12_000;
const defaultRenderDelayMs = 900;
const defaultMaximumHtmlBytes = 3_000_000;
const defaultWindowsEdgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

function browserExecutablePath() {
  if (process.env.URL_INSPECTION_BROWSER_PATH) {
    return process.env.URL_INSPECTION_BROWSER_PATH;
  }
  return process.platform === "win32" ? defaultWindowsEdgePath : null;
}

/**
 * Renders only successful static UNKNOWN pages. The resulting DOM re-enters
 * the same deterministic extraction and scoring pipeline; it is not AI.
 */
export async function renderWebsiteHtml(page, dependencies = {}) {
  const executablePath = dependencies.browserExecutablePath ?? browserExecutablePath();
  if (!executablePath || !existsSync(executablePath)) return null;

  const timeoutMs = dependencies.renderTimeoutMs ?? defaultRenderTimeoutMs;
  const delayMs = dependencies.renderDelayMs ?? defaultRenderDelayMs;
  const maximumHtmlBytes = dependencies.maximumHtmlBytes ?? defaultMaximumHtmlBytes;
  const resolveHostname = dependencies.resolveHostname;
  const { chromium } = dependencies.playwright ?? (await import("playwright-core"));
  const browser = await chromium.launch({ executablePath, headless: true });

  try {
    const context = await browser.newContext({
      userAgent: "LineageProductInspector/1.0",
    });
    await context.route("**/*", async (route) => {
      try {
        const target = validateWebsiteUrl(route.request().url());
        await assertSafeWebsiteTarget(target, resolveHostname);
        await route.continue();
      } catch {
        await route.abort();
      }
    });
    const tab = await context.newPage();
    await tab.goto(page.finalUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await tab.waitForTimeout(delayMs);
    const html = await tab.content();
    await context.close();
    if (Buffer.byteLength(html) > maximumHtmlBytes) return null;
    return { ...page, html, renderMode: RenderMode.RENDERED_DOM };
  } finally {
    await browser.close();
  }
}
