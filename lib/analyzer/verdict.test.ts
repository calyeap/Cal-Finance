import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { deriveVerdict, BUY_CANDIDATE_LABEL, RAMP_DEPENDENT_LABEL, type VerdictResult } from "./verdict";
import { assembleAnalysisResult } from "./assemble";
import { MSFT_FIXTURE } from "./fixtures/msft";
import { OKLO_FIXTURE } from "./fixtures/oklo";
import { withStatedD2Inputs } from "./fixtures/statedD2Inputs";
import { PROFILE_NOT_CONFIRMED_DETAIL } from "./trust";
import { NO_VERDICT_JUDGEMENTS, NOT_SURE, type VerdictJudgements } from "./verdictJudgements";
import type { RoicFloorResult } from "./roicFloor";
import type { AnalysisResult, MoatClass } from "./types";

// ---------------------------------------------------------------------------
// CF-AR5-VERDICT-CONSOLIDATION-01 — deriveVerdict, the one V1 path, as a
// truth table over routing × recorded judgements × the D4 bar.
//
// Replaces the CF-ANALYZER-STAGE3-VERDICT-FINISH-01 cases that pinned the
// pre-D3 behaviour (one rate; an ambiguous bucket or a BUY band read as
// INCOMPLETE). Those outputs are superseded by Methodology v2.1 D3/D4; the
// properties they protected — never a manufactured HOLD, never BUY from
// valuation alone, the global prerequisite first — are kept below as
// invariants over every case, not one pinned string each.
//
// Results are one real assembled result (the MSFT fixture with the stated D2
// test inputs, valued by the engine) with only the members each case is
// about overridden — price, the Base at the three check rates, the moat
// class, the ROIC floor and the recorded judgements. deriveVerdict is a pure
// function of the result, so nothing here touches the database.
// ---------------------------------------------------------------------------

const ENGINE = assembleAnalysisResult({ ...withStatedD2Inputs(MSFT_FIXTURE), scenarioValues: null });
const BINDING = ENGINE.runIdentity!.inputsFingerprint;
// Divisible by every ratio numerator used below, so price ÷ Base is exact.
const PRICE = new Decimal(16150680);

const ROIC_PASS: RoicFloorResult = { status: "PASS", average: new Decimal("0.3"), years: [], rate: new Decimal("0.09"), reason: "Average return on invested capital, goodwill included, over FY2022–FY2026 is 30.0%, above the 9.0% rate." };
const ROIC_FAIL: RoicFloorResult = { status: "FAIL", average: new Decimal("0.05"), years: [], rate: new Decimal("0.09"), reason: "Average return on invested capital, goodwill included, over FY2022–FY2026 is 5.0%, not above the 9.0% rate." };
const ROIC_UNAVAILABLE: RoicFloorResult = { status: "UNAVAILABLE", average: null, years: [], rate: new Decimal("0.09"), reason: "FY2023 is missing NOPAT" };

const AT = "2026-10-17T00:00:00.000Z";
const rec = <T,>(answer: T) => ({ answer, note: answer === "cited" ? "switching costs in enterprise software" : null, recordedAt: AT, version: 1 });

/** All four D4 quality items met. */
const QUALITY_MET: Partial<VerdictJudgements> = {
  moatMechanism: rec("cited" as const),
  management: rec("not poor" as const),
  processItems: { ...rec("adopted" as const), items: { thesis: "t", valuation: "v", keyRisks: "k", invalidation: "i", bearCase: "b" } },
};

interface Case {
  /** price ÷ Base at the D1 rate − 0.5pp, the rate, + 0.5pp. */
  ratios: [string, string, string];
  moat?: MoatClass | null;
  roic?: RoicFloorResult;
  judgements?: Partial<VerdictJudgements>;
  /** v3 D5 — price ÷ Base with growth flat at the drafted rate, where the growth ramp moved Base. */
  flatRatios?: [string, string, string];
}

