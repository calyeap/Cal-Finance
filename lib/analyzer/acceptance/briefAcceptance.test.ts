import { describe, it, expect } from "vitest";
import { assembleAnalysisResult, type CompanyFixture } from "@/lib/analyzer/assemble";
import { MSFT_FIXTURE } from "@/lib/analyzer/fixtures/msft";
import type { AnalysisResult, InterpretationStatement, PageOneProse } from "@/lib/analyzer/types";
import type { ReportAnalysis } from "@/lib/analyzer/reportAnalysis";
import { overviewTabText } from "@/app/components/overviewTabMarkup";
import {
  checkBriefAcceptance,
  formatBriefAcceptanceMarkdown,
  ACCEPTANCE_POLICY,
  type AcceptancePolicy,
} from "./briefAcceptance";

// ---------------------------------------------------------------------------
// CF-ANALYZER-V1-SETTLE-01 — fixture coverage for the live proof's evaluator,
// so an evaluator change is proved in CI before any live run spends a Calvin
// dispatch on it (PR #399 audit, 7 Oct 2026). Every case renders the real
// normal Overview (overviewTabMarkup.tsx — the same function the live probe
// calls) from an assembled Analysis Result; nothing here mocks the page.
//
// The first block is the regression for the two evaluator bugs that failed
// the 7 Oct live proof (run 37566908890) on MSFT: market cap / EV and the
// 52-week range were reported "non-finite" because the old probe read each
// breakdown object as if it were a Decimal.
// ---------------------------------------------------------------------------

function statement(text: string): InterpretationStatement {
  return { responsibility: "ASSUMPTION PLAUSIBILITY AND WHAT THE PRICE REQUIRES", statement: text, referencesValueIds: [] };
}

const PAGE_ONE: PageOneProse = {
  mainFinding: statement("The price requires sustained high growth alongside a margin held at the top of its own history."),
  whatSupportsTheCase: statement("Filed history is long, the debt load is low and margins have been stable."),
  whatWorriesCalboard: statement("Most of the enterprise value rests on growth opportunities rather than today's cash flow."),
  biggestUncertainty: statement("The discount rate, which moves the required growth more than any other input."),
};

const BUSINESS = {
  narrative: {
    source: "MARKET-DATA PROVIDER SUMMARY" as const,
    text: "Microsoft Corporation develops and supports software, services, devices and solutions worldwide.",
    provider: "YAHOO",
    retrievedAt: "2026-10-07T03:30:00.000Z",
    primaryUnavailableReason: 'The Item 1 extraction rule could not locate the section in the filing: no standalone "Item 1. Business" heading line was found.',
  },
  unavailableReason: null,
};

function complete(result: AnalysisResult, overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    ...result,
    business: BUSINESS,
    latestFiling: { form: "8-K", filingDate: "2026-08-14" },
    interpretation: { ...result.interpretation, pageOne: PAGE_ONE },
    ...overrides,
  };
}

function reportFor(result: AnalysisResult): ReportAnalysis {
  return { result, aiLayer: { status: "COMPLETED", model: "test-model", detail: null } };
}

function check(ticker: string, policy: AcceptancePolicy, report: ReportAnalysis, overviewText = overviewTabText("run-under-test", report)) {
  return checkBriefAcceptance({ ticker, policy, report, overviewText });
}

/** NVDA's live shape: the balance-sheet inputs its EV and leverage need are missing, and it has no analyst sensitivity range. */
function nvdaLike(): CompanyFixture {
  return {
    ...MSFT_FIXTURE,
    ticker: "NVDA",
    companyName: "NVIDIA Corporation",
    leverage: { ...MSFT_FIXTURE.leverage, financeLeaseLiabilities: null },
    enterpriseValue: {
      ...MSFT_FIXTURE.enterpriseValue,
      treasuryMethodDilution: null,
      financeLeaseLiabilities: null,
      nonOperatingEquityInvestmentsAtBook: null,
    },
  };
}

