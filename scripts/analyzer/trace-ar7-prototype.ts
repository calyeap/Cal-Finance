import { readFileSync } from "node:fs";
import Decimal from "decimal.js";

// ---------------------------------------------------------------------------
// CF-AR7-PROTOTYPE-REVIEW-01 (issue #455) — checks that every number shown on
// the static prototype traces to the run file it was rendered from. A number
// on the page traces when it appears verbatim in the run file (cited prose,
// dates, accessions) or is one of the renderer's formattings of a numeric
// value the run file carries (percent, money, billions, multiples). Exits 1
// and lists the strays if any number does not trace.
//
// Run:  npx tsx scripts/analyzer/trace-ar7-prototype.ts docs/evidence/ar7-prototype/msft-run.json docs/evidence/ar7-prototype/index.html
// ---------------------------------------------------------------------------

const [runFile = "docs/evidence/ar7-prototype/msft-run.json", htmlFile = "docs/evidence/ar7-prototype/index.html"] = process.argv.slice(2);
const runText = readFileSync(runFile, "utf8");
const run = JSON.parse(runText);
const html = readFileSync(htmlFile, "utf8");

// Renderings the renderer can produce from one numeric value.
const known = new Set<string>();
function add(d: Decimal): void {
  for (const dp of [0, 1, 2]) {
    known.add(d.toFixed(dp));
    known.add(d.mul(100).toFixed(dp));
    known.add(d.dividedBy(1e9).toFixed(dp));
  }
  known.add(d.toNumber().toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, ""));
  known.add(d.dividedBy(1e9).toNumber().toLocaleString("en-US", { maximumFractionDigits: 1 }).replace(/,/g, ""));
}
function walk(v: unknown): void {
  if (typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(v))) {
    const d = new Decimal(v);
    if (d.isFinite()) add(d);
  } else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === "object") Object.values(v).forEach(walk);
}
walk(run);
// The verdict rule's own derived figure: the Medium SELL line in price terms (Base × band).
const base = run.result?.scenarioOutputs?.values?.base;
const medium = run.result?.policy?.constants?.verdictSynthesisV1Sell?.medium;
if (base && medium) add(new Decimal(base).mul(medium));

// Visible text only: drop <style>, tags and entities.
const text = html
  .replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&[a-z]+;/g, " ");
const tokens = text.match(/\d[\d,]*(\.\d+)?/g) ?? [];
// Fixed page furniture: the issue number and the 0 / 1 axis labels.
const furniture = new Set(["455", "0", "1"]);
const strays = [...new Set(tokens)].filter((t) => {
  const bare = t.replace(/,/g, "");
  return !furniture.has(bare) && !known.has(bare) && !runText.includes(t);
});

console.log(`trace-ar7-prototype: ${tokens.length} numbers on the page, ${new Set(tokens).size} distinct; ${strays.length} do not trace to ${runFile}`);
if (strays.length > 0) {
  console.log(strays.join("\n"));
  process.exitCode = 1;
}