function resultFor(c: Case): AnalysisResult {
  const base = (r: string) => PRICE.dividedBy(r);
  const baseAt = { lower: base(c.ratios[0]), rate: base(c.ratios[1]), upper: base(c.ratios[2]) };
  return {
    ...ENGINE,
    price: { ...ENGINE.price, value: PRICE },
    scenarioOutputs: { ...ENGINE.scenarioOutputs, values: { ...ENGINE.scenarioOutputs.values, base: baseAt.rate } },
    valuationBasis: { ...ENGINE.valuationBasis!, d2: { ...ENGINE.valuationBasis!.d2, moatClass: c.moat === undefined ? "narrow" : c.moat } },
    verdictInputs: {
      baseAtCheckRates: baseAt,
      baseAtCheckRatesCause: null,
      roicFloor: c.roic ?? ROIC_PASS,
      ...(c.flatRatios === undefined
        ? {}
        : { flatGrowthBaseAtCheckRates: { lower: base(c.flatRatios[0]), rate: base(c.flatRatios[1]), upper: base(c.flatRatios[2]) } }),
    },
    verdictJudgements: { ...NO_VERDICT_JUDGEMENTS, ...c.judgements },
  };
}

const verdictFor = (c: Case): VerdictResult => deriveVerdict(resultFor(c));

// Ratio triples, one per routing (bands: BUY ≤ 0.90/0.80/0.70, SELL ≥ 1.20/1.30/1.45).
const AUTO_HOLD: Case["ratios"] = ["1", "1", "1"];
const AUTO_SELL: Case["ratios"] = ["1.6", "1.6", "1.6"];
const AUTO_BUY: Case["ratios"] = ["0.5", "0.5", "0.5"];
const QUESTION_SELL_OR_HOLD: Case["ratios"] = ["1.25", "1.25", "1.25"]; // Low SELL, Medium/High HOLD
const QUESTION_BUY_OR_HOLD: Case["ratios"] = ["0.85", "0.85", "0.85"]; // Low BUY, Medium/High HOLD
const CLOSE_HOLD_OR_SELL: Case["ratios"] = ["1.4", "1.4", "1.6"]; // High HOLD at the lower rates, SELL at the upper
const CLOSE_BUY_OR_HOLD: Case["ratios"] = ["0.5", "1", "1"];

