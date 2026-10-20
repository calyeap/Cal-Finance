// AR8 evidence receipt (#457) — NOT product code, NOT Calvin's answer.
// A free, deterministic WHAT-IF: the real app path (createRun →
// recordJudgment → advanceRunAutomatically → analysisForReport, no model
// call) with the §4.4 non-operating-investments judgement set to "None of
// these are non-operating" on a throwaway run in the isolated cloud
// database, so Calvin can see what each answer would unlock. It also lists
// the candidate line items he would be choosing from.
//   DATABASE_URL=<isolated db> npx tsx docs/evidence/ar8-acceptance/what-if/what-if-none.ts COST NVDA …
import Decimal from "decimal.js";
import { getPool } from "../../../../lib/db";
import { createRun, recordJudgment } from "../../../../lib/analyzer/runStore";
import { advanceRunAutomatically } from "../../../../lib/analyzer/autoRun";
import { analysisForReport } from "../../../../lib/analyzer/reportAnalysis";
import { deriveVerdict } from "../../../../lib/analyzer/verdict";
import { acquireCompany } from "../../../../lib/analyzer/acquisition/provider";

const SELECTION = "None of these are non-operating";
const fmt = (v: unknown) => (v instanceof Decimal ? v.toFixed(2) : v == null ? null : String(v));

async function main(): Promise<void> {
  const out: Record<string, unknown> = {};
  for (const ticker of process.argv.slice(2).map((t) => t.toUpperCase())) {
    try {
      const acquired = await acquireCompany(ticker, { price: null });
      const candidates = acquired.acquisition.candidateNonOperatingInvestments.map((c) => ({ tag: c.tag, value: fmt(c.value) }));
      const runId = await createRun(ticker, ticker);
      await recordJudgment(runId, "NON-OPERATING INVESTMENTS", SELECTION, "AR8 WHAT-IF — not Calvin's answer");
      await advanceRunAutomatically(runId);
      const report = await analysisForReport(runId, null);
      const r = report.result;
      const v = deriveVerdict(r);
      const ev = r.diagnostics.enterpriseValue;
      out[ticker] = {
        runId,
        candidates,
        price: fmt(r.price?.value),
        rate: fmt(r.valuationBasis?.discountRate.rate),
        evState: ev.suppressed ? `${ev.state} — ${ev.cause}` : "COMPUTED",
        bearBaseBull: Object.fromEntries(Object.entries(r.scenarioOutputs.values).map(([k, x]) => [k, fmt(x)])),
        baseAtCheckRates: r.verdictInputs?.baseAtCheckRates
          ? Object.fromEntries(Object.entries(r.verdictInputs.baseAtCheckRates).map(([k, x]) => [k, fmt(x)]))
          : r.verdictInputs?.baseAtCheckRatesCause ?? null,
        verdict: { status: v.status, state: v.state, draftZone: v.draftZone ?? null, rampDependent: v.rampDependent ?? null },
      };
    } catch (err) {
      out[ticker] = { error: err instanceof Error ? err.message : String(err) };
    }
    console.error(`${ticker} done`);
  }
  console.log(JSON.stringify({ selection: SELECTION, note: "WHAT-IF, not Calvin's answer; no model call", out }, null, 2));
}

main().finally(() => getPool().end());
