import { writeFileSync } from "node:fs";
import { join } from "node:path";

// CF-AR2-GOLDEN-HARNESS-01, DO item 5 — captures the REAL SEC SIC code for a
// wider company set than the eight golden companies, so `cyclicalSic.ts`'s
// D1 table is validated against filings rather than against itself.
//
// Source: data.sec.gov/submissions/CIK##########.json (the same endpoint the
// golden JSONs' `sic` fields came from). The CIK list below is written by
// hand; every capture checks that the submissions document's own `tickers`
// list contains the expected ticker, so a wrong CIK fails loudly instead of
// silently capturing a different company. Where SEC's own `tickers` list is
// empty (a delisted or currently unlisted filer), the check falls back to the
// entity name, which must then be stated explicitly as `nameIncludes`.
//
// `expected` is the economic classification a reader would give the company
// BEFORE looking at the table (commodity, capital-goods, construction and
// transport exposure → cyclical; everything else → stable). It is never
// derived from `classifyCyclicality` — the test compares the two.
//
//   npx tsx scripts/evidence/golden/captureSicValidationSet.ts

const USER_AGENT = process.env.SEC_USER_AGENT ?? "Cal Finance golden harness research@calfinance.invalid";

const COMPANIES: { ticker: string; cik: number; expected: "cyclical" | "stable"; nameIncludes?: string }[] = [
  // cyclical
  { ticker: "X", cik: 1163302, expected: "cyclical", nameIncludes: "UNITED STATES STEEL" },
  { ticker: "CLF", cik: 764065, expected: "cyclical" },
  { ticker: "STLD", cik: 1022671, expected: "cyclical" },
  { ticker: "AA", cik: 1675149, expected: "cyclical" },
  { ticker: "FCX", cik: 831259, expected: "cyclical" },
  { ticker: "NEM", cik: 1164727, expected: "cyclical" },
  { ticker: "MU", cik: 723125, expected: "cyclical" },
  { ticker: "AMD", cik: 2488, expected: "cyclical" },
  { ticker: "INTC", cik: 50863, expected: "cyclical" },
  { ticker: "F", cik: 37996, expected: "cyclical" },
  { ticker: "GM", cik: 1467858, expected: "cyclical" },
  { ticker: "DOW", cik: 1751788, expected: "cyclical" },
  { ticker: "LYB", cik: 1489393, expected: "cyclical" },
  { ticker: "SHW", cik: 89800, expected: "cyclical" },
  { ticker: "XOM", cik: 34088, expected: "cyclical", nameIncludes: "EXXON MOBIL" },
  { ticker: "COP", cik: 1163165, expected: "cyclical" },
  { ticker: "SLB", cik: 87347, expected: "cyclical" },
  { ticker: "HAL", cik: 45012, expected: "cyclical" },
  { ticker: "DAL", cik: 27904, expected: "cyclical" },
  { ticker: "UAL", cik: 100517, expected: "cyclical" },
  { ticker: "ODFL", cik: 878927, expected: "cyclical" },
  { ticker: "DHI", cik: 882184, expected: "cyclical" },
  { ticker: "LEN", cik: 920760, expected: "cyclical" },
  { ticker: "MLM", cik: 916076, expected: "cyclical" },
  { ticker: "VMC", cik: 1396009, expected: "cyclical" },
  { ticker: "IP", cik: 51434, expected: "cyclical" },
  { ticker: "CAT", cik: 18230, expected: "cyclical" },
  { ticker: "DE", cik: 315189, expected: "cyclical" },
  { ticker: "BA", cik: 12927, expected: "cyclical" },
  { ticker: "MAR", cik: 1048286, expected: "cyclical" },
  // stable
  { ticker: "AAPL", cik: 320193, expected: "stable" },
  { ticker: "ORCL", cik: 1341439, expected: "stable" },
  { ticker: "GOOGL", cik: 1652044, expected: "stable" },
  { ticker: "V", cik: 1403161, expected: "stable" },
  { ticker: "PG", cik: 80424, expected: "stable" },
  { ticker: "CL", cik: 21665, expected: "stable" },
  { ticker: "PEP", cik: 77476, expected: "stable" },
  { ticker: "WMT", cik: 104169, expected: "stable" },
  { ticker: "AMZN", cik: 1018724, expected: "stable" },
  { ticker: "HD", cik: 354950, expected: "stable" },
  { ticker: "MCD", cik: 63908, expected: "stable" },
  { ticker: "JNJ", cik: 200406, expected: "stable" },
  { ticker: "PFE", cik: 78003, expected: "stable" },
  { ticker: "MRK", cik: 310158, expected: "stable" },
  { ticker: "ABT", cik: 1800, expected: "stable" },
  { ticker: "T", cik: 732717, expected: "stable" },
  { ticker: "NEE", cik: 753308, expected: "stable" },
  { ticker: "DUK", cik: 1326160, expected: "stable" },
  { ticker: "WM", cik: 823768, expected: "stable" },
  { ticker: "UNP", cik: 100885, expected: "stable" },
];

async function main(): Promise<void> {
  const capturedAt = new Date().toISOString().slice(0, 10);
  const rows: { ticker: string; cik: string; entityName: string; sic: string; sicDescription: string; expected: string }[] = [];
  const failures: string[] = [];
  for (const c of COMPANIES) {
    const cik = String(c.cik).padStart(10, "0");
    const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) {
      failures.push(`${c.ticker}: HTTP ${res.status} from ${url}`);
      continue;
    }
    const doc = (await res.json()) as { name: string; sic: string; sicDescription: string; tickers: string[] };
    const tickerMatches = doc.tickers.map((t) => t.toUpperCase()).includes(c.ticker);
    const nameMatches = doc.tickers.length === 0 && c.nameIncludes !== undefined && doc.name.toUpperCase().includes(c.nameIncludes);
    if (!tickerMatches && !nameMatches) {
      failures.push(`${c.ticker}: CIK ${cik} is ${doc.name} (tickers ${doc.tickers.join(",")}) — wrong CIK`);
      continue;
    }
    rows.push({ ticker: c.ticker, cik, entityName: doc.name, sic: doc.sic, sicDescription: doc.sicDescription, expected: c.expected });
    await new Promise((r) => setTimeout(r, 150)); // stay well under SEC's 10 req/s fair-access limit
  }
  if (failures.length > 0) {
    throw new Error(`SIC capture failed loudly:\n${failures.join("\n")}`);
  }
  const out = {
    provenance: { source: "https://data.sec.gov/submissions/CIK##########.json (fields: name, sic, sicDescription, tickers)", capturedAt },
    companies: rows,
  };
  const path = join(__dirname, "../../../lib/analyzer/golden/sicValidationSet.json");
  writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
  console.log(`wrote ${rows.length} companies to ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