describe("deriveVerdict — the global prerequisite comes first and never yields a verdict", () => {
  it("TrustStatus UNUSABLE → can't bound value", () => {
    const v = deriveVerdict({
      ...resultFor({ ratios: AUTO_HOLD }),
      trust: { status: "UNUSABLE", determinedBy: [{ kind: "suppressing state", detail: "LEVERAGE UNSUPPORTED IN v1" }] },
      fairValueRange: { kind: "suppressed", state: "LEVERAGE UNSUPPORTED IN v1", cause: "inputs missing" },
    });
    expect(v).toMatchObject({ status: "INCOMPLETE", state: "CANNOT BOUND VALUE" });
    expect(v.reason).toContain("LEVERAGE UNSUPPORTED IN v1");
  });

  it("a suppressed range → can't bound value, even if trust disagreed", () => {
    const v = deriveVerdict({
      ...resultFor({ ratios: AUTO_HOLD }),
      trust: { status: "PARTIAL", determinedBy: [] },
      fairValueRange: { kind: "suppressed", state: "LEVERAGE UNSUPPORTED IN v1", cause: "inputs missing" },
    });
    expect(v).toMatchObject({ status: "INCOMPLETE", state: "CANNOT BOUND VALUE" });
  });

  it("the pre-revenue distribution → INCOMPLETE, honestly", () => {
    const result = assembleAnalysisResult(OKLO_FIXTURE);
    expect(result.fairValueRange.kind).toBe("pre-revenue-distribution");
    const v = deriveVerdict(result);
    expect(v.status).toBe("INCOMPLETE");
  });

  it("PROFILE NOT CONFIRMED → INCOMPLETE, naming it", () => {
    const v = deriveVerdict({
      ...resultFor({ ratios: AUTO_SELL }),
      trust: { status: "PARTIAL", determinedBy: [{ kind: "qualifying flag", detail: PROFILE_NOT_CONFIRMED_DETAIL }] },
    });
    expect(v.status).toBe("INCOMPLETE");
    expect(v.reason).toContain("PROFILE NOT CONFIRMED");
  });

  it("an unrelated qualifying flag is not mistaken for PROFILE NOT CONFIRMED", () => {
    const v = deriveVerdict({
      ...resultFor({ ratios: AUTO_SELL }),
      trust: { status: "PARTIAL", determinedBy: [{ kind: "qualifying flag", detail: "MARGIN AT HISTORICAL HIGH" }] },
    });
    expect(v.status).toBe("SELL");
  });

  it("no price → INCOMPLETE", () => {
    const v = deriveVerdict({ ...resultFor({ ratios: AUTO_SELL }), price: { value: new Decimal(0), timestamp: "" } });
    expect(v.status).toBe("INCOMPLETE");
    expect(v.reason).toContain("no price");
  });

  it("a Base that is not positive and finite → can't bound value", () => {
    const r = resultFor({ ratios: AUTO_HOLD });
    for (const bad of [new Decimal(0), new Decimal(-5), new Decimal(NaN)]) {
      const v = deriveVerdict({ ...r, scenarioOutputs: { ...r.scenarioOutputs, values: { ...r.scenarioOutputs.values, base: bad } } });
      expect(v).toMatchObject({ status: "INCOMPLETE", state: "CANNOT BOUND VALUE" });
    }
  });

  it("a Base the engine cannot revalue at ±0.5pp → INCOMPLETE with the cause, never a single-rate verdict", () => {
    const r = resultFor({ ratios: AUTO_SELL });
    const v = deriveVerdict({ ...r, verdictInputs: { ...r.verdictInputs!, baseAtCheckRates: null, baseAtCheckRatesCause: "a typed figure" } });
    expect(v.status).toBe("INCOMPLETE");
    expect(v.reason).toContain("a typed figure");
  });

  it("a result stored before the check existed → INCOMPLETE, asking for a re-run", () => {
    const v = deriveVerdict({ ...resultFor({ ratios: AUTO_SELL }), verdictInputs: undefined });
    expect(v.status).toBe("INCOMPLETE");
  });
});

describe("deriveVerdict — pending adoption", () => {
  it("an un-adopted sheet shows pending adoption instead of a verdict, even where every other input would issue one", () => {
    const r = resultFor({ ratios: AUTO_SELL });
    const v = deriveVerdict({
      ...r,
      valuationBasis: { ...r.valuationBasis!, d2: { ...r.valuationBasis!.d2, status: "PENDING ADOPTION", statement: "Pending adoption: no moat class." } },
    });
    expect(v).toMatchObject({ status: "PENDING", state: "PENDING ADOPTION" });
    expect(v.reason).toContain("Pending adoption: no moat class.");
  });

  it("the real un-adopted MSFT fixture is pending adoption", () => {
    expect(deriveVerdict(assembleAnalysisResult(MSFT_FIXTURE)).state).toBe("PENDING ADOPTION");
  });
});

describe("deriveVerdict — thesis broken → SELL", () => {
  it.each([[AUTO_BUY], [AUTO_HOLD], [QUESTION_BUY_OR_HOLD], [CLOSE_BUY_OR_HOLD]])("SELL whatever the valuation (%j)", (ratios) => {
    const v = verdictFor({ ratios, judgements: { thesis: rec("broken" as const) } });
    expect(v).toMatchObject({ status: "SELL", state: "ISSUED", basis: "THESIS BROKEN" });
  });

  it("intact or not sure changes nothing", () => {
    for (const answer of ["intact", NOT_SURE] as const) {
      expect(verdictFor({ ratios: AUTO_HOLD, judgements: { thesis: rec(answer) } }).status).toBe("HOLD");
    }
  });
});

