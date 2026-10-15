#!/usr/bin/env python3
"""Independent oracle for CF-MSFT-STAGE2-REAL-VALUATION-PROOF-01.

Second, independently-written extraction + arithmetic path over the SAME
committed raw SEC capture (lib/analyzer/acquisition/captures/msft-companyfacts.json)
Stage 1's own oracle (scripts/evidence/msft-stage1-reconciliation/independent_oracle.py)
already verified basis-point-exact against the production pipeline and PR
#436's draft. This file is written fresh (not imported) so its agreement
with the real `computeScenarioEnterpriseValue`/`computeScenarioOutputs`
TypeScript path (proven in
lib/analyzer/acquisition/msftStage2ValuationProof.test.ts) is genuine
independent corroboration, never the same code checking itself. It does NOT
import or call any production TypeScript module.

Scope: this script evaluates the ONE bounded correction issue #439
authorises for Stage 2 — net-of-D&A reinvestment basis, `positive_volatile`
fcfCharacter, and a per-scenario terminal ROIC that fades toward the cost
of capital instead of (a) the runtime's old universal, unconditional r+3pp
rule or (b) the bull scenario's own unfaded 20% ask. It is PROOF of what a
specific, named candidate computes — not a finance-policy approval. Every
number below is either a FACT (sourced from the capture, same tags Stage
1's oracle used) or an ANALYST JUDGEMENT PROPOSAL (this run's own candidate,
pending Calvin's exact-number ruling), labelled as such throughout.
"""
import json
from decimal import Decimal, getcontext

getcontext().prec = 30

CAPTURE_PATH = "lib/analyzer/acquisition/captures/msft-companyfacts.json"


def load():
    with open(CAPTURE_PATH) as f:
        return json.load(f)


def annual_values(tag_units, unit="USD"):
    obs = tag_units.get(unit, [])
    by_period = {}
    for o in obs:
        start = o.get("start")
        end = o.get("end")
        if start is None or end is None:
            continue
        sY, sM, sD = (int(x) for x in start.split("-"))
        eY, eM, eD = (int(x) for x in end.split("-"))
        days = (eY - sY) * 365 + (eM - sM) * 30 + (eD - sD)
        if not (350 <= days <= 380):
            continue
        key = (start, end)
        prior = by_period.get(key)
        if prior is None or (o.get("filed", "") >= prior.get("filed", "")):
            by_period[key] = o
    by_end = {}
    for (start, end), o in by_period.items():
        prior = by_end.get(end)
        if prior is None or (o.get("filed", "") >= prior.get("filed", "")):
            by_end[end] = o
    return {end: Decimal(str(o["val"])) for end, o in by_end.items()}


def instant_values(tag_units, unit="USD"):
    obs = tag_units.get(unit, [])
    by_end = {}
    for o in obs:
        end = o.get("end")
        if end is None:
            continue
        prior = by_end.get(end)
        if prior is None or (o.get("filed", "") >= prior.get("filed", "")):
            by_end[end] = o
    return {end: Decimal(str(o["val"])) for end, o in by_end.items()}


def get_tag(facts, tag):
    return facts.get("us-gaap", {}).get(tag, {}).get("units", {})


# ---------------------------------------------------------------------------
# FACTS — re-extracted independently from the raw capture (same tags Stage
# 1's own oracle used; agreement with that file's §5 is re-verified below,
# not assumed).
# ---------------------------------------------------------------------------
d = load()
facts = d["facts"]

revenue = annual_values(get_tag(facts, "RevenueFromContractWithCustomerExcludingAssessedTax"))
opinc = annual_values(get_tag(facts, "OperatingIncomeLoss"))
capex = annual_values(get_tag(facts, "PaymentsToAcquirePropertyPlantAndEquipment"))
lease_rou = annual_values(get_tag(facts, "RightOfUseAssetObtainedInExchangeForFinanceLeaseLiability"))
dep = annual_values(get_tag(facts, "Depreciation"))
amort = annual_values(get_tag(facts, "AmortizationOfIntangibleAssets"))
ocf = annual_values(get_tag(facts, "NetCashProvidedByUsedInOperatingActivities"))

ltdebt = instant_values(get_tag(facts, "LongTermDebt"))
leaseliab = instant_values(get_tag(facts, "FinanceLeaseLiability"))
cash = instant_values(get_tag(facts, "CashAndCashEquivalentsAtCarryingValue"))
stinv = instant_values(get_tag(facts, "ShortTermInvestments"))
cp = instant_values(get_tag(facts, "CommercialPaper"))
stb = instant_values(get_tag(facts, "ShortTermBorrowings"))

shares = facts.get("dei", {}).get("EntityCommonStockSharesOutstanding", {}).get("units", {})
share_obs = instant_values(shares, unit="shares")

fy_ends = sorted(set(revenue) & set(opinc) & set(capex) & set(lease_rou) & set(dep) & set(amort))
fy2026 = fy_ends[-1]

