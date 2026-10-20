// CF-AR7-REPORT-CONTENT-01 (issue #456) — screenshots a real run's report in
// the running app at the five design-authority widths (32-inch desktop,
// half-window, iPad landscape, iPad portrait, iPhone), every tab, plus
// Analyzer Home. Reports each page's load time and any horizontal page
// overflow (analytical tables scroll inside their own container instead).
//
// Run (app already running):
//   node scripts/analyzer/shoot-ar7-report.mjs http://127.0.0.1:3000 <runId> docs/evidence/ar7-report/screenshots
// Writes <width>-<tab>.png for the tabs in KEEP (all tabs with KEEP=all) and
// prints one line per page.
import { chromium } from "playwright";

const [base, runId, outDir] = process.argv.slice(2);
const WIDTHS = {
  "desktop-32in": [2560, 1440, 1],
  "half-window": [1280, 1440, 1],
  "ipad-landscape": [1180, 820, 1],
  "ipad-portrait": [820, 1180, 1],
  iphone: [390, 844, 1],
};
const TABS = ["overview", "business", "financials", "valuation", "risks", "market", "evidence"];
const KEEP = process.env.KEEP === "all" ? null : new Set(["overview", "financials", "valuation"]);

const browser = await chromium.launch();
for (const [name, [w, h, dpr]] of Object.entries(WIDTHS)) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  for (const tab of TABS) {
    const started = Date.now();
    await page.goto(`${base}/analyzer/${runId}${tab === "overview" ? "" : `?tab=${tab}`}`, { waitUntil: "networkidle", timeout: 300000 });
    const ms = Date.now() - started;
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    console.log(name, tab, `${ms}ms`, o.sw > o.cw ? `OVERFLOW ${o.sw}>${o.cw}` : "no page overflow");
    if (KEEP === null || KEEP.has(tab)) await page.screenshot({ path: `${outDir}/${name}-${tab}.png`, fullPage: true });
  }
  if (name === "desktop-32in" || name === "iphone") {
    await page.goto(`${base}/analyzer`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${outDir}/${name}-home.png`, fullPage: true });
  }
  await page.close();
}
await browser.close();