describe("deriveVerdict — automatic: all nine checks agree", () => {
  it("HOLD and SELL issue automatically, with no judgement", () => {
    expect(verdictFor({ ratios: AUTO_HOLD })).toMatchObject({ status: "HOLD", state: "ISSUED", basis: "ALL NINE CHECKS AGREE" });
    expect(verdictFor({ ratios: AUTO_SELL })).toMatchObject({ status: "SELL", state: "ISSUED", basis: "ALL NINE CHECKS AGREE" });
  });

  it("a BUY zone with no quality answers is a BUY candidate — valuation alone cannot produce BUY", () => {
    const v = verdictFor({ ratios: AUTO_BUY });
    expect(v).toMatchObject({ status: "PENDING", state: "BUY CANDIDATE" });
    expect(v.reason).toContain(BUY_CANDIDATE_LABEL);
  });

  it("BUY is reachable: a BUY zone with the D4 bar met issues BUY", () => {
    const v = verdictFor({ ratios: AUTO_BUY, judgements: QUALITY_MET });
    expect(v).toMatchObject({ status: "BUY", state: "ISSUED", basis: "ALL NINE CHECKS AGREE" });
    expect(v.qualityBar?.status).toBe("PASS");
  });
});

describe("deriveVerdict — one uncertainty question", () => {
  it("is pending until Calvin answers; his level selects the zone", () => {
    expect(verdictFor({ ratios: QUESTION_SELL_OR_HOLD })).toMatchObject({ status: "PENDING", state: "UNCERTAINTY QUESTION" });
    expect(verdictFor({ ratios: QUESTION_SELL_OR_HOLD, judgements: { uncertainty: rec("Low" as const) } })).toMatchObject({
      status: "SELL",
      basis: "YOUR UNCERTAINTY ANSWER",
    });
    for (const level of ["Medium", "High"] as const) {
      expect(verdictFor({ ratios: QUESTION_SELL_OR_HOLD, judgements: { uncertainty: rec(level) } }).status).toBe("HOLD");
    }
  });

  it("a level that lands in the BUY zone still needs the D4 bar", () => {
    const low = { uncertainty: rec("Low" as const) };
    expect(verdictFor({ ratios: QUESTION_BUY_OR_HOLD, judgements: low }).state).toBe("BUY CANDIDATE");
    expect(verdictFor({ ratios: QUESTION_BUY_OR_HOLD, judgements: { ...low, ...QUALITY_MET } }).status).toBe("BUY");
    expect(verdictFor({ ratios: QUESTION_BUY_OR_HOLD, judgements: { uncertainty: rec("High" as const), ...QUALITY_MET } }).status).toBe("HOLD");
  });
});

describe("deriveVerdict — close call", () => {
  it("is pending until Calvin makes the call for exactly these inputs", () => {
    const v = verdictFor({ ratios: CLOSE_HOLD_OR_SELL });
    expect(v).toMatchObject({ status: "PENDING", state: "CLOSE CALL", closeCallBinding: BINDING });
    const call = (answer: "HOLD" | "SELL" | "BUY", boundTo = BINDING) => ({ closeCalls: [{ ...rec(answer), boundTo }] });
    expect(verdictFor({ ratios: CLOSE_HOLD_OR_SELL, judgements: call("SELL") })).toMatchObject({ status: "SELL", basis: "YOUR CLOSE CALL" });
    expect(verdictFor({ ratios: CLOSE_HOLD_OR_SELL, judgements: call("HOLD") })).toMatchObject({ status: "HOLD", basis: "YOUR CLOSE CALL" });
    // Bound to other inputs, or a zone the check does not offer: not an answer to this call.
    expect(verdictFor({ ratios: CLOSE_HOLD_OR_SELL, judgements: call("SELL", "inputs-sha256:elsewhere") }).state).toBe("CLOSE CALL");
    expect(verdictFor({ ratios: CLOSE_HOLD_OR_SELL, judgements: call("BUY") }).state).toBe("CLOSE CALL");
  });

  it("a close call for a BUY zone still needs the D4 bar", () => {
    const call = { closeCalls: [{ ...rec("BUY" as const), boundTo: BINDING }] };
    expect(verdictFor({ ratios: CLOSE_BUY_OR_HOLD, judgements: call }).state).toBe("BUY CANDIDATE");
    expect(verdictFor({ ratios: CLOSE_BUY_OR_HOLD, judgements: { ...call, ...QUALITY_MET } }).status).toBe("BUY");
  });

  it("an uncertainty answer does not settle a close call", () => {
    expect(verdictFor({ ratios: CLOSE_HOLD_OR_SELL, judgements: { uncertainty: rec("High" as const) } }).state).toBe("CLOSE CALL");
  });
});

