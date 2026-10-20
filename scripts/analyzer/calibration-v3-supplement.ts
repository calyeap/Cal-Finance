import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Decimal from "decimal.js";
import { acquireCompany } from "../../lib/analyzer/acquisition/provider";
import { selectionToNonOperatingInvestments } from "../../lib/analyzer/acquisition/nonOperatingJudgment";
import { buildAcquiredRun } from "../../lib/analyzer/acquiredRun";
import { assembleAnalysisResult } from "../../lib/analyzer/assemble";
import { deriveVerdict } from "../../lib/analyzer/verdict";
import { bundleFromSheet } from "../../lib/analyzer/sheets/sheet";
import { CLEAN_PROVENANCE } from "../../lib/analyzer/provenance";
import type { CompanyFactsDocument } from "../../lib/analyzer/acquisition/secClient";

// ---------------------------------------------------------------------------
// CF-METHODOLOGY-V3-CALIBRATION-01 (issue #495) — TEST-ONLY SUPPLEMENT, not
// engine output. NVDA, NUE, KO and LLY tag no
// us-gaap:IncrementalCommonSharesAttributableToShareBasedPaymentArrangements,
// so the engine's EV bridge is INCOMPLETE on treasury-method dilution — a
// recorded named gate (docs/ev-input-gaps-reconciliation.md §1: the same
// quantity as diluted − basic weighted-average shares under ASC 260, never
// built as a second acquisition path). The engine result stays NOT VALUED.
//
// For calibration only, this re-values each FROZEN sheet with that one input
// stated as diluted − basic weighted-average shares from the same 19 Oct
// capture's latest 10-K (it equals the tag exactly where both exist: MSFT
// 24,000,000; COST 474,000). Every other input, gate and rule is the
// production engine's. No model call, no network, nothing stored.
//
// Run: DATABASE_URL=… npx tsx scripts/analyzer/calibration-v3-supplement.ts
// ---------------------------------------------------------------------------

const CAPTURE_SET = path.join("lib", "analyzer", "acquisition", "captures", "ar6-2026-10-19");
const EVIDENCE = path.join("docs", "evidence", "methodology-v3-calibration");
const TICKERS = ["NVDA", "NUE", "KO", "LLY"];

type Row = { val: number; end: string; form?: string; fp?: string; accn?: string };
function latestAnnual(doc: CompanyFactsDocument, tag: string): Row | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: Row[] = ((doc.facts as any)["us-gaap"]?.[tag]?.units?.shares ?? []).filter((r: Row) => r.form === "10-K" && r.fp === "FY");
  return rows.sort((a, b) => a.end.localeCompare(b.end)).at(-1) ?? null;
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  process.env.CAL_FINANCE_CODE_VERSION ??= execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const stage = mkdtempSync(path.join(tmpdir(), "cf-v3-captures-"));
  const dir = path.join(stage, "lib", "analyzer", "acquisition", "captures");
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(path.join(repoRoot, CAPTURE_SET))) symlinkSync(path.join(repoRoot, CAPTURE_SET, f), path.join(dir, f));

  for (const ticker of TICKERS) {
    const frozen = JSON.parse(readFileSync(path.join(repoRoot, EVIDENCE, `${ticker.toLowerCase()}-run.json`), "utf8"));
    const doc = JSON.parse(readFileSync(path.join(repoRoot, CAPTURE_SET, `${ticker.toLowerCase()}-companyfacts.json`), "utf8")) as CompanyFactsDocument;
    const diluted = latestAnnual(doc, "WeightedAverageNumberOfDilutedSharesOutstanding");
    const basic = latestAnnual(doc, "WeightedAverageNumberOfSharesOutstandingBasic");
    if (diluted === null || basic === null || diluted.end !== basic.end) {
      console.log(`${ticker}: no same-period diluted and basic weighted-average shares — not supplemented`);
      continue;
    }
    const dilution = new Decimal(diluted.val).minus(basic.val);

    process.chdir(stage);
    const price = { value: new Decimal(frozen.capture.price.value), timestamp: frozen.capture.price.timestamp, source: frozen.capture.price.source };
    const acquired = await acquireCompany(ticker, { price: null, source: "CAPTURE" });
    const run = await buildAcquiredRun({
      ticker,
      bundle: bundleFromSheet(frozen.sheet),
      price,
      nonOperatingInvestments: selectionToNonOperatingInvestments(frozen.capture.nonOperatingSelection, acquired.acquisition.candidateNonOperatingInvestments),
      profileHumanConfirmed: true,
      source: "CAPTURE",
    });
    process.chdir(repoRoot);
    if (run.fixture.enterpriseValue.treasuryMethodDilution === null) {
      run.fixture.enterpriseValue.treasuryMethodDilution = { value: dilution, provenance: CLEAN_PROVENANCE };
    }
    const result = assembleAnalysisResult(run.fixture);
    const verdict = deriveVerdict(result);
    const base = run.fixture.reverseDcf.baseYearRevenue;
    writeFileSync(
      path.join(repoRoot, EVIDENCE, `${ticker.toLowerCase()}-run-supplement.json`),
      JSON.stringify(
        {
          capture: {
            ...frozen.capture,
            note:
              "TEST-ONLY SUPPLEMENT (#495), not engine output: the frozen sheet re-valued with treasury-method dilution stated as diluted − basic weighted-average shares " +
              `(${diluted.val} − ${basic.val} = ${dilution.toString()}, 10-K period ending ${diluted.end}, accession ${diluted.accn ?? "n/a"}). The engine itself leaves this company NOT VALUED.`,
            statedDilution: { value: dilution.toString(), diluted, basic },
          },
          engineInputs: { baseRevenue: base?.value ?? null, baseRevenueVerification: base?.provenance.verificationState ?? null, valuationBase: run.fixture.valuationBase ?? null },
          sheet: frozen.sheet,
          verdict,
          result,
        },
        (_k, v) => (v instanceof Decimal ? v.toString() : v),
        2
      ) + "\n"
    );
    console.log(`${ticker}: dilution ${dilution.toString()} → verdict ${verdict.state}${"reason" in verdict ? ` — ${String(verdict.reason).slice(0, 160)}` : ""}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
