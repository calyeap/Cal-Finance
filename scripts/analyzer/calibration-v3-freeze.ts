import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Decimal from "decimal.js";
import Anthropic from "@anthropic-ai/sdk";
import { getPool } from "../../lib/db";
import { acquireCompany } from "../../lib/analyzer/acquisition/provider";
import { anthropicAnalystCall, ANALYST_MODEL } from "../../lib/analyzer/ai/anthropicCall";
import type { AnalystCall } from "../../lib/analyzer/ai/analystCall";
import { draftAssumptionSheet } from "../../lib/analyzer/acquisition/aiProposedBundle";
import { latestPrice } from "../../lib/analyzer/gate";
import { getCompanyJudgmentOverride } from "../../lib/analyzer/runStore";
import { selectionToNonOperatingInvestments } from "../../lib/analyzer/acquisition/nonOperatingJudgment";
import { buildAcquiredRun } from "../../lib/analyzer/acquiredRun";
import { assembleAnalysisResult } from "../../lib/analyzer/assemble";
import { deriveVerdict } from "../../lib/analyzer/verdict";
import { bundleFromSheet, type AssumptionSheet } from "../../lib/analyzer/sheets/sheet";

// ---------------------------------------------------------------------------
// CF-METHODOLOGY-V3-CALIBRATION-01 (issue #495) — TEST / evidence only.
// Freezes the inputs the calibration varies methodology over: ONE median-of-
// three, price-blind DRAFT sheet per golden company the engine values, drafted
// once through the production drafting path from the committed 19 Oct SEC
// captures (no SEC endpoint is called: the research reads filed XBRL history
// only), valued unadopted through the production engine at the 19 Oct close,
// and written in export-draft-run.ts's shape (MSFT's frozen run is
// docs/evidence/ar7-prototype/msft-run.json). Nothing is written to any
// database; no live default changes.
//
//   --preflight   free: count_tokens on every drafting request, no model call
//   (default)     paid: drafts under a hard cap (CAL_CAP_USD, default $5 total)
//
// Run: ANTHROPIC_API_KEY=… DATABASE_URL=… npx tsx scripts/analyzer/calibration-v3-freeze.ts [--preflight] [TICKER …]
// ---------------------------------------------------------------------------

const CAPTURE_SET = path.join("lib", "analyzer", "acquisition", "captures", "ar6-2026-10-19");
const DEFAULT_TICKERS = ["COST", "NVDA", "NUE", "KO", "LLY"];
const PRICE_DATE = "2026-10-19";
const OUT_DIR = path.join("docs", "evidence", "methodology-v3-calibration");

// claude-opus-5 list price, USD per token (thinking bills as output).
const INPUT_USD = 5 / 1e6;
const OUTPUT_USD = 25 / 1e6;
const PRODUCTION_MAX_TOKENS = 16000;

function countParams(params: Record<string, unknown>) {
  return {
    model: params.model,
    system: params.system,
    messages: params.messages,
    thinking: params.thinking,
    output_config: params.output_config,
  } as Parameters<Anthropic["messages"]["countTokens"]>[0];
}

/** export-draft-run.ts's metered client: one cap shared by every company in this run. */
function meteredClient(capUsd: number) {
  const client = new Anthropic();
  const usage = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, capUsd, perTicker: {} as Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }> };
  let ticker = "";
  const create = client.messages.create.bind(client.messages);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client.messages as any).create = async (params: any, options?: any) => {
    const counted = await client.messages.countTokens(countParams(params));
    const room = capUsd - usage.costUsd - counted.input_tokens * INPUT_USD;
    const affordable = Math.floor(room / OUTPUT_USD);
    if (affordable < 1024) throw new Error(`spend cap $${capUsd} reached before call ${usage.calls + 1}`);
    const response = await create({ ...params, max_tokens: Math.min(params.max_tokens, affordable) }, options);
    const cost = response.usage.input_tokens * INPUT_USD + response.usage.output_tokens * OUTPUT_USD;
    usage.calls += 1;
    usage.inputTokens += response.usage.input_tokens;
    usage.outputTokens += response.usage.output_tokens;
    usage.costUsd += cost;
    const t = (usage.perTicker[ticker] ??= { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });
    t.calls += 1;
    t.inputTokens += response.usage.input_tokens;
    t.outputTokens += response.usage.output_tokens;
    t.costUsd += cost;
    console.log(`  ${ticker} call ${t.calls} — in ${response.usage.input_tokens}, out ${response.usage.output_tokens}, running $${usage.costUsd.toFixed(4)}`);
    return response;
  };
  return { client, usage, setTicker: (t: string) => (ticker = t) };
}

/** Free preflight: counts the exact drafting request, then refuses it so no model call is made. */
function countingCall(client: Anthropic, tally: number[]): AnalystCall {
  return async (request) => {
    const counted = await client.messages.countTokens(
      countParams({
        model: ANALYST_MODEL,
        system: request.system,
        messages: [{ role: "user", content: request.user }],
        thinking: { type: "adaptive" },
        output_config: { effort: "high", format: { type: "json_schema", schema: request.responseSchema } },
      })
    );
    tally.push(counted.input_tokens);
    throw new Error("preflight: counted, not sent");
  };
}

/**
 * captureFor() reads <cwd>/lib/analyzer/acquisition/captures/<ticker>-companyfacts.json.
 * Stage the 19 Oct set at that path in a temp dir and run from there, so the
 * production CAPTURE path reads exactly the committed 19 Oct files.
 */