describe("deriveVerdict — the D4 bar for a BUY zone, every combination", () => {
  const moats: (MoatClass | null)[] = [null, "none", "narrow", "wide"];
  const mechanisms = [null, NOT_SURE, "cited"] as const;
  const managements = [null, NOT_SURE, "poor", "not poor"] as const;
  const processes = [null, NOT_SURE, "adopted"] as const;
  const roics = [ROIC_PASS, ROIC_FAIL, ROIC_UNAVAILABLE];

  it(`matches D4 on all ${moats.length * mechanisms.length * managements.length * processes.length * roics.length} combinations`, () => {
    for (const moat of moats)
      for (const mechanism of mechanisms)
        for (const management of managements)
          for (const process of processes)
            for (const roic of roics) {
              const judgements: Partial<VerdictJudgements> = {
                moatMechanism: mechanism === null ? null : rec(mechanism),
                management: management === null ? null : rec(management),
                processItems:
                  process === null ? null : { ...rec(process), items: process === "adopted" ? { thesis: "t", valuation: "v", keyRisks: "k", invalidation: "i", bearCase: "b" } : null },
              };
              const v = verdictFor({ ratios: AUTO_BUY, moat, roic, judgements });
              const label = JSON.stringify({ moat, mechanism, management, process, roic: roic.status });

              // D4, restated: a definitive miss → HOLD; everything met → BUY; otherwise still open.
              const fails = moat === "none" || roic.status === "FAIL" || management === "poor";
              const met =
                (moat === "narrow" || moat === "wide") && mechanism === "cited" && management === "not poor" && process === "adopted" && roic.status === "PASS";
              if (fails) expect(v, label).toMatchObject({ status: "HOLD", state: "ISSUED" });
              else if (met) expect(v, label).toMatchObject({ status: "BUY", state: "ISSUED" });
              else expect(v, label).toMatchObject({ status: "PENDING", state: "BUY CANDIDATE" });
            }
  });

  it("cheap without a moat is HOLD, never BUY — and SELL still issues where the zone is SELL", () => {
    expect(verdictFor({ ratios: AUTO_BUY, moat: "none", judgements: QUALITY_MET }).status).toBe("HOLD");
    expect(verdictFor({ ratios: AUTO_SELL, moat: "none", judgements: QUALITY_MET }).status).toBe("SELL");
  });
});

describe("deriveVerdict — \"not sure\" never becomes agreement and never yields a verdict", () => {
  const routes: Case["ratios"][] = [AUTO_HOLD, AUTO_SELL, AUTO_BUY, QUESTION_SELL_OR_HOLD, QUESTION_BUY_OR_HOLD, CLOSE_HOLD_OR_SELL, CLOSE_BUY_OR_HOLD];
  const notSure = {
    uncertainty: rec(NOT_SURE),
    closeCalls: [{ ...rec(NOT_SURE), boundTo: BINDING }],
    thesis: rec(NOT_SURE),
    management: rec(NOT_SURE),
    moatMechanism: rec(NOT_SURE),
    processItems: { ...rec(NOT_SURE), items: null },
  };
  const keys = Object.keys(notSure) as (keyof typeof notSure)[];

  it("every subset of \"not sure\" answers gives exactly the verdict of leaving those questions unanswered", () => {
    for (const ratios of routes) {
      for (let mask = 0; mask < 1 << keys.length; mask++) {
        const chosen = keys.filter((_, i) => mask & (1 << i));
        const answered: Partial<VerdictJudgements> = Object.fromEntries(chosen.map((k) => [k, notSure[k]]));
        const v = verdictFor({ ratios, judgements: answered });
        const unanswered = verdictFor({ ratios });
        expect([v.status, v.state], `${ratios.join("/")} with not sure on ${chosen.join(", ")}`).toEqual([unanswered.status, unanswered.state]);
      }
    }
  });

  it("where an answer is needed, \"not sure\" leaves the state pending", () => {
    expect(verdictFor({ ratios: QUESTION_SELL_OR_HOLD, judgements: { uncertainty: rec(NOT_SURE) } }).status).toBe("PENDING");
    expect(verdictFor({ ratios: CLOSE_HOLD_OR_SELL, judgements: { closeCalls: [{ ...rec(NOT_SURE), boundTo: BINDING }] } }).status).toBe("PENDING");
    expect(verdictFor({ ratios: AUTO_BUY, judgements: { ...QUALITY_MET, management: rec(NOT_SURE) } }).status).toBe("PENDING");
  });
});