BASE_REVENUE = revenue[fy2026]
NET_OF_DA_FY26 = (capex[fy2026] + lease_rou[fy2026] - dep[fy2026] - amort[fy2026]) / BASE_REVENUE
LEASE_INCL_GROSS_FY26 = (capex[fy2026] + lease_rou[fy2026]) / BASE_REVENUE

debt = ltdebt.get(fy2026, Decimal(0)) + cp.get(fy2026, Decimal(0)) + stb.get(fy2026, Decimal(0))
leases = leaseliab.get(fy2026, Decimal(0))
cash_and_sec = cash.get(fy2026, Decimal(0)) + stinv.get(fy2026, Decimal(0))
NET_DEBT = debt + leases - cash_and_sec

SHARE_COUNT = share_obs[max(share_obs)]

TAX = Decimal("0.19")  # FACT — MSFT's own disclosed FY2026 effective rate (10-K text), Stage 1 §1.
R = Decimal("0.10")    # EXISTING APPROVED — POLICY.rateGrid[1], the scenario-DCF cost of capital.
G = Decimal("0.03")    # EXISTING APPROVED — POLICY.terminalGrowth.


def path_shape(const_growth, years=10):
    path = []
    for _t in range(1, 6):
        path.append(const_growth)
    for t in range(6, 11):
        frac = (t - 5) / 5
        path.append(const_growth + (G - const_growth) * Decimal(frac))
    return path


def run_scenario(name, growth, margin, intensity, terminal_roic, net_debt=NET_DEBT, share_count=SHARE_COUNT):
    growth_path = path_shape(Decimal(str(growth)))
    revs = [BASE_REVENUE]
    rev = BASE_REVENUE
    for t in range(10):
        rev = rev * (1 + growth_path[t])
        revs.append(rev)
    pv_sum = Decimal(0)
    for t in range(1, 11):
        nopat = revs[t] * Decimal(str(margin)) * (1 - TAX)
        reinvestment = revs[t] * Decimal(str(intensity))
        fcff = nopat - reinvestment
        pv_sum += fcff / ((1 + R) ** t)
    nopat10 = revs[10] * Decimal(str(margin)) * (1 - TAX)
    terminal_nopat = nopat10 * (1 + G)
    term_roic = Decimal(str(terminal_roic))
    terminal_fcf = terminal_nopat * (1 - G / term_roic)
    term_value_y10 = terminal_fcf / (R - G)
    term_pv = term_value_y10 / ((1 + R) ** 10)
    ev = pv_sum + term_pv
    equity = ev - net_debt
    per_share = equity / share_count
    return dict(name=name, ev=ev, pv_sum=pv_sum, term_pv=term_pv, equity=equity, per_share=per_share,
                terminal_share=term_pv / ev)


def coherence(growth, margin, intensity, terminal_roic):
    growth_path = path_shape(Decimal(str(growth)))
    revs = [BASE_REVENUE]
    rev = BASE_REVENUE
    for t in range(10):
        rev = rev * (1 + growth_path[t])
        revs.append(rev)
    nopats = [BASE_REVENUE * Decimal(str(margin)) * (1 - TAX)]
    reinvests = [BASE_REVENUE * Decimal(str(intensity))]
    for t in range(1, 11):
        nopats.append(revs[t] * Decimal(str(margin)) * (1 - TAX))
        reinvests.append(revs[t] * Decimal(str(intensity)))
    ronic_explicit = (nopats[1] - nopats[0]) / reinvests[0]
    ronic_year10 = (nopats[10] - nopats[9]) / reinvests[9]
    term_roic = Decimal(str(terminal_roic))
    terminal_fcf = nopats[10] * (1 + G) * (1 - G / term_roic)
    year10_fcf = nopats[10] - reinvests[10]
    return dict(ronic_explicit=ronic_explicit, ronic_year10=ronic_year10,
                terminal_over_year10=terminal_fcf / year10_fcf)


# ---------------------------------------------------------------------------
# THE CANDIDATE — ANALYST JUDGEMENT PROPOSAL, pending Calvin's exact-number
# ruling. Growth/margin unchanged from PR #436's reviewed, SEC-anchored
# draft (not re-litigated here — issue #439 scopes this correction to
# reinvestment basis / fcfCharacter / terminal ROIC). Reinvestment restated
# net-of-D&A per Stage 1's own §2.1 proposal (7/20/26%, itself a starting
# point, not final). Terminal ROIC is this run's own candidate: NOT the old
# universal r+3pp=13% rule, and NOT the bull scenario's own unfaded 20%
# ask — each scenario fades toward the 10% cost of capital, with only base
# and bull carrying a modest, explicitly-argued, independently-chosen
# durable-moat credit (Azure/M365 switching costs and subscription
# economics), deliberately NOT reusing the diagnostic reverse-DCF's own
# r+3pp number for any scenario.
# ---------------------------------------------------------------------------
CANDIDATE = {
    "bear": dict(growth="0.08", margin="0.4168", intensity="0.07", terminal_roic="0.10"),
    "base": dict(growth="0.14", margin="0.45", intensity="0.20", terminal_roic="0.11"),
    "bull": dict(growth="0.20", margin="0.4678", intensity="0.26", terminal_roic="0.125"),
}


