// CF-AR7-PROTOTYPE-REVIEW-01 (issue #455) — screenshots the static prototype at
// the three review widths (32-inch desktop, half-window, iPhone), opening every
// tab and reporting any horizontal page overflow and the shell mode in force.
//
// Run:  node scripts/analyzer/shoot-ar7-prototype.mjs "$PWD/docs/evidence/ar7-prototype/index.html" docs/evidence/ar7-prototype/screenshots
import { chromium } from "playwright";
const [file, outDir] = process.argv.slice(2);
const views = [["desktop-32in", 2560, 1440, 1], ["half-window", 1280, 1440, 1], ["iphone", 390, 844, 2]];
const browser = await chromium.launch();
for (const [name, w, h, dpr] of views) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await page.goto("file://" + file);
  await page.waitForTimeout(500);
  const tabs = await page.$$eval(".tabrail label", (ls) => ls.map((l) => l.getAttribute("for")));
  for (const t of tabs) {
    await page.click(`label[for=${t}]`);
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      rail: getComputedStyle(document.querySelector(".rail")).display, nav: getComputedStyle(document.querySelector(".nav")).display,
      head: getComputedStyle(document.querySelector(".mobile-head")).display }));
    console.log(name, t, o.sw > o.cw ? `OVERFLOW ${o.sw}>${o.cw}` : "ok", `rail=${o.rail} nav=${o.nav} mhead=${o.head}`);
    if (t === "t0" || t === "t3") await page.screenshot({ path: `${outDir}/${name}-${t === "t0" ? "overview" : "valuation"}.png`, fullPage: true });
  }
  await page.close();
}
await browser.close();