describe("deriveVerdict — templated reasons from computed numbers", () => {
  it("the reason states the price, the three Base values and the three rates the check used", () => {
    const v = verdictFor({ ratios: ["1.25", "1.25", "1.25"] });
    const base = PRICE.dividedBy("1.25").toFixed(2);
    expect(v.reason).toContain(`$${PRICE.toFixed(2)}`);
    expect(v.reason).toContain(`$${base}`);
    expect(v.reason).toContain("1.25×");
    expect(v.reason).toContain("8.5% / 9.0% / 9.5%");
    expect(v.reason).toContain("Low SELL, Medium HOLD, High HOLD");
  });

  it("the same result always gives the same verdict (AR0-5)", () => {
    const c: Case = { ratios: CLOSE_HOLD_OR_SELL, judgements: QUALITY_MET };
    expect(deriveVerdict(resultFor(c))).toEqual(deriveVerdict(resultFor(c)));
  });
});

// CF-METHODOLOGY-V3-IMPLEMENT-01 — Methodology v3 D5's "ramp-dependent" label.
describe("ramp-dependent — a BUY the same reading would not give with Base growth flat at the drafted rate", () => {
  it("labels an automatic BUY whose flat-growth Base is HOLD; the status stays BUY", () => {
    const v = verdictFor({ ratios: AUTO_BUY, flatRatios: AUTO_HOLD, judgements: QUALITY_MET });
    expect(v.status).toBe("BUY");
    expect(v.rampDependent).toMatch(new RegExp(`^${RAMP_DEPENDENT_LABEL}:`));
    expect(v.reason).toContain(RAMP_DEPENDENT_LABEL);
  });

  it("labels a BUY candidate too", () => {
    const v = verdictFor({ ratios: AUTO_BUY, flatRatios: AUTO_SELL });
    expect(v.state).toBe("BUY CANDIDATE");
    expect(v.rampDependent).toMatch(new RegExp(`^${RAMP_DEPENDENT_LABEL}:`));
  });

  it("no label where flat growth also gives BUY, where no ramp moved Base, or on a HOLD", () => {
    expect(verdictFor({ ratios: AUTO_BUY, flatRatios: AUTO_BUY, judgements: QUALITY_MET }).rampDependent).toBeUndefined();
    expect(verdictFor({ ratios: AUTO_BUY, judgements: QUALITY_MET }).rampDependent).toBeUndefined();
    expect(verdictFor({ ratios: AUTO_HOLD, flatRatios: AUTO_SELL }).rampDependent).toBeUndefined();
  });

  it("reads an uncertainty answer the same way: flat growth must still be BUY at that level", () => {
    const low = { ...QUALITY_MET, uncertainty: rec("Low" as const) };
    const v = verdictFor({ ratios: QUESTION_BUY_OR_HOLD, flatRatios: ["0.95", "0.95", "0.95"], judgements: low });
    expect(v.status).toBe("BUY");
    expect(v.rampDependent).toMatch(new RegExp(`^${RAMP_DEPENDENT_LABEL}:`));
  });
});
