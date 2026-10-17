import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getPool } from "../../lib/db";
import { acquireCompany } from "../../lib/analyzer/acquisition/provider";
import { secClientFromEnv } from "../../lib/analyzer/acquisition/secClient";
import { analystCallIfConfigured } from "../../lib/analyzer/ai/anthropicCall";
import { latestPrice } from "../../lib/analyzer/gate";
import { getCompanyJudgmentOverride } from "../../lib/analyzer/runStore";
import { selectionToNonOperatingInvestments } from "../../lib/analyzer/acquisition/nonOperatingJudgment";
import { draftSpread, formatSpreadReport, SPREAD_THRESHOLD, type SpreadReport } from "../../lib/analyzer/sheets/spread";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — the three-draft spread per golden company
// (issue #454 DO 4 and VERIFY). Live: reads EDGAR (SEC_USER_AGENT) and calls
// the drafting model (ANTHROPIC_API_KEY) three times per company. Writes
// nothing to the sheet store.
//
// The §4.4 non-operating-investments answer used to bridge each draft to a
// per-share value is the company's recorded override where one exists, else
// "none" — the same for all three drafts, so it cannot widen the spread.
//
// Output: the table on stdout and <PROOF_OUTPUT_DIR>/draft-spread.{md,json}.
// Exit 1 when any company's spread is wider than 10%.
//
// Run:  npx tsx scripts/analyzer/draft-spread.ts [TICKER ...]
// Default: the golden companies the engine values — MSFT COST NVDA NUE KO LLY
// (OKLO records "can't conclude"; the bank is refused at Gate 0).
// ---------------------------------------------------------------------------

const DEFAULT_TICKERS = ["MSFT", "COST", "NVDA", "NUE", "KO", "LLY"];

async function main(): Promise<void> {
  const tickers = process.argv.slice(2).map((t) => t.toUpperCase());
  const call = analystCallIfConfigured();
  if (call === null) {
    console.error("draft-spread: no ANTHROPIC_API_KEY — the drafting model cannot be called.");
    process.exitCode = 1;
    return;
  }
  const client = secClientFromEnv();
  const reports: SpreadReport[] = [];
  for (const ticker of tickers.length > 0 ? tickers : DEFAULT_TICKERS) {
    const acquired = await acquireCompany(ticker, { price: null });
    const price = await latestPrice(ticker);
    const override = await getCompanyJudgmentOverride(ticker, "NON-OPERATING INVESTMENTS");
    const nonOperatingInvestments = selectionToNonOperatingInvestments(
      override?.selection ?? "None of these are non-operating",
      acquired.acquisition.candidateNonOperatingInvestments
    );
    const report = await draftSpread(ticker, { call, client, acquired, price, nonOperatingInvestments });
    reports.push(report);
    console.log(`${ticker}: spread ${report.spread === null ? "n/a" : `${report.spread.mul(100).toFixed(1)}%`}`);
  }

  const table = formatSpreadReport(reports);
  console.log(`\n${table}\n\nBar: spread ≤ ${SPREAD_THRESHOLD.mul(100).toFixed(0)}% of the median Base value.`);
  const outDir = process.env.PROOF_OUTPUT_DIR ?? "proof";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "draft-spread.md"), `${table}\n`);
  writeFileSync(path.join(outDir, "draft-spread.json"), JSON.stringify(reports, null, 2));
  if (reports.some((r) => r.withinThreshold === false)) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => getPool().end());