function stageCaptures(repoRoot: string): string {
  const stage = mkdtempSync(path.join(tmpdir(), "cf-v3-captures-"));
  const dir = path.join(stage, "lib", "analyzer", "acquisition", "captures");
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(path.join(repoRoot, CAPTURE_SET))) symlinkSync(path.join(repoRoot, CAPTURE_SET, f), path.join(dir, f));
  return stage;
}

function plain(_key: string, value: unknown): unknown {
  return value instanceof Decimal ? value.toString() : value;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const preflight = args.includes("--preflight");
  const tickers = args.filter((a) => !a.startsWith("--")).map((t) => t.toUpperCase());
  const list = tickers.length > 0 ? tickers : DEFAULT_TICKERS;
  if ((process.env.ANTHROPIC_API_KEY ?? "").trim() === "") {
    console.error("calibration-v3-freeze: no ANTHROPIC_API_KEY.");
    process.exitCode = 1;
    return;
  }
  const repoRoot = process.cwd();
  const outDir = path.join(repoRoot, process.env.PROOF_OUTPUT_DIR ?? OUT_DIR);
  process.env.CAL_FINANCE_CODE_VERSION ??= execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  process.chdir(stageCaptures(repoRoot));

  if (preflight) {
    const client = new Anthropic();
    let total = 0;
    for (const ticker of list) {
      const tally: number[] = [];
      const acquired = await acquireCompany(ticker, { price: null, source: "CAPTURE" });
      await draftAssumptionSheet(ticker, acquired, countingCall(client, tally), null);
      const input = tally[0] ?? 0;
      total += input;
      console.log(`${ticker}: ${input} input tokens per drafting call (${tally.length} counted)`);
    }
    const calls = list.length * 3;
    const avg = total / list.length;
    console.log(
      `\nPREFLIGHT: ${calls} first-pass calls; input ≈ $${(calls * avg * INPUT_USD).toFixed(3)}; ` +
        `worst case at the ${PRODUCTION_MAX_TOKENS}-token output ceiling ≈ $${(calls * (avg * INPUT_USD + PRODUCTION_MAX_TOKENS * OUTPUT_USD)).toFixed(2)} ` +
        `(the metered client stops at the cap whatever happens).`
    );
    return;
  }

  const capUsd = Number(process.env.CAL_CAP_USD ?? "5");
  const metered = meteredClient(capUsd);
  const call = anthropicAnalystCall(metered.client);
  mkdirSync(outDir, { recursive: true });
  for (const ticker of list) {
    const file = path.join(outDir, `${ticker.toLowerCase()}-run.json`);
    if (existsSync(file)) {
      console.log(`${ticker}: already frozen at ${file} — not redrafted`);
      continue;
    }
    metered.setTicker(ticker);
    console.log(`${ticker}: drafting (median of three, price-blind, 19 Oct capture)…`);
    const acquired = await acquireCompany(ticker, { price: null, source: "CAPTURE" });
    const outcome = await draftAssumptionSheet(ticker, acquired, call, null, PRICE_DATE);
    if (outcome.kind === "REFUSED") {
      console.error(`${ticker}: could not be drafted — ${outcome.cause}`);
      writeFileSync(path.join(outDir, `${ticker.toLowerCase()}-refused.json`), JSON.stringify({ ticker, cause: outcome.cause, usage: metered.usage.perTicker[ticker] ?? null }, null, 2) + "\n");
      continue;
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
    if (price === null || price.timestamp.slice(0, 10) !== PRICE_DATE) {
      throw new Error(`${ticker}: the latest close is not the ${PRICE_DATE} close (${price?.timestamp ?? "no price"}) — refusing to mix price dates`);
    }
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
      source: "CAPTURE",
    });
    const result = assembleAnalysisResult(run.fixture);
    const verdict = deriveVerdict(result);
    const base = run.fixture.reverseDcf.baseYearRevenue;
    writeFileSync(
      file,
      JSON.stringify(
        {
          capture: {
            note: "CF-METHODOLOGY-V3-CALIBRATION-01 (#495): one median-of-three DRAFT sheet from the committed 19 Oct SEC capture, valued unadopted, read-only. Frozen: the calibration varies methodology only.",
            exportedAt: new Date().toISOString(),
            ticker,
            secCapture: `${CAPTURE_SET}/${ticker.toLowerCase()}-companyfacts.json`,
            research: "filed XBRL history only — no SEC endpoint called (no earnings-release text; no 10-K Item 1 in the capture)",
            price,
            nonOperatingSelection: override?.selection ?? "None of these are non-operating",
            model: sheet.model,
            usage: metered.usage.perTicker[ticker] ?? { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
          },
          engineInputs: {
            baseRevenue: base?.value ?? null,
            baseRevenueVerification: base?.provenance.verificationState ?? null,
            valuationBase: run.fixture.valuationBase ?? null,
          },
          sheet,
          verdict,
          result,
        },
        plain,
        2
      ) + "\n"
    );
    console.log(`${ticker}: → ${file} (verdict ${verdict.state})`);
  }
  console.log(`\nSPEND: ${metered.usage.calls} calls, ${metered.usage.inputTokens} in + ${metered.usage.outputTokens} out = $${metered.usage.costUsd.toFixed(4)} of the $${capUsd} cap`);
  writeFileSync(path.join(outDir, "spend.json"), JSON.stringify(metered.usage, null, 2) + "\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => getPool().end());