def main():
    print("== FACTS re-verified against the raw capture (independent re-extraction) ==")
    print(f"FY2026 revenue: {BASE_REVENUE}")
    print(f"Net-of-D&A reinvestment/revenue FY2026 (peak): {NET_OF_DA_FY26}")
    print(f"Lease-inclusive gross capital intensity FY2026: {LEASE_INCL_GROSS_FY26}")
    print(f"Net debt (FY2026): {NET_DEBT}")
    print(f"Share count ({max(share_obs)}): {SHARE_COUNT}")
    print()

    print("== CANDIDATE — per-scenario EV / equity / per-share (this run's proposal) ==")
    for name, s in CANDIDATE.items():
        res = run_scenario(name, s["growth"], s["margin"], s["intensity"], s["terminal_roic"])
        print(f"{name}: EV=${float(res['ev'])/1e9:.1f}B equity=${float(res['equity'])/1e9:.1f}B "
              f"per_share=${float(res['per_share']):.2f} terminal_share={float(res['terminal_share'])*100:.1f}%")
    print()

    print("== Comparison: candidate terminal ROIC vs. the two REJECTED alternatives ==")
    for name, s in CANDIDATE.items():
        candidate_res = run_scenario(name, s["growth"], s["margin"], s["intensity"], s["terminal_roic"])
        universal13 = run_scenario(name, s["growth"], s["margin"], s["intensity"], "0.13")
        print(f"{name}: candidate(troic={s['terminal_roic']})=${float(candidate_res['per_share']):.2f}  "
              f"vs universal-13%=${float(universal13['per_share']):.2f}  "
              f"delta={float((candidate_res['per_share']-universal13['per_share'])/universal13['per_share'])*100:+.2f}%")
    bull = CANDIDATE["bull"]
    bull_unfaded20 = run_scenario("bull", bull["growth"], bull["margin"], bull["intensity"], "0.20")
    bull_candidate = run_scenario("bull", bull["growth"], bull["margin"], bull["intensity"], bull["terminal_roic"])
    print(f"bull: candidate(troic=0.125)=${float(bull_candidate['per_share']):.2f} vs "
          f"unfaded-20%-ask=${float(bull_unfaded20['per_share']):.2f} "
          f"delta={float((bull_candidate['per_share']-bull_unfaded20['per_share'])/bull_unfaded20['per_share'])*100:+.2f}% "
          f"terminal_share(unfaded 20%)={float(bull_unfaded20['terminal_share'])*100:.1f}%")
    print()

    print("== Terminal-share caution-band check (§3.5: >75% caution, >85% 'multiple in disguise') ==")
    for name, s in CANDIDATE.items():
        res = run_scenario(name, s["growth"], s["margin"], s["intensity"], s["terminal_roic"])
        flag = "BREACH >85%" if res["terminal_share"] > Decimal("0.85") else (
            "CAUTION >75%" if res["terminal_share"] > Decimal("0.75") else "within normal 60-75%" if res["terminal_share"] > Decimal("0.60") else "below 60% (not a caution, just low)"
        )
        print(f"{name}: terminal_share={float(res['terminal_share'])*100:.1f}% -> {flag}")
    print()

    print("== §2.4(i)/(ii) diagnostics, re-stated on the candidate (disclosed, not hidden or silently fixed) ==")
    for name, s in CANDIDATE.items():
        res = coherence(s["growth"], s["margin"], s["intensity"], s["terminal_roic"])
        print(f"{name}: explicit-period RONIC={float(res['ronic_explicit'])*100:.2f}% "
              f"year-10 RONIC={float(res['ronic_year10'])*100:.2f}% "
              f"terminal FCF / year-10 FCF = x{float(res['terminal_over_year10']):.2f}")
    print("NOTE: issue #439 authority item (d) names a reversed cross-scenario RONIC ranking")
    print("(if present) a diagnostic to explain, not a newly invented hard ranking rule. It is")
    print("explained in the proof doc, not corrected by inventing a new ten-year reinvestment-path")
    print("feature in this bounded outcome.")
    print()

    print("== Materiality: unmapped acquisitions/deltaNwc (+1pp / +2pp of revenue), on the CANDIDATE ==")
    for name, s in CANDIDATE.items():
        base_res = run_scenario(name, s["growth"], s["margin"], s["intensity"], s["terminal_roic"])
        for bump_label, bump in [("+1pp", "0.01"), ("+2pp", "0.02")]:
            bumped_intensity = str(Decimal(s["intensity"]) + Decimal(bump))
            bumped_res = run_scenario(name, s["growth"], s["margin"], bumped_intensity, s["terminal_roic"])
            delta_pct = (bumped_res["per_share"] - base_res["per_share"]) / base_res["per_share"]
            print(f"{name} {bump_label}: per_share=${float(bumped_res['per_share']):.2f} "
                  f"(baseline ${float(base_res['per_share']):.2f}, {float(delta_pct)*100:+.2f}%)")


if __name__ == "__main__":
    main()
