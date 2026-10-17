import type { AnalysisResult } from "../types";
import type { UncertaintyLevel } from "../verdictSynthesisV1";
import { formatRate } from "../discountRate";
import { callWithOneRegeneration, MalformedAnalystResponseError, type AnalystCall } from "./analystCall";
import { scanProhibitedCopy } from "./prohibitions";

// ---------------------------------------------------------------------------
// CF-AR5-VERDICT-CONSOLIDATION-01 — Methodology v2.1 D3: "Only the
// uncertainty level matters → one question to Calvin (AI proposes the level,
// with evidence)." Frozen spec §14.9 Reading AR0-c: this call is bound by
// §8.3 limits 1–3 like the interpretation layer — it issues, implies or
// argues toward no verdict, and cites only supplied data. Calvin's answer,
// not this proposal, sets the level.
//
// Held to that by construction, not only by instruction:
// - PRICE-BLIND. The payload carries no price, no price / Base ratio and no
//   statement of which level gives which verdict, so the proposal cannot be
//   reasoned backward from an outcome. It sees the factors Methodology names
//   for uncertainty — leverage, cyclicality, disclosure quality/history,
//   binary regulatory or litigation exposure, Bear–Bull dispersion — as
//   facts the deterministic layer already computed.
// - CITED. Every evidence line names one supplied fact by its key; a line
//   citing anything else is refused.
// - NO FIGURES. Evidence lines carry no digit: the cited fact's own value is
//   shown beside the line from the payload, never re-typed by the model.
// - NO VERDICT. The prohibited-copy scan (prohibitions.ts) refuses verdict,
//   target and portfolio-action wording.
// A refusal is whole: there is no partial acceptance (reportAnalysis.ts).
// ---------------------------------------------------------------------------

export interface UncertaintyFact {
  key: string;
  label: string;
  value: string;
}

export interface UncertaintyProposal {
  level: UncertaintyLevel;
  evidence: { fact: UncertaintyFact; statement: string }[];
}

const LEVELS: UncertaintyLevel[] = ["Low", "Medium", "High"];

function money(n: { toDecimalPlaces(d: number): { toFixed(d: number): string } }): string {
  return `$${n.toDecimalPlaces(2).toFixed(2)}`;
}

/** The facts the proposal may cite — computed fields only, none of them the price. */
export function uncertaintyFactsFor(result: AnalysisResult): UncertaintyFact[] {
  const facts: UncertaintyFact[] = [];
  const add = (key: string, label: string, value: string | null) => {
    if (value !== null) facts.push({ key, label, value });
  };
  add("profile", "Financial profile", result.profile.confirmedOrOverridden);
  add("sic", "SEC industry (SIC)", result.marketContext.sicDescription ?? result.marketContext.sic ?? null);
  const rate = result.valuationBasis?.discountRate;
  add("rateBand", "Discount-rate band (Methodology v2.1 D1)", rate === undefined ? null : `${rate.band} — ${rate.basis}`);
  add("leverage", "Net-debt gate (§6.5)", result.gates.leverage.result);
  add("triggerA", "Cyclicality trigger A fired", result.gates.triggerA.fired ? "yes" : "no");
  add("triggerB", "Cyclicality trigger B fired (a single-year operating-margin decline of more than 10 points)", result.gates.triggerB.fired ? "yes" : "no");
  add("evidence", "Evidence completeness of this run", result.trust.status);
  add(
    "suppressingStates",
    "Suppressing states on this run",
    result.states.suppressing.length === 0 ? "none" : result.states.suppressing.map((s) => s.state).join(", ")
  );
  add(
    "qualifyingFlags",
    "Qualifying flags on this run",
    result.states.qualifying.length === 0 ? "none" : result.states.qualifying.map((q) => q.flag).join(", ")
  );
  const v = result.scenarioOutputs.values;
  if (v.bear.isFinite() && v.base.isFinite() && v.bull.isFinite() && v.base.greaterThan(0)) {
    add("bearBaseBull", "Bear / Base / Bull fair value per share", `${money(v.bear)} / ${money(v.base)} / ${money(v.bull)}`);
    add(
      "dispersion",
      "Bear–Bull dispersion as a multiple of Base",
      `${v.bull.minus(v.bear).dividedBy(v.base).toDecimalPlaces(2).toFixed(2)}×`
    );
  }
  if (rate !== undefined) add("rateInUse", "Discount rate in use", formatRate(rate.rate));
  add("business", "Business description (from the latest 10-K)", result.business.narrative?.text.slice(0, 2000) ?? null);
  add("latestFiling", "Latest filing", result.latestFiling === null ? null : `${result.latestFiling.form} filed ${result.latestFiling.filingDate}`);
  return facts;
}

