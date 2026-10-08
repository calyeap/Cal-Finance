import Decimal from "decimal.js";
import type { AnalysisResult, Figure, InterpretationStatement } from "../types";
import type { ReportAnalysis } from "../reportAnalysis";
import type { Step4ForecastDispersionReading } from "../modules/sensitivity";
import { priceVsRangeHeadline, incompleteVerdictExplanation } from "../trustCopy";
import { profileNotConfirmedFor } from "../trust";
import {
  notComputedLine,
  leverageUnavailableLine,
  fairValueRangeUnavailableLine,
  overviewTextViolations,
  CHANGE_TRIGGER_UNAVAILABLE_LINE,
} from "../overviewCopy";
import { isMaterialFilingForm } from "../materialFilings";

// ---------------------------------------------------------------------------
// CF-ANALYZER-V1-SETTLE-01 — the RM-brief acceptance contract for PR #399,
// as ONE pure, typed function the live proof (scripts/analyzer/
// acceptance-run.ts) and the CI fixture tests (briefAcceptance.test.ts) both
// call — so an evaluator change is tested in CI before any live run spends a
// dispatch on it.
//
// WHY IT IS TYPED. The 7 Oct 2026 live proof (run 37566908890) failed MSFT
// on two evaluator bugs, not product defects: the earlier probe read
// `diagnostics.enterpriseValue.value` and `diagnostics.marginHistory.value`
// through `unknown` casts as if each were a Decimal, when each is a breakdown
// object (types.ts: EnterpriseValueBreakdown, MarginHistoryBreakdown). Every
// field read below goes through the AnalysisResult type, so `tsc` rejects a
// wrong path before a test or a live run ever sees it.
//
// THE CONTRACT (Calvin's rulings on #399: comment 5952716764, and his
// 7 Oct 2026 decision, Option 1):
//   - MSFT: the full brief. All ten required Overview questions answered with
//     real sourced/computed content.
//   - NVDA and COST: run end to end with all ten questions present. Where the
//     engine genuinely cannot compute a figure for the company yet, the
//     Overview shows a one-line plain-English reason (overviewCopy.ts) — and
//     this check confirms that exact line was rendered.
//   - All three: none of the ruling's forbidden strings on the rendered
//     Overview, and the AI brief (sections 2, 6, 7) present.
// Every failure carries its cause, so a FAIL can be fixed from the evidence
// rather than from a guess.
// ---------------------------------------------------------------------------

export const PROOF_TICKERS = ["MSFT", "NVDA", "COST"] as const;
export type ProofTicker = (typeof PROOF_TICKERS)[number];

export function isProofTicker(value: string): value is ProofTicker {
  return (PROOF_TICKERS as readonly string[]).includes(value);
}

/** FULL_BRIEF: content everywhere. COMPLETE_OR_EXPLAINED: content, or a rendered plain-English reason where a figure is genuinely not computed. */
export type AcceptancePolicy = "FULL_BRIEF" | "COMPLETE_OR_EXPLAINED";

export const ACCEPTANCE_POLICY: Record<ProofTicker, AcceptancePolicy> = {
  MSFT: "FULL_BRIEF",
  NVDA: "COMPLETE_OR_EXPLAINED",
  COST: "COMPLETE_OR_EXPLAINED",
};

export type SectionStatus = "CONTENT" | "EXPLAINED" | "MISSING";

export interface SectionCheck {
  id: number;
  title: string;
  status: SectionStatus;
  /** What the reader sees (a short excerpt), or why the section is explained or missing. */
  detail: string;
}

export interface ForbiddenHit {
  label: string;
  context: string;
}

export interface BriefAcceptance {
  ticker: string;
  policy: AcceptancePolicy;
  pass: boolean;
  sections: SectionCheck[];
  forbidden: ForbiddenHit[];
  /** Every reason this run does not pass, each with its cause. Empty exactly when `pass`. */
  failures: string[];
}

/** Forbidden text on the rendered Overview — the shared list in overviewCopy.ts. */
export function forbiddenOverviewHits(text: string): ForbiddenHit[] {
  return overviewTextViolations(text);
}

