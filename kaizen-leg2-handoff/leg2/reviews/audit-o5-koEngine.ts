import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const R = process.argv[2]; const Decimal = createRequire(R + "/package.json")("decimal.js");
async function main() {
  const { acquire } = await import(R + "/lib/analyzer/acquisition/acquire");
  const tm = await import(R + "/lib/analyzer/acquisition/tagMap");
  const cap = (t: string) => JSON.parse(readFileSync(`${R}/lib/analyzer/acquisition/captures/ar6-2026-10-18/${t}-companyfacts.json`, "utf8"));
  const ciks: Record<string,string> = { MSFT: "0000789019", COST: "0000909832", NVDA: "0001045810", NUE: "0000073309", KO: "0000021344", LLY: "0000059478" };
  const run = (label: string) => {
    for (const t of Object.keys(ciks)) {
      const a = acquire({ ticker: t, cik: ciks[t], companyName: t, companyFacts: cap(t.toLowerCase()),
        price: { value: new Decimal(100), timestamp: "2026-10-16T21:00:00Z", source: "stated" }, acquiredAt: "2026-10-18T00:00:00.000Z" });
      const f: any = a.facts.find((x: any) => x.id === "total-debt");
      console.log(label, t, String(f?.value), f?.asOfDate, JSON.stringify(f?.contributingTags ?? f?.tags ?? null));
    }
  };
  run("AS-SHIPPED");
  const e: any = (tm.TAG_MAP as any[]).find((x) => x.factId === "total-debt");
  e.candidates[4].plus.push({ ns: "us-gaap", tag: "CommercialPaper" });
  run("WITH-CP-ON-LAST-CANDIDATE");
}
main();