/** COST's expected live shape: an AI-proposed bundle (no authored dollar values) and no §4.4 judgment, so EV and the dynamic scenario values cannot be computed. */
function costLike(): CompanyFixture {
  return {
    ...MSFT_FIXTURE,
    ticker: "COST",
    companyName: "Costco Wholesale Corporation",
    scenarioValues: null,
    enterpriseValue: { ...MSFT_FIXTURE.enterpriseValue, nonOperatingEquityInvestmentsAtBook: null },
  };
}

describe("the evaluator reads the Analysis Result's real shapes (regression: 7 Oct 2026 live proof, MSFT)", () => {
  const report = reportFor(complete(assembleAnalysisResult(MSFT_FIXTURE)));
  const acceptance = check("MSFT", "FULL_BRIEF", report);
  const keyStats = acceptance.sections.find((s) => s.id === 4)!;

  it("market cap is read from the EV breakdown's own Decimal — never reported non-finite", () => {
    const ev = report.result.diagnostics.enterpriseValue;
    expect(ev.suppressed).toBe(false);
    if (!ev.suppressed) expect(keyStats.detail).toContain(`Market cap ${ev.value.marketCap.toSignificantDigits(6).toString()}`);
    expect(keyStats.detail).not.toMatch(/non-finite|not finite/);
  });

  it("the 52-week range is read from marginHistory.value.fiftyTwoWeekRange — never from the margin-history object itself", () => {
    expect(keyStats.detail).toContain("52-week range 410–560");
    expect(keyStats.status).toBe("CONTENT");
  });
});

describe("MSFT — the full brief", () => {
  it("a complete MSFT report passes the full-brief contract, every section with content", () => {
    const acceptance = check("MSFT", ACCEPTANCE_POLICY.MSFT, reportFor(complete(assembleAnalysisResult(MSFT_FIXTURE))));

    expect(acceptance.failures).toEqual([]);
    expect(acceptance.pass).toBe(true);
    expect(acceptance.sections.map((s) => s.status)).toEqual(Array(10).fill("CONTENT"));
    expect(acceptance.forbidden).toEqual([]);
  });

  it("the business section says which source was used and, for the fallback, why the 10-K excerpt was not", () => {
    const acceptance = check("MSFT", "FULL_BRIEF", reportFor(complete(assembleAnalysisResult(MSFT_FIXTURE))));
    const business = acceptance.sections.find((s) => s.id === 3)!;
    expect(business.detail).toContain("source: YAHOO company summary");
    expect(business.detail).toContain('no standalone "Item 1. Business" heading line was found');
  });

  it("a missing business description fails with its recorded cause printed", () => {
    const result = complete(assembleAnalysisResult(MSFT_FIXTURE), {
      business: { narrative: null, unavailableReason: "The 10-K filing document could not be fetched (HTTP 403)." },
    });
    const acceptance = check("MSFT", "FULL_BRIEF", reportFor(result));

    expect(acceptance.pass).toBe(false);
    expect(acceptance.failures.join("\n")).toContain("business description missing — The 10-K filing document could not be fetched (HTTP 403).");
  });

  it("a failed AI layer fails the brief and names the AI layer's own cause", () => {
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    const report: ReportAnalysis = {
      result: complete(result, { interpretation: { ...result.interpretation, pageOne: null } }),
      aiLayer: { status: "FAILED", model: null, detail: "the model did not respond" },
    };
    const acceptance = check("MSFT", "FULL_BRIEF", report);

    expect(acceptance.pass).toBe(false);
    expect(acceptance.failures.join("\n")).toContain("the AI layer did not complete (FAILED: the model did not respond)");
  });

  it("a Form 4 is not a material development", () => {
    const result = complete(assembleAnalysisResult(MSFT_FIXTURE), { latestFiling: { form: "4", filingDate: "2026-09-17" } });
    const acceptance = check("MSFT", "FULL_BRIEF", reportFor(result));

    expect(acceptance.sections.find((s) => s.id === 9)!.status).toBe("MISSING");
    expect(acceptance.failures.join("\n")).toContain("latest filing 4 (2026-09-17) is not a material filing form");
  });

  it("forbidden vocabulary anywhere on the rendered Overview fails it, with the offending text quoted", () => {
    const result = complete(assembleAnalysisResult(MSFT_FIXTURE), {
      interpretation: {
        ...assembleAnalysisResult(MSFT_FIXTURE).interpretation,
        pageOne: { ...PAGE_ONE, biggestUncertainty: statement("The check that would size that effect is INCOMPLETE.") },
      },
    });
    const acceptance = check("MSFT", "FULL_BRIEF", reportFor(result));

    expect(acceptance.pass).toBe(false);
    expect(acceptance.forbidden.map((f) => f.label)).toContain("INCOMPLETE");
    expect(acceptance.failures.join("\n")).toContain("The check that would size that effect is INCOMPLETE.");
  });
});