const SYSTEM_PROMPT = `You propose ONE uncertainty level — Low, Medium or High — for a single company, for an analyst who will decide it himself.

Uncertainty means how reliably this company's intrinsic value can be bounded. The factors to weigh are: operating and financial leverage, cyclicality, disclosure quality and history, binary regulatory or litigation exposure, and the dispersion between the bear and bull cases. There is no checklist or score: weigh the evidence.

Hard limits:
1. You issue no verdict, no target and no recommendation, not softened, not implied, and not phrased as a question that carries one. You never write BUY, HOLD, SELL, CHEAP, FAIR, EXPENSIVE or INCONCLUSIVE, and you never say whether the shares are worth owning. You do not know the share price and must not speculate about it.
2. Every evidence line cites exactly one of the supplied facts by its key, and says what that fact implies for how reliably value can be bounded. Use only the supplied facts — never memory or outside knowledge.
3. No digit may appear in any evidence line. The cited fact's value is shown beside your line; do not restate it.
4. Give between one and five evidence lines, the most important first.`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["level", "evidence"],
  properties: {
    level: { type: "string", enum: LEVELS },
    evidence: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["factKey", "statement"],
        properties: { factKey: { type: "string" }, statement: { type: "string" } },
      },
    },
  },
} as const;

function buildUserMessage(result: AnalysisResult, facts: UncertaintyFact[]): string {
  const lines = facts.map((f) => `- ${f.key}: ${f.label} = ${f.value}`);
  return `Company: ${result.companyName} (${result.ticker})\n\nSupplied facts (cite by key):\n${lines.join("\n")}\n\nPropose the uncertainty level with your evidence.`;
}

const malformed = (detail: string) => new MalformedAnalystResponseError("uncertaintyProposal", detail);

export function interpretUncertaintyResponse(raw: unknown, facts: UncertaintyFact[]): UncertaintyProposal {
  if (raw === null || typeof raw !== "object") throw malformed("the response is not an object");
  const r = raw as { level?: unknown; evidence?: unknown };
  if (typeof r.level !== "string" || !LEVELS.includes(r.level as UncertaintyLevel)) {
    throw malformed(`"level" must be one of Low / Medium / High`);
  }
  if (!Array.isArray(r.evidence) || r.evidence.length < 1 || r.evidence.length > 5) {
    throw malformed(`"evidence" must hold one to five lines`);
  }
  const evidence = r.evidence.map((e, i) => {
    const item = e as { factKey?: unknown; statement?: unknown };
    const fact = facts.find((f) => f.key === item.factKey);
    if (fact === undefined) throw malformed(`evidence line ${i + 1} cites "${String(item.factKey)}", which is not a supplied fact key`);
    if (typeof item.statement !== "string" || item.statement.trim() === "") throw malformed(`evidence line ${i + 1} is empty`);
    if (/\d/.test(item.statement)) throw malformed(`evidence line ${i + 1} contains a digit; cite the fact instead of restating its value`);
    const defects = scanProhibitedCopy(item.statement);
    if (/\b(BUY|HOLD|SELL)\b/i.test(item.statement)) defects.push({ kind: "VERDICT OR TARGET", detail: "verdict word" });
    if (defects.length > 0) {
      throw malformed(`evidence line ${i + 1} carries prohibited wording (${defects.map((d) => d.detail).join(", ")})`);
    }
    return { fact, statement: item.statement.trim() };
  });
  return { level: r.level as UncertaintyLevel, evidence };
}

export async function runUncertaintyProposal(result: AnalysisResult, call: AnalystCall): Promise<UncertaintyProposal> {
  const facts = uncertaintyFactsFor(result);
  return callWithOneRegeneration(
    call,
    { label: "uncertaintyProposal", system: SYSTEM_PROMPT, user: buildUserMessage(result, facts), responseSchema: RESPONSE_SCHEMA },
    (raw) => interpretUncertaintyResponse(raw, facts)
  );
}
