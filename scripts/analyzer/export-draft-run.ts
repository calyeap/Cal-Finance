import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import Decimal from "decimal.js";
import { getPool } from "../../lib/db";
import { acquireCompany } from "../../lib/analyzer/acquisition/provider";
import { secClientFromEnv } from "../../lib/analyzer/acquisition/secClient";
import { analystCallIfConfigured, ANALYST_MODEL } from "../../lib/analyzer/ai/anthropicCall";
import { draftAssumptionSheet } from "../../lib/analyzer/acquisition/aiProposedBundle";
import { latestPrice } from "../../lib/analyzer/gate";
import { getCompanyJudgmentOverride } from "../../lib/analyzer/runStore";
import { selectionToNonOperatingInvestments } from "../../lib/analyzer/acquisition/nonOperatingJudgment";
import { buildAcquiredRun } from "../../lib/analyzer/acquiredRun";
import { assembleAnalysisResult } from "../../lib/analyzer/assemble";
import { deriveVerdict } from "../../lib/analyzer/verdict";
import { bundleFromSheet, type AssumptionSheet } from "../../lib/analyzer/sheets/sheet";

// ---------------------------------------------------------------------------
// CF-AR7-PROTOTYPE-REVIEW-01 (issue #455) — the real numbers behind the AR7
// static prototype. Drafts ONE sheet for a ticker through the production
// drafting path (median of three price-blind drafts — #454 ruling A), values
// it through the production engine exactly as a run values an unadopted
// DRAFT, and writes the whole result to one JSON file. The prototype is
// rendered from that file (docs/evidence/ar7-prototype/render.ts), so every
// number on it traces to this run.
//
// Read-only by design: nothing is written to the database (the sheet is
// valued in memory, never appended; the only read is the company's recorded
// §4.4 non-operating answer, as draft-spread.ts reads it). Calls the drafting
// model DRAFTS_PER_SHEET times — no interpretation or challenger call.
//
// Run:  npx tsx scripts/analyzer/export-draft-run.ts MSFT
// Writes <PROOF_OUTPUT_DIR or docs/evidence/ar7-prototype>/<ticker>-run.json
// ---------------------------------------------------------------------------

function plain(_key: string, value: unknown): unknown {
  return value instanceof Decimal ? value.toString() : value;
}

async function main(): Promise<void> {
  const ticker = (process.argv[2] ?? "MSFT").toUpperCase();
  const call = analystCallIfConfigured();
  if (call === null) {
    console.error("export-draft-run: no ANTHROPIC_API_KEY — the drafting model cannot be called.");
    process.exitCode = 1;
    return;
  }
  const acquired = await acquireCompany(ticker, { price: null });
  const outcome = await draftAssumptionSheet(ticker, acquired, call, secClientFromEnv());
  if (outcome.kind === "REFUSED") {
    console.error(`export-draft-run: ${ticker} could not be drafted — ${outcome.cause}`);
    process.exitCode = 1;
    return;
  }
  const sheet: AssumptionSheet = {
    id: -1,
    ticker,
    version: 1,
    status: "DRAFT",
    origin: outcome.kind === "DRAFTED" ? "AI DRAFT" : "CANNOT CONCLUDE",
    content: outcome.content,
    adoptedFrom: null,
    model: outcome.kind === "DRAFTED" ? ANALYST_MODEL : null,
    recordedAt: new Date().toISOString(),
  };
  const price = await latestPrice(ticker);
  const override = await getCompanyJudgmentOverride(ticker, "NON-OPERATING INVESTMENTS");
  const nonOperatingInvestments = selectionToNonOperatingInvestments(
    override?.selection ?? "None of these are non-operating",
    acquired.acquisition.candidateNonOperatingInvestments
  );
  const run = await buildAcquiredRun({
    ticker,
    bundle: bundleFromSheet(sheet),
    price,
    nonOperatingInvestments,
    profileHumanConfirmed: true,
  });
  const result = assembleAnalysisResult(run.fixture);
  const verdict = deriveVerdict(result);

  const outDir = process.env.PROOF_OUTPUT_DIR ?? path.join("docs", "evidence", "ar7-prototype");
  mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${ticker.toLowerCase()}-run.json`);
  writeFileSync(
    file,
    JSON.stringify(
      {
        capture: {
          note: "Real run for the AR7 prototype (#455): one median-of-three DRAFT sheet, valued unadopted, read-only.",
          exportedAt: new Date().toISOString(),
          ticker,
          price,
          nonOperatingSelection: override?.selection ?? "None of these are non-operating",
          model: sheet.model,
        },
        sheet,
        verdict,
        result,
      },
      plain,
      2
    ) + "\n"
  );
  console.log(`export-draft-run: ${ticker} → ${file} (verdict ${verdict.state}${"status" in verdict ? ` / ${String(verdict.status)}` : ""})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => getPool().end());