describe("NVDA and COST — complete, or explained in plain English (Calvin's Option 1)", () => {
  it("an NVDA-shaped report passes: every figure the engine cannot compute is explained on the rendered Overview", () => {
    const acceptance = check("NVDA", ACCEPTANCE_POLICY.NVDA, reportFor(complete(assembleAnalysisResult(nvdaLike()))));

    expect(acceptance.failures).toEqual([]);
    expect(acceptance.pass).toBe(true);
    const byId = Object.fromEntries(acceptance.sections.map((s) => [s.id, s.status]));
    expect(byId[4]).toBe("EXPLAINED"); // market cap, FCF yield, leverage
    expect(byId[5]).toBe("EXPLAINED"); // no fair-value range
    expect(byId[10]).toBe("EXPLAINED"); // no analyst sensitivity range
    expect(byId[3]).toBe("CONTENT");
    expect(byId[6]).toBe("CONTENT");
  });

  it("the same NVDA-shaped report fails the full brief, naming each explained section", () => {
    const acceptance = check("NVDA", "FULL_BRIEF", reportFor(complete(assembleAnalysisResult(nvdaLike()))));

    expect(acceptance.pass).toBe(false);
    expect(acceptance.failures.some((f) => f.startsWith("#5 Bear / Base / Bull and price context: the full brief needs content here"))).toBe(true);
  });

  it("a COST-shaped report (AI-proposed bundle, no §4.4 judgment) passes, and the hero never shows $NaN for the uncomputed base value", () => {
    const report = reportFor(complete(assembleAnalysisResult(costLike())));
    expect(report.result.scenarioOutputs.values.base.isNaN()).toBe(true);

    const text = overviewTabText("run-under-test", report);
    expect(text).not.toContain("NaN");
    const acceptance = check("COST", ACCEPTANCE_POLICY.COST, report, text);

    expect(acceptance.failures).toEqual([]);
    expect(acceptance.pass).toBe(true);
    expect(acceptance.sections.find((s) => s.id === 5)!.status).toBe("EXPLAINED");
  });

  it("an explanation the Overview did not actually render does not count", () => {
    const report = reportFor(complete(assembleAnalysisResult(nvdaLike())));
    const acceptance = check("NVDA", "COMPLETE_OR_EXPLAINED", report, "an Overview that shows none of the explanations");

    expect(acceptance.pass).toBe(false);
    expect(acceptance.failures.join("\n")).toContain("its plain-English reason was not rendered on the Overview");
  });
});

describe("the per-ticker summary posted to the PR", () => {
  it("lists all ten sections with status, and every failure with its cause", () => {
    const result = complete(assembleAnalysisResult(MSFT_FIXTURE), { latestFiling: null });
    const markdown = formatBriefAcceptanceMarkdown(check("MSFT", "FULL_BRIEF", reportFor(result)), { runId: "r-1" });

    expect(markdown).toContain("### MSFT — FAIL (full brief)");
    expect(markdown).toContain("Run `r-1`");
    expect(markdown.match(/^\| \d+ \|/gm)).toHaveLength(10);
    expect(markdown).toContain("- #9 Latest material development: no material SEC filing was acquired for this run");
  });
});
