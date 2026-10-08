import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getPool } from "../../lib/db";
import { createRun } from "../../lib/analyzer/runStore";
import { advanceRunAutomatically } from "../../lib/analyzer/autoRun";
import { analysisForReport } from "../../lib/analyzer/reportAnalysis";
import { analystInputsFor } from "../../lib/analyzer/acquisition/analystInputs";
import { analystCallIfConfigured } from "../../lib/analyzer/ai/anthropicCall";
import type { AnalystCall, AnalystCallRequest } from "../../lib/analyzer/ai/analystCall";
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
// CF-ANALYZER-USER-READY-01 — per-stage timing. `acceptance.md` and the
// console also carry: wall-clock milliseconds for acquisition/auto-decide,
// deterministic computation and the AI layer (via `analysisForReport`'s
// optional `onStage` hook); one row per physical model call (interpretation,
// challenger) with its own milliseconds, from wrapping the same `call` seam
// the AI layer already takes as a parameter; and the `[analyzer]` log lines
// the AI layer already writes on a regenerate/recover, which are this run's
// own record of each attempt's validation outcome. No retry/validation
// behaviour changes — this only times and echoes what already happens.
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

interface StageTiming {
  stage: string;
  ms: number;
}

interface AiAttempt {
  label: AnalystCallRequest["label"];
  attempt: number;
  ms: number;
}

/** Wraps the AI call seam to count and time every physical model call, by label. Never changes what is sent or how a refusal is handled — `base` still owns that. */
function instrumentCall(base: AnalystCall): { call: AnalystCall; attempts: AiAttempt[] } {
  const attempts: AiAttempt[] = [];
  const counts: Partial<Record<AnalystCallRequest["label"], number>> = {};
  const call: AnalystCall = async (request) => {
    const attempt = (counts[request.label] ?? 0) + 1;
    counts[request.label] = attempt;
    const started = Date.now();
    try {
      return await base(request);
    } finally {
      attempts.push({ label: request.label, attempt, ms: Date.now() - started });
    }
  };
  return { call, attempts };
}

/**
 * Runs `fn` while collecting every `[analyzer] ...` line it writes to
 * stderr — the AI layer's own existing log channel (`writeAnalystLog`) — so
 * this probe can echo each attempt's regenerate/recover outcome without
 * reading the AI layer's internals. Everything written still reaches the
 * real stderr unchanged; this only also copies the lines this probe cares
 * about.
 */
async function captureAnalyzerLog<T>(fn: () => Promise<T>): Promise<{ value: T; lines: string[] }> {
  const lines: string[] = [];
  const original = process.stderr.write.bind(process.stderr);
  const prefix = "[analyzer] ";
  (process.stderr.write as unknown) = (chunk: unknown, ...rest: unknown[]) => {
    const text = typeof chunk === "string" ? chunk : String(chunk);
    for (const line of text.split("\n")) {
      if (line.startsWith(prefix)) lines.push(line.slice(prefix.length));
    }
    return (original as (...args: unknown[]) => boolean)(chunk, ...rest);
  };
  try {
    const value = await fn();
    return { value, lines };
  } finally {
    process.stderr.write = original;
  }
}

function formatTimingMarkdown(timings: StageTiming[], attempts: AiAttempt[], analyzerLogLines: string[]): string {
  const lines: string[] = ["", "## Stage timings"];
  for (const t of timings) lines.push(`- ${t.stage}: ${t.ms}ms`);
  if (timings.length > 0) {
    lines.push(`- **total measured:** ${timings.reduce((sum, t) => sum + t.ms, 0)}ms`);
  }
  lines.push("", attempts.length > 0 ? "### AI model calls (one row per physical call)" : "### AI model calls");
  if (attempts.length > 0) {
    for (const a of attempts) lines.push(`- ${a.label} attempt ${a.attempt}: ${a.ms}ms`);
  } else {
    lines.push("_No model call ran — no credentials configured, or this run's AI outputs were already stored._");
  }
  if (analyzerLogLines.length > 0) {
    lines.push(
      "",
      "### `[analyzer]` log lines (each attempt's validation/regenerate outcome)",
      "",
      "```",
      ...analyzerLogLines,
      "```"
    );
  }
  return lines.join("\n");
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
  const timings: StageTiming[] = [];
  let attempts: AiAttempt[] = [];
  let analyzerLogLines: string[] = [];
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
    const acquisitionStarted = Date.now();
    await advanceRunAutomatically(runId);
    timings.push({ stage: "acquisition + automatic decisions (advanceRunAutomatically)", ms: Date.now() - acquisitionStarted });

    stage = "compute the report (analysis + AI layer)";
    const baseCall = analystCallIfConfigured();
    const instrumented = baseCall !== null ? instrumentCall(baseCall) : null;
    const { value: report, lines: capturedLogLines } = await captureAnalyzerLog(() =>
      analysisForReport(runId!, instrumented?.call ?? null, (stageName, ms) => {
        timings.push({
          stage: stageName === "compute" ? "deterministic computation" : "AI layer (interpretation + challenger)",
          ms,
        });
      })
    );
    attempts = instrumented?.attempts ?? [];
    analyzerLogLines = capturedLogLines;

    stage = "render the normal Overview";
    const overviewStarted = Date.now();
    const overviewText = overviewTabText(runId, report);
    timings.push({ stage: "render the normal Overview", ms: Date.now() - overviewStarted });

    stage = "check the acceptance contract";
    const acceptance = checkBriefAcceptance({ ticker, policy: ACCEPTANCE_POLICY[ticker], report, overviewText });

    const timingSection = formatTimingMarkdown(timings, attempts, analyzerLogLines);
    const summary = `${formatBriefAcceptanceMarkdown(acceptance, { runId })}\n${timingSection}`;
    writeFileSync(file("acceptance.md"), `${summary}\n`);
    writeFileSync(file("overview.txt"), `${overviewText}\n`);
    writeFileSync(
      file("report.json"),
      `${JSON.stringify({ ticker, runId, acceptance, aiLayer: report.aiLayer, result: report.result, timings, attempts }, null, 2)}\n`
    );

    console.log(summary);
    console.log(`\nACCEPTANCE ${acceptance.pass ? "PASS" : "FAIL"} — ${ticker}`);
    if (!acceptance.pass) process.exitCode = 1;
  } catch (err) {
    const cause = describeError(err);
    const summaryLines = [`### ${ticker} — FAIL (the run could not complete)`];
    if (runId !== null) summaryLines.push(`Run \`${runId}\``);
    summaryLines.push("", `Stopped while trying to **${stage}**: ${cause}`);
    const summary = `${summaryLines.join("\n")}\n${formatTimingMarkdown(timings, attempts, analyzerLogLines)}`;
    writeFileSync(file("acceptance.md"), `${summary}\n`);
    writeFileSync(
      file("report.json"),
      `${JSON.stringify({ ticker, runId, stage, error: cause, timings, attempts }, null, 2)}\n`
    );
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
