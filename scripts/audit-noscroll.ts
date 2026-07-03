/* The no-scroll audit. Every authenticated route must fit the viewport at
   390x844, 430x932, and 1280x800: scrollHeight <= innerHeight + 1 and no
   horizontal overflow. Run against a dev or deployed server:
   BASE_URL=http://localhost:3000 pnpm audit:noscroll
   Requires the server to run with DEMO_MODE=true (or a storage state) so
   routes render without a login redirect. */

import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ROUTES = ["/today", "/radar", "/priorities", "/table", "/ask", "/ledger", "/settings", "/login"];
const VIEWPORTS = [
  { width: 390, height: 844, label: "iPhone 390x844" },
  { width: 430, height: 932, label: "iPhone 430x932" },
  { width: 1280, height: 800, label: "Desktop 1280x800" },
];

const executablePath =
  process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

async function main() {
  const browser = await chromium.launch({ executablePath });
  let failures = 0;

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    for (const route of ROUTES) {
      try {
        const res = await page.goto(`${BASE}${route}`, {
          waitUntil: "networkidle",
          timeout: 30000,
        });
        const finalPath = new URL(page.url()).pathname;
        if (finalPath !== route) {
          console.log(`~ ${vp.label} ${route} redirected to ${finalPath}, auditing that`);
        }
        if (!res || res.status() >= 400) {
          console.error(`✗ ${vp.label} ${route} returned ${res?.status()}`);
          failures++;
          continue;
        }
        const m = await page.evaluate(() => ({
          scrollH: document.documentElement.scrollHeight,
          scrollW: document.documentElement.scrollWidth,
          innerH: window.innerHeight,
          innerW: window.innerWidth,
          bodyScrollH: document.body.scrollHeight,
        }));
        const vOk = m.scrollH <= m.innerH + 1 && m.bodyScrollH <= m.innerH + 1;
        const hOk = m.scrollW <= m.innerW + 1;
        if (vOk && hOk) {
          console.log(`✓ ${vp.label} ${route}`);
        } else {
          console.error(
            `✗ ${vp.label} ${route} overflows: scrollH=${m.scrollH} innerH=${m.innerH} scrollW=${m.scrollW} innerW=${m.innerW}`,
          );
          failures++;
        }
      } catch (e) {
        console.error(`✗ ${vp.label} ${route} error: ${(e as Error).message}`);
        failures++;
      }
    }
    await context.close();
  }

  await browser.close();
  if (failures > 0) {
    console.error(`\nNo-scroll audit failed: ${failures} violations.`);
    process.exit(1);
  }
  console.log("\nNo-scroll audit passed on every route and viewport.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
