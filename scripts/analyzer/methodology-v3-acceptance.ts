import { mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Decimal from "decimal.js";
import { acquireCompany } from "../../lib/analyzer/acquisition/provider";
import { buildAcquiredRun } from "../../lib/analyzer/acquiredRun";
import { assembleAnalysisResult } from "../../lib/analyzer/assemble";
import { deriveVerdict } from "../../lib/analyzer/verdict";
import { bundleFromSheet } from "../../lib/analyzer/sheets/sheet";
import { selectionToNonOperatingInvestments } from "../../lib/analyzer/acquisition/nonOperatingJudgment";

// ---------------------------------------------------------------------------
// CF-METHODOLOGY-V3-IMPLEMENT-01 (issue #499) — the acceptance run. No model
// call, no SEC call, no database: each frozen sheet (#495; MSFT from the AR7
// prototype run) is valued through the production pathway (buildAcquiredRun →
// assembleAnalysisResult → deriveVerdict) on a committed capture set, at the
// frozen price and non-operating selection.
//
//   npx tsx scripts/analyzer/methodology-v3-acceptance.ts <capture-set> <out.json>
//
// Run on this branch with `v3-2026-10-20` for v3, and on origin/master with
// `ar6-2026-10-19` for v2.1 (the frozen runs' own inputs).
// ---------------------------------------------------------------------------

const FROZEN: Record<string, string> = {
  MSFT: "docs/evidence/ar7-prototype/msft-run.json",
  COST: "docs/evidence/methodology-v3-calibration/cost-run.json",
  NVDA: "docs/evidence/methodology-v3-calibration/nvda-run.json",
  NUE: "docs/evidence/methodology-v3-calibration/nue-run.json",
  KO: "docs/evidence/methodology-v3-calibration/ko-run.json",
  LLY: "docs/evidence/methodology-v3-calibration/lly-run.json",
};

function stage(repoRoot: string, set: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "cf-v3-accept-"));
  const target = path.join(dir, "lib", "analyzer", "acquisition", "captures");
  mkdirSync(target, { recursive: true });
  for (const f of readdirSync(path.join(repoRoot, "lib", "analyzer", "acquisition", "captures", set))) {
    symlinkSync(path.join(repoRoot, "lib", "analyzer", "acquisition", "captures", set, f), path.join(target, f));
  }
  return dir;
}

function plain(_k: string, v: unknown): unknown {
  return v instanceof Decimal ? v.toString() : v;
}

async function main(): Promise<void> {
  const [set, out] = process.argv.slice(2);
  const repoRoot = process.cwd();
  const sheetsRoot = process.env.FROZEN_ROOT ?? repoRoot;
  process.chdir(stage(repoRoot, set));
  const rows: Record<string, unknown> = {};
  for (const [ticker, file] of Object.entries(FROZEN)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const frozen: any = JSON.parse(readFileSync(path.join(sheetsRoot, file), "utf8"));
    const price = { value: new Decimal(frozen.capture.price.value), timestamp: frozen.capture.price.timestamp, source: frozen.capture.price.source };
    const acquired = await acquireCompany(ticker, { price: null, source: "CAPTURE" });
    const nonOperatingInvestments = selectionToNonOperatingInvestments(
      frozen.capture.nonOperatingSelection,
      acquired.acquisition.candidateNonOperatingInvestments
    );
    const run = await buildAcquiredRun({ ticker, bundle: bundleFromSheet(frozen.sheet), price, nonOperatingInvestments, profileHumanConfirmed: true, source: "CAPTURE" });
    const result = assembleAnalysisResult(run.fixture);
    const verdict = deriveVerdict(result);
    const ev = result.diagnostics.enterpriseValue;
    rows[ticker] = {
      price: price.value,
      moat: frozen.sheet.content.moatClass,
      rate: result.valuationBasis?.discountRate.rate,
      band: result.valuationBasis?.discountRate.band,
      tax: run.fixture.configuredConstants.nopatTaxRate,
      evCause: ev.suppressed ? `${ev.state} — ${ev.cause}` : null,
      values: result.scenarioOutputs.values,
      baseAt: result.verdictInputs?.baseAtCheckRates ?? null,
      baseAtCause: result.verdictInputs?.baseAtCheckRatesCause ?? null,
      flatGrowthBaseAt: result.verdictInputs?.flatGrowthBaseAtCheckRates ?? null,
      terminalShare: result.diagnostics.terminal.terminalShareOfValue,
      verdict: { status: verdict.status, state: verdict.state, draftZone: verdict.draftZone ?? null, rampDependent: verdict.rampDependent ?? null },
      d2: result.valuationBasis?.d2.statement,
      v3: result.valuationBasis?.v3 ?? null,
    };
    console.log(ticker, verdict.state, verdict.draftZone ?? "", ev.suppressed ? ev.cause : "");
  }
  writeFileSync(path.resolve(repoRoot, out), JSON.stringify(rows, plain, 2) + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
