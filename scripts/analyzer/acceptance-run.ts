import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
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
// CF-AR8-REAL-APP-ACCEPTANCE-01 (#457) — AR8 runs this probe for all eight
// golden companies (product-decisions item 31), not only the three proof
// tickers. The other five get the COMPLETE_OR_EXPLAINED policy; the bank and
// the pre-revenue company are expected to refuse / not conclude, and the run
// records what the product actually did. Opt-in spend cap for paid cloud
// runs: CAL_CAP_USD=<total> meters every model call (a free count_tokens
// preflight before each; a call whose worst case would cross the cap is
// refused, never sent) into <PROOF_OUTPUT_DIR>/spend.json, shared by every
// ticker run against that directory. CAL_PREFLIGHT=1 counts and sends
// nothing. Unset, nothing changes (the live-proof workflow's path).
//
// Run:  npx tsx scripts/analyzer/acceptance-run.ts MSFT
// ---------------------------------------------------------------------------

const GOLDEN_TICKERS = [...PROOF_TICKERS, "NUE", "KO", "LLY", "OKLO", "JPM"] as const;
type GoldenTicker = (typeof GOLDEN_TICKERS)[number];

const COMPANY_NAMES: Record<GoldenTicker, string> = {
  MSFT: "Microsoft Corporation",
  NVDA: "NVIDIA Corporation",
  COST: "Costco Wholesale Corporation",
  NUE: "Nucor Corporation",
  KO: "The Coca-Cola Company",
  LLY: "Eli Lilly and Company",
  OKLO: "Oklo Inc.",
  JPM: "JPMorgan Chase & Co.",
};

function isGoldenTicker(value: string): value is GoldenTicker {
  return (GOLDEN_TICKERS as readonly string[]).includes(value);
}

// claude-opus-5 list price, USD per token (thinking bills as output) — the
// same constants calibration-v3-freeze.ts metered #495 with.
const INPUT_USD = 5 / 1e6;
const OUTPUT_USD = 25 / 1e6;

interface SpendLedger {
  capUsd: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  rows: { ticker: string; preflight: boolean; inputTokens: number; outputTokens: number; costUsd: number }[];
}

/**
 * Meters every Messages.create in this process (the production call sites
 * construct their own clients) against one ledger file. The request itself is
 * never altered: a call is sent whole or refused before it is sent. Calls run
 * concurrently (interpretation and challenger), so the ledger lives in memory
 * for the process and each in-flight call reserves its worst case first.
 */
function meterModelCalls(ticker: string, ledgerFile: string, capUsd: number, preflight: boolean): void {
  const ledger: SpendLedger = existsSync(ledgerFile)
    ? JSON.parse(readFileSync(ledgerFile, "utf8"))
    : { capUsd, calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, rows: [] };
  let reservedUsd = 0;
  const save = () => writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const proto = Anthropic.Messages.prototype as unknown as { create: (...a: unknown[]) => Promise<Anthropic.Message> };
  const create = proto.create;
  proto.create = async function (this: Anthropic.Messages, ...args: unknown[]) {
    const params = args[0] as Record<string, unknown>;
    const counted = await this.countTokens({
      model: params.model,
      system: params.system,
      messages: params.messages,
      thinking: params.thinking,
      output_config: params.output_config,
    } as Anthropic.MessageCountTokensParams);
    if (preflight) {
      ledger.rows.push({ ticker, preflight: true, inputTokens: counted.input_tokens, outputTokens: 0, costUsd: 0 });
      save();
      throw new Error(`preflight: counted ${counted.input_tokens} input tokens, not sent`);
    }
    const worstCase = counted.input_tokens * INPUT_USD + Number(params.max_tokens) * OUTPUT_USD;
    if (ledger.costUsd + reservedUsd + worstCase > capUsd) {
      throw new Error(
        `spend cap $${capUsd} — $${ledger.costUsd.toFixed(4)} spent, $${reservedUsd.toFixed(4)} in flight; this call's worst case $${worstCase.toFixed(4)} would cross it, so it was not sent`
      );
    }
    reservedUsd += worstCase;
    try {
      const response = await create.apply(this, args);
      const cost = response.usage.input_tokens * INPUT_USD + response.usage.output_tokens * OUTPUT_USD;
      ledger.calls += 1;
      ledger.inputTokens += response.usage.input_tokens;
      ledger.outputTokens += response.usage.output_tokens;
      ledger.costUsd += cost;
      ledger.rows.push({ ticker, preflight: false, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, costUsd: cost });
      save();
      console.log(`  [spend] ${ticker} in ${response.usage.input_tokens}, out ${response.usage.output_tokens}, $${cost.toFixed(4)}; total $${ledger.costUsd.toFixed(4)} of $${capUsd}`);
      return response;
    } finally {
      reservedUsd -= worstCase;
    }
  };
}

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
  if (!isGoldenTicker(ticker)) {
    console.error(`Usage: acceptance-run.ts <${GOLDEN_TICKERS.join("|")}>`);
    process.exitCode = 1;
    return;
  }

  const outDir = process.env.PROOF_OUTPUT_DIR ?? "proof";
  mkdirSync(outDir, { recursive: true });
  const capUsd = Number(process.env.CAL_CAP_USD ?? "");
  if (Number.isFinite(capUsd) && capUsd > 0) {
    meterModelCalls(ticker, path.join(outDir, "spend.json"), capUsd, process.env.CAL_PREFLIGHT === "1");
  }
  const file = (suffix: string) => path.join(outDir, `${ticker.toLowerCase()}-${suffix}`);

  let stage = "resolve this company's assumption sheet (in force, or a fresh price-blind draft)";
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
        `no assumption sheet could be resolved or drafted for ${ticker}, so a run cannot open — the [analyzer] log lines in this ticker's console name the cause`
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
    const acceptance = checkBriefAcceptance({
      ticker,
      policy: isProofTicker(ticker) ? ACCEPTANCE_POLICY[ticker] : "COMPLETE_OR_EXPLAINED",
      report,
      overviewText,
    });

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