function finite(value: Decimal | null | undefined): value is Decimal {
  return value instanceof Decimal && value.isFinite();
}

function excerpt(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

function statementText(statement: InterpretationStatement | null | undefined): string | null {
  const text = statement?.statement?.trim();
  return text ? text : null;
}

interface ItemResult {
  status: SectionStatus;
  detail: string;
}

/** A computed figure, or the plain-English line the Overview must show for it. */
function figureItem(
  label: string,
  figure: Figure<Decimal>,
  overviewText: string,
  leverage: AnalysisResult["gates"]["leverage"]
): ItemResult {
  if (!figure.suppressed) {
    return finite(figure.value)
      ? { status: "CONTENT", detail: `${label} ${figure.value.toSignificantDigits(6).toString()}` }
      : { status: "MISSING", detail: `${label} was computed but is not a finite number (${String(figure.value)})` };
  }
  return explainedItem(label, notComputedLine(figure.state, figure.cause, leverage), overviewText, `${figure.state}: ${figure.cause}`);
}

/** Explained only when the exact plain-English line was rendered on the Overview. */
function explainedItem(label: string, line: string, overviewText: string, rawCause: string): ItemResult {
  return overviewText.includes(line)
    ? { status: "EXPLAINED", detail: `${label}: ${line} [engine: ${rawCause}]` }
    : { status: "MISSING", detail: `${label} is not computed (${rawCause}) and its plain-English reason was not rendered on the Overview` };
}

function combine(items: ItemResult[]): SectionStatus {
  if (items.some((i) => i.status === "MISSING")) return "MISSING";
  if (items.some((i) => i.status === "EXPLAINED")) return "EXPLAINED";
  return "CONTENT";
}

export interface BriefAcceptanceInput {
  ticker: string;
  policy: AcceptancePolicy;
  report: ReportAnalysis;
  /** The visible text of the rendered normal Overview (app/components/overviewTabMarkup.tsx). */
  overviewText: string;
}

export function checkBriefAcceptance({ ticker, policy, report, overviewText }: BriefAcceptanceInput): BriefAcceptance {
  const result = report.result;
  const { diagnostics, gates, priceImplied, scenarioOutputs, fairValueRange } = result;
  const leverage = gates.leverage;
  const pageOne = result.interpretation.pageOne;
  const aiCause =
    report.aiLayer.status === "COMPLETED"
      ? "the interpretation call completed but returned no statement for it"
      : `the AI layer did not complete (${report.aiLayer.status}${report.aiLayer.detail ? `: ${report.aiLayer.detail}` : ""})`;
  const profileNotConfirmed = profileNotConfirmedFor(result);
  const sections: SectionCheck[] = [];

  // 1 — company, current price, as-of date.
  {
    const missing: string[] = [];
    if (result.companyName.trim() === "") missing.push("company name");
    if (!finite(result.price.value) || result.price.value.lte(0)) missing.push("a finite current price");
    if (result.price.timestamp.trim() === "") missing.push("the price's as-of timestamp");
    sections.push({
      id: 1,
      title: "Company, current price and as-of date",
      status: missing.length === 0 ? "CONTENT" : "MISSING",
      detail:
        missing.length === 0
          ? `${result.companyName} · $${result.price.value.toFixed(2)} as of ${result.price.timestamp}`
          : `missing ${missing.join(", ")}`,
    });
  }

  // 2 — the 30-second view: the AI brief's main finding, and the hero's bottom line.
  {
    const mainFinding = statementText(pageOne?.mainFinding);
    const items: ItemResult[] = [
      mainFinding === null
        ? { status: "MISSING", detail: `"What matters most" is missing — ${aiCause}` }
        : { status: "CONTENT", detail: `What matters most: ${excerpt(mainFinding)}` },
    ];
    const headline = priceVsRangeHeadline({
      fairValueRange,
      priceLocationWithinRange: scenarioOutputs.priceLocationWithinRange,
      trustStatus: result.trust.status,
      profileNotConfirmed,
    });
    if (headline !== null) {
      items.push(
        overviewText.includes(headline)
          ? { status: "CONTENT", detail: `Bottom line: ${headline}` }
          : { status: "MISSING", detail: "the price-vs-range bottom line was computed but not rendered in the hero" }
      );
    } else {
      const explanation = incompleteVerdictExplanation({
        trustStatus: result.trust.status,
        fairValueRange,
        leverage,
        profileNotConfirmed,
      });
      items.push(explainedItem("Bottom line", explanation, overviewText, "no price-vs-range position for this run"));
    }
    sections.push({
      id: 2,
      title: "30-second view / bottom line",
      status: combine(items),
      detail: items.map((i) => i.detail).join(" | "),
    });
  }

  // 3 — what the company does.
  {
    const narrative = result.business.narrative;
    const text = narrative?.text?.trim() ?? "";
    sections.push({
      id: 3,
      title: "What the company does",
      status: text === "" ? "MISSING" : "CONTENT",
      detail:
        text === ""
          ? `business description missing — ${result.business.unavailableReason ?? "no reason recorded"}`
          : narrative?.source === "MARKET-DATA PROVIDER SUMMARY"
            ? `${excerpt(text)} [source: ${narrative.provider} company summary; 10-K Item 1 not used because: ${narrative.primaryUnavailableReason}]`
            : `${excerpt(text)} [source: 10-K Item 1]`,
    });
  }

  // 4 — key financial metrics (the Key Stats rail: market cap, P/E, FCF
  // yield, 52-week range, leverage). Typed reads — the two fields the old
  // probe misread are the breakdown objects' own Decimal members.
  {
    const items: ItemResult[] = [];
    const ev = diagnostics.enterpriseValue;
    if (ev.suppressed) {
      items.push(explainedItem("Market cap", notComputedLine(ev.state, ev.cause, leverage), overviewText, `${ev.state}: ${ev.cause}`));
    } else if (finite(ev.value.marketCap) && finite(ev.value.enterpriseValue)) {
      items.push({ status: "CONTENT", detail: `Market cap ${ev.value.marketCap.toSignificantDigits(6).toString()}` });
    } else {
      items.push({
        status: "MISSING",
        detail: `Market cap / enterprise value computed but not finite (marketCap ${String(ev.value.marketCap)}, enterpriseValue ${String(ev.value.enterpriseValue)})`,
      });
    }

    items.push(figureItem("P/E (trailing)", diagnostics.multiples.peTrailing, overviewText, leverage));
    items.push(figureItem("FCF yield", diagnostics.multiples.fcfYieldOnMarketCap, overviewText, leverage));

    const mh = diagnostics.marginHistory;
    if (mh.suppressed) {
      items.push(explainedItem("52-week range", notComputedLine(mh.state, mh.cause, leverage), overviewText, `${mh.state}: ${mh.cause}`));
    } else {
      const [low, high] = mh.value.fiftyTwoWeekRange;
      items.push(
        finite(low) && finite(high)
          ? { status: "CONTENT", detail: `52-week range ${low.toString()}–${high.toString()}` }
          : { status: "MISSING", detail: `52-week range computed but not finite (${String(low)}–${String(high)})` }
      );
    }

    if (leverage.result === "PASS" && finite(leverage.netDebtRatio)) {
      items.push({ status: "CONTENT", detail: `Leverage: net debt ${leverage.netDebtRatio.mul(100).toFixed(1)}%` });
    } else {
      items.push(
        explainedItem(
          "Leverage",
          leverageUnavailableLine(leverage),
          overviewText,
          `${leverage.result}, net debt ratio ${leverage.netDebtRatio === null ? "not computed" : leverage.netDebtRatio.toString()}`
        )
      );
    }
    sections.push({
      id: 4,
      title: "Key financial metrics",
      status: combine(items),
      detail: items.map((i) => i.detail).join(" | "),
    });
  }

  // 5 — Bear / Base / Bull and current-price context.
  {
    let item: ItemResult;
    if (fairValueRange.kind === "suppressed") {
      item = explainedItem(
        "Fair-value range",
        fairValueRangeUnavailableLine(fairValueRange, leverage),
        overviewText,
        `${fairValueRange.state}: ${fairValueRange.cause}`
      );
    } else if (fairValueRange.kind === "range") {
      const values = scenarioOutputs.values;
      const location = scenarioOutputs.priceLocationWithinRange;
      const bad: string[] = [];
      if (!finite(fairValueRange.bear) || !finite(fairValueRange.bull)) bad.push("range bounds");
      if (!finite(values.bear) || !finite(values.base) || !finite(values.bull)) bad.push("bear/base/bull values");
      if (!finite(location)) bad.push("current price's position within the range");

      // CF-ANALYZER-MSFT-NUMERIC-INTEGRITY-01 — presence/finiteness above
      // does not catch a brief whose displayed figures contradict each
      // other. Both checks below are independent of the field they verify:
      // never comparing a figure to itself, only to the other already-
      // computed figures it is defined from (assemble.ts, modules/
      // scenarioOutputs.ts). A real price legitimately outside bear-bull
      // still passes here — only the arithmetic identity is checked, never
      // whether the price lands inside the range.
      const inconsistent: string[] = [];
      if (bad.length === 0) {
        if (!fairValueRange.bear.equals(values.bear) || !fairValueRange.bull.equals(values.bull)) {
          inconsistent.push(
            `the fair-value range ($${fairValueRange.bear.toFixed(2)}-$${fairValueRange.bull.toFixed(2)}) does not match the computed bear/bull scenario values ($${values.bear.toFixed(2)}-$${values.bull.toFixed(2)})`
          );
        } else if (location !== null) {
          const span = fairValueRange.bull.minus(fairValueRange.bear);
          const expectedLocation = span.isZero() ? new Decimal(0) : result.price.value.minus(fairValueRange.bear).dividedBy(span);
          if (!location.equals(expectedLocation)) {
            inconsistent.push(
              `price's position within the range (${location.mul(100).toFixed(1)}%) does not equal (price − bear) ÷ (bull − bear) = ${expectedLocation.mul(100).toFixed(1)}%`
            );
          }
        }
      }

      item =
        bad.length > 0
          ? { status: "MISSING", detail: `not finite: ${bad.join(", ")}` }
          : inconsistent.length > 0
            ? { status: "MISSING", detail: inconsistent.join("; ") }
            : {
                status: "CONTENT",
                detail: `Bear $${values.bear.toFixed(0)} · Base $${values.base.toFixed(0)} · Bull $${values.bull.toFixed(0)} · price ${location!.mul(100).toFixed(0)}% of the way from bear to bull`,
              };
    } else {
      item = { status: "CONTENT", detail: "pre-revenue distribution (failure / success / cash floor)" };
    }
    sections.push({ id: 5, title: "Bear / Base / Bull and price context", status: item.status, detail: item.detail });
  }

  // 6 — why own it.
  {
    const text = statementText(pageOne?.whatSupportsTheCase);
    sections.push({
      id: 6,
      title: "Why own it",
      status: text === null ? "MISSING" : "CONTENT",
      detail: text === null ? `missing — ${aiCause}` : excerpt(text),
    });
  }

  // 7 — why be cautious / biggest risks.
  {
    const cautious = statementText(pageOne?.whatWorriesCalboard);
    const risk = statementText(pageOne?.biggestUncertainty);
    const missing = [cautious === null ? '"Why be cautious"' : null, risk === null ? '"Biggest risk"' : null].filter(
      (m): m is string => m !== null
    );
    sections.push({
      id: 7,
      title: "Why be cautious / biggest risks",
      status: missing.length === 0 ? "CONTENT" : "MISSING",
      detail: missing.length === 0 ? `${excerpt(cautious!)} | Biggest risk: ${excerpt(risk!)}` : `missing ${missing.join(" and ")} — ${aiCause}`,
    });
  }

  // 8 — what today's price assumes (Overview slot 8's three rows).
  {
    const items: ItemResult[] = [
      figureItem("Steady-state EV", priceImplied.steadyStateEv, overviewText, leverage),
      figureItem("PVGO share of EV", priceImplied.pvgoShareOfEv, overviewText, leverage),
    ];
    const cell = priceImplied.reverseDcfGrid.find((c) => c.marginLevel === "current" && c.rate === 0.08);
    items.push(
      cell === undefined
        ? { status: "MISSING", detail: "the implied-growth cell (current margin, r = 8%) is absent from the reverse-DCF grid" }
        : figureItem("Implied growth, yrs 1-5 at r = 8%", cell.fiveYearGrowth, overviewText, leverage)
    );
    sections.push({
      id: 8,
      title: "What today's price assumes",
      status: combine(items),
      detail: items.map((i) => i.detail).join(" | "),
    });
  }

  // 9 — latest material development.
  {
    const filing = result.latestFiling;
    const ok = filing !== null && isMaterialFilingForm(filing.form) && filing.filingDate.trim() !== "";
    sections.push({
      id: 9,
      title: "Latest material development",
      status: ok ? "CONTENT" : "MISSING",
      detail: ok
        ? `${filing!.form} filed ${filing!.filingDate}`
        : filing === null
          ? "no material SEC filing was acquired for this run"
          : `latest filing ${filing.form} (${filing.filingDate}) is not a material filing form`,
    });
  }

  // 10 — what would change the view.
  {
    const reading = diagnostics.sensitivity.forecastDispersion as Step4ForecastDispersionReading;
    let item: ItemResult;
    if (reading.available) {
      item =
        finite(reading.fullRangeValueImpact) && reading.selectedDriver.trim() !== "" && ["LOW", "MEDIUM", "HIGH"].includes(reading.tier)
          ? {
              status: "CONTENT",
              detail: `largest driver ${reading.selectedDriver}, full-range impact ${reading.fullRangeValueImpact.mul(100).toFixed(1)}% (${reading.tier})`,
            }
          : { status: "MISSING", detail: "the change-trigger reading is available but malformed" };
    } else {
      item = explainedItem("Change trigger", CHANGE_TRIGGER_UNAVAILABLE_LINE, overviewText, reading.cause);
    }
    sections.push({ id: 10, title: "What would change the view", status: item.status, detail: item.detail });
  }

  const forbidden = forbiddenOverviewHits(overviewText);
  const failures: string[] = [];
  for (const section of sections) {
    if (section.status === "MISSING") failures.push(`#${section.id} ${section.title}: ${section.detail}`);
    if (section.status === "EXPLAINED" && policy === "FULL_BRIEF") {
      failures.push(`#${section.id} ${section.title}: the full brief needs content here, but the engine did not compute it — ${section.detail}`);
    }
  }
  for (const hit of forbidden) failures.push(`forbidden text on the Overview (${hit.label}): …${hit.context}…`);

  return { ticker, policy, pass: failures.length === 0, sections, forbidden, failures };
}

/** The per-ticker acceptance summary posted to the PR and stored in the proof artifact. */
export function formatBriefAcceptanceMarkdown(acceptance: BriefAcceptance, extras: { runId?: string } = {}): string {
  const lines: string[] = [];
  lines.push(
    `### ${acceptance.ticker} — ${acceptance.pass ? "PASS" : "FAIL"} (${acceptance.policy === "FULL_BRIEF" ? "full brief" : "complete, or explained in plain English"})`
  );
  if (extras.runId) lines.push(`Run \`${extras.runId}\``);
  lines.push("");
  lines.push("| # | Section | Status | What the reader sees / why |");
  lines.push("|---|---|---|---|");
  for (const s of acceptance.sections) {
    lines.push(`| ${s.id} | ${s.title} | ${s.status} | ${s.detail.replace(/\|/g, "/").replace(/\n/g, " ")} |`);
  }
  if (acceptance.failures.length > 0) {
    lines.push("");
    lines.push("**Failures (with causes):**");
    for (const f of acceptance.failures) lines.push(`- ${f}`);
  }
  return lines.join("\n");
}
