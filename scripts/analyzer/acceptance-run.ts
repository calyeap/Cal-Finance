import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getPool } from "../../lib/db";
import { createRun } from "../../lib/analyzer/runStore";
import { advanceRunAutomatically } from "../../lib/analyzer/autoRun";
import { analysisForReport } from "../../lib/analyzer/reportAnalysis";
import { analystInputsFor } from "../../lib/analyzer/acquisition/analystInputs";
import { overviewTabText } from "../../app/components/overviewTabMarkup";
import {
  ACCEPTANCE_POLICY,
  checkBriefAcceptance,
  formatBriefAcceptanceMarkdown,
  isProofTicker,
  PROOF_TICKERS,
} from "../../lib/analyzer/acceptance/briefAcceptance";

// ---------------------------------------------------------------------------
// The live acceptance probe for PR #399 (CF-ANALYZER-V1-SETTLE-01).
//
// Runs the product's normal post-identity path exactly as the report page
// does — createRun -> advanceRunAutomatically -> analysisForReport — records
// no human fact/profile/judgment decision, renders the normal Overview, and
// applies the one acceptance contract (lib/analyzer/acceptance/
// briefAcceptance.ts) that the CI fixture tests also exercise.
//
// Evidence, not a bit: whatever happens, it writes into PROOF_OUTPUT_DIR
// (default ./proof):
//   <ticker>-acceptance.md   per-section result, with the cause of every failure
//   <ticker>-report.json     the full Analysis Result, AI-layer status, acceptance
//   <ticker>-overview.txt    the rendered Overview's visible text
// and prints the summary. A crash at any stage is reported with that stage
// and the error, never only a stack trace.
//
// Exit 0 = this ticker meets the contract. Exit 1 = it does not, or the run
// could not complete.
//
// Run:  npx tsx scripts/analyzer/acceptance-run.ts MSFT
// ---------------------------------------------------------------------------

const COMPANY_NAMES: Record<(typeof PROOF_TICKERS)[number], string> = {
  MSFT: "Microsoft Corporation",
  NVDA: "NVIDIA Corporation",
  COST: "Costco Wholesale Corporation",
};

function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

async function main(): Promise<void> {
  const ticker = (process.argv[2] ?? "").trim().toUpperCase();
  if (!isProofTicker(ticker)) {
    console.error(`Usage: acceptance-run.ts <${PROOF_TICKERS.join("|")}>`);
    process.exitCode = 1;
    return;
  }

  const outDir = process.env.PROOF_OUTPUT_DIR ?? "proof";
  mkdirSync(outDir, { recursive: true });
  const file = (suffix: string) => path.join(outDir, `${ticker.toLowerCase()}-${suffix}`);

  let stage = "resolve this company's analyst inputs (committed, recorded or AI-proposed bundle)";
  let runId: string | null = null;
  try {
    // A ticker with no analyst-input bundle cannot open a run, and gate.ts
    // reports that only as "No run <id>". Resolving it first names the stage;
    // the [analyzer] log lines printed above name the cause. The resolvers'
    // in-process caches let the run below reuse this answer, not re-ask it.
    if ((await analystInputsFor(ticker)) === null) {
      throw new Error(
        `no analyst-input bundle could be resolved for ${ticker}, so a run cannot open — the [analyzer] log lines in this ticker's console name the cause`
      );
    }
    stage = "create the run";
    runId = await createRun(ticker, COMPANY_NAMES[ticker]);
    stage = "advance the run automatically";
    await advanceRunAutomatically(runId);
    stage = "compute the report (analysis + AI layer)";
    const report = await analysisForReport(runId);
    stage = "render the normal Overview";
    const overviewText = overviewTabText(runId, report);
    stage = "check the acceptance contract";
    const acceptance = checkBriefAcceptance({ ticker, policy: ACCEPTANCE_POLICY[ticker], report, overviewText });

    const summary = formatBriefAcceptanceMarkdown(acceptance, { runId });
    writeFileSync(file("acceptance.md"), `${summary}\n`);
    writeFileSync(file("overview.txt"), `${overviewText}\n`);
    writeFileSync(
      file("report.json"),
      `${JSON.stringify({ ticker, runId, acceptance, aiLayer: report.aiLayer, result: report.result }, null, 2)}\n`
    );

    console.log(summary);
    console.log(`\nACCEPTANCE ${acceptance.pass ? "PASS" : "FAIL"} — ${ticker}`);
    if (!acceptance.pass) process.exitCode = 1;
  } catch (err) {
    const cause = describeError(err);
    const summaryLines = [`### ${ticker} — FAIL (the run could not complete)`];
    if (runId !== null) summaryLines.push(`Run \`${runId}\``);
    summaryLines.push("", `Stopped while trying to **${stage}**: ${cause}`);
    const summary = summaryLines.join("\n");
    writeFileSync(file("acceptance.md"), `${summary}\n`);
    writeFileSync(file("report.json"), `${JSON.stringify({ ticker, runId, stage, error: cause }, null, 2)}\n`);
    console.log(summary);
    console.error(err);
    console.log(`\nACCEPTANCE FAIL — ${ticker}`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end();
  });
