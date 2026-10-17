import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// CF-AR2-GOLDEN-HARNESS-01 — repeats the golden-fact capture mechanically.
//
// For every lib/analyzer/golden/<ticker>.json, re-fetches that company's
// companyfacts document from data.sec.gov and checks each recorded fact
// against the SEC row (or, for a composite "A + B" fact, the rows) with the same concept, unit, accession number, period
// end (and period start, for duration facts) and form. Exits non-zero on any
// missing row or value mismatch, listing every one.
//
// Reads only the golden JSONs and SEC — never lib/analyzer/acquisition/tagMap.ts
// (DO item 1: captured without reading the engine's own tag map).
//
//   npx tsx scripts/evidence/golden/verifyGoldenFacts.ts [TICKER ...]

const USER_AGENT = process.env.SEC_USER_AGENT ?? "Cal Finance golden harness research@calfinance.invalid";
const GOLDEN_DIR = join(__dirname, "../../../lib/analyzer/golden");

interface GoldenFact {
  xbrlConcept: string;
  value: number | null;
  unit: string;
  periodStart: string | null;
  periodEnd: string;
  accessionNumber: string;
  form: string;
}

interface SecRow {
  start?: string;
  end: string;
  val: number;
  accn: string;
  form: string;
}

type CompanyFacts = { facts: Record<string, Record<string, { units: Record<string, SecRow[]> }>> };

async function main(): Promise<void> {
  const only = process.argv.slice(2).map((t) => t.toUpperCase());
  const files = readdirSync(GOLDEN_DIR).filter((f) => f.endsWith(".json") && f !== "sicValidationSet.json");
  const problems: string[] = [];
  let checked = 0;

  for (const file of files) {
    const golden = JSON.parse(readFileSync(join(GOLDEN_DIR, file), "utf8")) as {
      ticker: string;
      cik: string;
      facts: Record<string, GoldenFact | string | null>;
    };
    if (only.length > 0 && !only.includes(golden.ticker.toUpperCase())) continue;

    const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${golden.cik}.json`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) {
      problems.push(`${golden.ticker}: HTTP ${res.status} from ${url}`);
      continue;
    }
    const doc = (await res.json()) as CompanyFacts;

    for (const [key, fact] of Object.entries(golden.facts)) {
      if (fact === null || typeof fact !== "object") continue; // absent by design; the JSON's sibling note says why
      // A composite fact ("A + B") is the sum of its components, each matched
      // to its own row from the same filing and period.
      let total = 0;
      const missing: string[] = [];
      for (const concept of fact.xbrlConcept.split(" + ").map((c) => c.trim())) {
        const [ns, tag] = concept.split(":");
        const rows = doc.facts[ns]?.[tag]?.units[fact.unit] ?? [];
        const row = rows.find(
          (r) =>
            r.accn === fact.accessionNumber &&
            r.end === fact.periodEnd &&
            r.form === fact.form &&
            (fact.periodStart === null ? r.start === undefined : r.start === fact.periodStart)
        );
        if (row === undefined) missing.push(concept);
        else total += row.val;
      }
      checked++;
      if (missing.length > 0) {
        problems.push(`${golden.ticker}.${key}: no [${fact.unit}] row for ${missing.join(", ")} in ${fact.accessionNumber} ${fact.periodStart ?? ""}..${fact.periodEnd} ${fact.form}`);
      } else if (total !== fact.value) {
        problems.push(`${golden.ticker}.${key}: golden ${fact.value} ≠ SEC ${total} (${fact.xbrlConcept}, ${fact.accessionNumber})`);
      }
    }
    await new Promise((r) => setTimeout(r, 150)); // SEC fair-access limit
  }

  if (problems.length > 0) {
    console.error(`golden facts: ${problems.length} problem(s) across ${checked} checked facts:\n${problems.join("\n")}`);
    process.exit(1);
  }
  console.log(`golden facts: all ${checked} facts match data.sec.gov exactly (value, accession, period, form)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
