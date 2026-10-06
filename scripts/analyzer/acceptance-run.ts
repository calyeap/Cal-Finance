import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { getPool } from "../../lib/db";
import { createRun } from "../../lib/analyzer/runStore";
import { advanceRunAutomatically } from "../../lib/analyzer/autoRun";
import { analysisForReport } from "../../lib/analyzer/reportAnalysis";

// Reliability-first acceptance probe for the normal Analyzer path.
// This deliberately does NOT record any human fact/profile/judgment decisions.
// It mirrors the product's normal post-identity path:
//   createRun -> advanceRunAutomatically -> analysisForReport.
//
// Exit 0 means the fresh report satisfies the bounded RM-brief completeness
// contract. Exit 1 means the report itself is not acceptable. GitHub Actions
// should trust this exit code, not merely whether the underlying process ran.

const COMPANY_NAMES: Record<string, string> = {
  MSFT: "Microsoft Corporation",
  NVDA: "NVIDIA Corporation",
  COST: "Costco Wholesale Corporation",
};

function isFiniteDecimal(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      "isFinite" in value &&
      typeof (value as { isFinite?: unknown }).isFinite === "function" &&
      (value as { isFinite: () => boolean }).isFinite()
  );
}

function nonEmpty(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function figureAvailable(figure: unknown): boolean {
  return Boolean(
    figure &&
      typeof figure === "object" &&
      "suppressed" in figure &&
      (figure as { suppressed: boolean }).suppressed === false
  );
}

function textOfStatement(statement: unknown): string | null {
  if (!statement || typeof statement !== "object" || !("statement" in statement)) return null;
  const text = (statement as { statement?: unknown }).statement;
  return typeof text === "string" && text.trim() !== "" ? text.trim() : null;
}

async function main(): Promise<void> {
  const ticker = (process.argv[2] ?? "").trim().toUpperCase();
  if (!(ticker in COMPANY_NAMES)) {
    console.error("Usage: npx tsx scripts/analyzer/acceptance-run.ts <MSFT|NVDA|COST>");
    process.exitCode = 1;
    return;
  }

  const failures: string[] = [];
  const runId = await createRun(ticker, COMPANY_NAMES[ticker]);
  await advanceRunAutomatically(runId);
  const report = await analysisForReport(runId);
  const result = report.result;
  const dynamic = result as unknown as Record<string, any>;

  if (result.ticker !== ticker) failures.push(`ticker mismatch: expected ${ticker}, got ${result.ticker}`);
  if (!nonEmpty(result.companyName)) failures.push("company name missing");
  if (!isFiniteDecimal(result.price?.value)) failures.push("current price missing or non-finite");
  if (!nonEmpty(result.price?.timestamp)) failures.push("price as-of timestamp missing");

  if (report.aiLayer.status !== "COMPLETED") {
    failures.push(`AI layer did not complete (${report.aiLayer.status}${report.aiLayer.detail ? `: ${report.aiLayer.detail}` : ""})`);
  }

  if (!nonEmpty(result.business?.narrative?.text)) failures.push("business description missing");

  const pageOne = result.interpretation?.pageOne;
  if (pageOne === null || pageOne === undefined) {
    failures.push("RM brief interpretation missing");
  } else {
    const requiredEditorial: Array<[string, unknown]> = [
      ["why own", pageOne.whatSupportsTheCase],
      ["why cautious", pageOne.whatWorriesCalboard],
      ["what matters most", pageOne.mainFinding],
      ["biggest risk", pageOne.biggestUncertainty],
    ];
    for (const [label, statement] of requiredEditorial) {
      if (textOfStatement(statement) === null) failures.push(`${label} missing`);
    }
  }

  if (result.fairValueRange?.kind !== "range") {
    failures.push(`bear/base/bull fair-value range unavailable (${result.fairValueRange?.kind ?? "missing"})`);
  } else {
    if (!isFiniteDecimal(result.fairValueRange.bear)) failures.push("bear range bound non-finite");
    if (!isFiniteDecimal(result.fairValueRange.bull)) failures.push("bull range bound non-finite");
    if (!isFiniteDecimal(result.fairValueRange.weightedValueInside)) {
      failures.push("weighted fair value non-finite");
    }
  }

  const scenarioValues = result.scenarioOutputs?.values;
  if (!isFiniteDecimal(scenarioValues?.bear)) failures.push("bear scenario value non-finite");
  if (!isFiniteDecimal(scenarioValues?.base)) failures.push("base scenario value non-finite");
  if (!isFiniteDecimal(scenarioValues?.bull)) failures.push("bull scenario value non-finite");

  if (!isFiniteDecimal(result.scenarioOutputs?.priceLocationWithinRange)) {
    failures.push("current-price context within scenario range missing");
  }

  const keyStats: Array<[string, unknown]> = [
    ["market cap / enterprise-value bridge", result.diagnostics?.enterpriseValue],
    ["trailing P/E", result.diagnostics?.multiples?.peTrailing],
    ["FCF yield", result.diagnostics?.multiples?.fcfYieldOnMarketCap],
    ["52-week / market range", result.diagnostics?.marginHistory],
  ];
  for (const [label, figure] of keyStats) {
    if (!figureAvailable(figure)) {
      failures.push(`${label} unavailable`);
    } else if (!isFiniteDecimal((figure as { value?: unknown }).value)) {
      failures.push(`${label} non-finite`);
    }
  }
  if (result.gates?.leverage?.result !== "PASS" || !isFiniteDecimal(result.gates?.leverage?.netDebtRatio)) {
    failures.push("compact leverage metric unavailable");
  }

  const forecastDispersion = dynamic?.diagnostics?.sensitivity?.forecastDispersion;
  if (!forecastDispersion || forecastDispersion.available !== true) {
    failures.push("what-would-change-view trigger unavailable");
  } else {
    if (!isFiniteDecimal(forecastDispersion.fullRangeValueImpact)) {
      failures.push("what-would-change-view impact non-finite");
    }
    if (!nonEmpty(forecastDispersion.selectedDriver)) {
      failures.push("what-would-change-view driver missing");
    }
    if (!["LOW", "MEDIUM", "HIGH"].includes(forecastDispersion.tier)) {
      failures.push("what-would-change-view tier invalid");
    }
  }

  const latestFiling = dynamic.latestFiling;
  if (!latestFiling || !nonEmpty(latestFiling.form) || !nonEmpty(latestFiling.filingDate)) {
    failures.push("latest material development / filing freshness missing");
  }


  const summary = {
    ticker,
    runId,
    companyName: result.companyName,
    price: result.price?.value?.toString?.() ?? null,
    priceAsOf: result.price?.timestamp ?? null,
    aiLayer: report.aiLayer.status,
    scenarios: {
      bear: scenarioValues?.bear?.toString?.() ?? null,
      base: scenarioValues?.base?.toString?.() ?? null,
      bull: scenarioValues?.bull?.toString?.() ?? null,
    },
    fairValueRange:
      result.fairValueRange?.kind === "range"
        ? {
            bear: result.fairValueRange.bear.toString(),
            bull: result.fairValueRange.bull.toString(),
            weightedValueInside: result.fairValueRange.weightedValueInside.toString(),
          }
        : { kind: result.fairValueRange?.kind ?? null },
    latestFiling: latestFiling ?? null,
    acceptance: failures.length === 0 ? "PASS" : "FAIL",
    failures,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failures.length > 0) {
    console.error(`\nACCEPTANCE FAIL — ${ticker}`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`\nACCEPTANCE PASS — ${ticker}`);
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
