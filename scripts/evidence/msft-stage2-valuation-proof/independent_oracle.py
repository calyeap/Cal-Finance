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

REVIEW-38751207194-1, CORRECT — this file's EV->equity bridge now
independently re-derives the SAME production bridge `modules/enterpriseValue.ts`
computes (debt + finance leases - cash/marketable securities - §4.4
non-operating-equity-investments, then diluted shares = raw shares +
treasury-method dilution), not the earlier simplified net-debt-only bridge.
It reproduces the production per-share figures ($214.26/$283.31/$402.73,
post-CALVIN-RULING-correction below) to the cent, prints the full
year-by-year NOPAT/reinvestment/FCFF/PV path and the year-10-to-terminal
transition per scenario (issue #439 authority item DO-5), and fails closed
on a non-positive terminalRoic.

CALVIN RULING, CF-MSFT-STAGE2-REAL-VALUATION-PROOF-01 (2026-10-15) — this
file now independently re-implements the fading net-reinvestment path
years 6-10 fade toward (margin x (1 - TAX) x (G / terminalRoic)) the
TypeScript production path now applies
(lib/analyzer/modules/scenarioOutputs.ts's
buildFadingReinvestmentIntensityPath), closing the forecast-to-terminal
coherence gap Calvin's ruling named a material blocker (year-10 implied
RONIC below cost of capital, terminal FCF jumps up to x2.49 of year-10
FCF). See `fading_intensity_path` below.
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

# EV bridge instant balance-sheet facts, same tags tagMap.ts maps for MSFT.
ltdebt = instant_values(get_tag(facts, "LongTermDebt"))
leaseliab = instant_values(get_tag(facts, "FinanceLeaseLiability"))
cash = instant_values(get_tag(facts, "CashAndCashEquivalentsAtCarryingValue"))
stinv = instant_values(get_tag(facts, "ShortTermInvestments"))
cp = instant_values(get_tag(facts, "CommercialPaper"))
stb = instant_values(get_tag(facts, "ShortTermBorrowings"))
# §4.4 non-operating-equity-investments — Calvin's existing 2026-09-21 ruling
# (issue #188) selects `us-gaap:LongTermInvestments` for MSFT, reused
# unchanged by this outcome (recordJudgment call in
# msftStage2ValuationProof.test.ts). Re-derived here from the raw capture,
# not assumed from the proof doc's prose.
nonop_investments = instant_values(get_tag(facts, "LongTermInvestments"))
# Treasury-method dilution — the SAME annual tag tagMap.ts's
# `treasury-method-dilution` entry maps
# (IncrementalCommonSharesAttributableToShareBasedPaymentArrangements),
# re-derived independently here rather than assumed.
treasury_dilution = annual_values(get_tag(facts, "IncrementalCommonSharesAttributableToShareBasedPaymentArrangements"), unit="shares")

shares = facts.get("dei", {}).get("EntityCommonStockSharesOutstanding", {}).get("units", {})
share_obs = instant_values(shares, unit="shares")

fy_ends = sorted(set(revenue) & set(opinc) & set(capex) & set(lease_rou) & set(dep) & set(amort))
fy2026 = fy_ends[-1]

BASE_REVENUE = revenue[fy2026]
NET_OF_DA_FY26 = (capex[fy2026] + lease_rou[fy2026] - dep[fy2026] - amort[fy2026]) / BASE_REVENUE
LEASE_INCL_GROSS_FY26 = (capex[fy2026] + lease_rou[fy2026]) / BASE_REVENUE

# ---------------------------------------------------------------------------
# THE REAL PRODUCTION EV -> EQUITY BRIDGE (modules/enterpriseValue.ts,
# computeEnterpriseValue). Re-derived from the raw capture independently of
# the TypeScript module: dilutedShares = sharesOutstanding +
# treasuryMethodDilution; enterpriseValue's bridge term = totalDebt +
# financeLeaseLiabilities - cashAndMarketableDebtSecurities -
# nonOperatingEquityInvestmentsAtBook (the §4.4 judgment term). Previous
# revisions of this oracle (pre REVIEW-38751207194-1) used a simplified
# bridge that omitted the §4.4 term entirely — that gap is closed here.
# ---------------------------------------------------------------------------
RAW_SHARE_COUNT = share_obs[max(share_obs)]
TREASURY_DILUTION = treasury_dilution[fy2026]
DILUTED_SHARE_COUNT = RAW_SHARE_COUNT + TREASURY_DILUTION

TOTAL_DEBT = ltdebt.get(fy2026, Decimal(0)) + cp.get(fy2026, Decimal(0)) + stb.get(fy2026, Decimal(0))
FINANCE_LEASES = leaseliab.get(fy2026, Decimal(0))
CASH_AND_MARKETABLE_SECURITIES = cash.get(fy2026, Decimal(0)) + stinv.get(fy2026, Decimal(0))
NON_OPERATING_INVESTMENTS = nonop_investments.get(fy2026, Decimal(0))

# computeEnterpriseValue's own bridge term: everything added to/subtracted
# from marketCap to reach enterpriseValue. Equity = EV - bridge, so this
# same term is what a scenario EV must have subtracted from it to reach
# equity — independent of marketCap/price, which the bridge term itself
# does not depend on.
NET_DEBT_BRIDGE = TOTAL_DEBT + FINANCE_LEASES - CASH_AND_MARKETABLE_SECURITIES - NON_OPERATING_INVESTMENTS
# Simplified bridge Stage 1's own oracle used (no §4.4 term) — kept only to
# show, by contrast, why it diverges from the real bridge above. Not used
# for any figure in §3/§4/§5/§7 of the proof doc any more.
SIMPLIFIED_NET_DEBT_BRIDGE = TOTAL_DEBT + FINANCE_LEASES - CASH_AND_MARKETABLE_SECURITIES

TAX = Decimal("0.19")  # FACT — MSFT's own disclosed FY2026 effective rate (10-K text), Stage 1 §1.
R = Decimal("0.10")    # EXISTING APPROVED — POLICY.rateGrid[1], the scenario-DCF cost of capital.
G = Decimal("0.03")    # EXISTING APPROVED — POLICY.terminalGrowth.


def path_shape(const_value, terminal_value, years=10):
    """§7.1's fixed shape: constant for years 1-5, linear fade to
    terminal_value over years 6-10. Shared by the revenue-growth path (fading
    to G, the policy terminal growth) and, as of the CALVIN RULING below, the
    reinvestment-intensity path (fading to the terminal formula's own implied
    rate) — same shape, different target, never two implementations."""
    path = []
    for _t in range(1, 6):
        path.append(const_value)
    for t in range(6, 11):
        frac = (t - 5) / 5
        path.append(const_value + (terminal_value - const_value) * Decimal(frac))
    return path


def fading_intensity_path(explicit_intensity, margin, terminal_roic):
    """CALVIN RULING, CF-MSFT-STAGE2-REAL-VALUATION-PROOF-01 (2026-10-15):
    forecast growth, reinvestment, incremental returns and the year-10 ->
    terminal boundary must be mutually consistent, not a flat explicit-period
    reinvestment rate jumping straight into the terminal formula's own
    implied rate. That formula already embeds one: terminal reinvestment (in
    dollars) is terminalNopat x (G / terminal_roic) — the standard
    sustainable-growth identity g = ROIC x (reinvestment / NOPAT). As a
    fraction of terminal revenue (terminalNopat / terminalRevenue =
    margin x (1 - TAX) exactly, the (1+g) factor cancelling), that is
    margin x (1 - TAX) x (G / terminal_roic) — exactly the model already
    computes, not a number chosen to erase the jump. This fades the
    analyst's own explicit-period intensity toward that level over years
    6-10 using the SAME fixed-shape fade path_shape already provides for
    revenue growth (mirrors lib/analyzer/modules/scenarioOutputs.ts's
    buildFadingReinvestmentIntensityPath, independently re-implemented)."""
    terminal_intensity = Decimal(str(margin)) * (1 - TAX) * (G / Decimal(str(terminal_roic)))
    return path_shape(Decimal(str(explicit_intensity)), terminal_intensity)


def run_scenario(name, growth, margin, intensity, terminal_roic, net_debt_bridge=NET_DEBT_BRIDGE,
                  share_count=DILUTED_SHARE_COUNT, verbose=False):
    term_roic = Decimal(str(terminal_roic))
    # Division-safety guard (REVIEW-38751207194-1) — mirrors the same guard
    # recordedBundles.ts's recordAnalystBundle now enforces on write: a
    # non-positive terminal ROIC makes G/terminalRoic non-finite or sign-
    # flipped, which is never a valid scenario to run the oracle against.
    if term_roic <= 0:
        raise ValueError(f"{name}: terminal_roic must be positive, got {term_roic}")

    growth_path = path_shape(Decimal(str(growth)), G)
    intensity_path = fading_intensity_path(intensity, margin, term_roic)
    revs = [BASE_REVENUE]
    rev = BASE_REVENUE
    for t in range(10):
        rev = rev * (1 + growth_path[t])
        revs.append(rev)
    rows = []
    pv_sum = Decimal(0)
    for t in range(1, 11):
        nopat = revs[t] * Decimal(str(margin)) * (1 - TAX)
        reinvestment = revs[t] * intensity_path[t - 1]
        fcff = nopat - reinvestment
        pv = fcff / ((1 + R) ** t)
        pv_sum += pv
        rows.append(dict(year=t, revenue=revs[t], nopat=nopat, reinvestment=reinvestment, fcff=fcff, pv=pv))
    nopat10 = revs[10] * Decimal(str(margin)) * (1 - TAX)
    terminal_nopat = nopat10 * (1 + G)
    terminal_fcf = terminal_nopat * (1 - G / term_roic)
    term_value_y10 = terminal_fcf / (R - G)
    term_pv = term_value_y10 / ((1 + R) ** 10)
    ev = pv_sum + term_pv
    equity = ev - net_debt_bridge
    per_share = equity / share_count

    if verbose:
        print(f"-- {name}: year-by-year NOPAT / reinvestment / FCFF / PV --")
        for row in rows:
            print(
                f"  year {row['year']:>2}: revenue=${float(row['revenue'])/1e9:8.2f}B "
                f"NOPAT=${float(row['nopat'])/1e9:7.2f}B reinvestment=${float(row['reinvestment'])/1e9:7.2f}B "
                f"FCFF=${float(row['fcff'])/1e9:7.2f}B PV=${float(row['pv'])/1e9:7.2f}B"
            )
        year10_fcf = rows[-1]["fcff"]
        print(
            f"  year-10 -> terminal: year-10 FCFF=${float(year10_fcf)/1e9:.2f}B, "
            f"terminal FCF (year 11)=${float(terminal_fcf)/1e9:.2f}B "
            f"(x{float(terminal_fcf/year10_fcf):.2f} of year-10 FCFF), "
            f"terminal value at year 10=${float(term_value_y10)/1e9:.1f}B, "
            f"PV of terminal=${float(term_pv)/1e9:.1f}B"
        )
        print(
            f"  EV=${float(ev)/1e9:.2f}B (PV explicit=${float(pv_sum)/1e9:.2f}B + PV terminal=${float(term_pv)/1e9:.2f}B), "
            f"equity=${float(equity)/1e9:.2f}B, per_share=${float(per_share):.2f}"
        )
    return dict(name=name, ev=ev, pv_sum=pv_sum, term_pv=term_pv, equity=equity, per_share=per_share,
                terminal_share=term_pv / ev, rows=rows, terminal_fcf=terminal_fcf)


def coherence(growth, margin, intensity, terminal_roic):
    term_roic = Decimal(str(terminal_roic))
    growth_path = path_shape(Decimal(str(growth)), G)
    intensity_path = fading_intensity_path(intensity, margin, term_roic)
    revs = [BASE_REVENUE]
    rev = BASE_REVENUE
    for t in range(10):
        rev = rev * (1 + growth_path[t])
        revs.append(rev)
    nopats = [BASE_REVENUE * Decimal(str(margin)) * (1 - TAX)]
    reinvests = [BASE_REVENUE * intensity_path[0]]
    for t in range(1, 11):
        nopats.append(revs[t] * Decimal(str(margin)) * (1 - TAX))
        reinvests.append(revs[t] * intensity_path[t - 1])
    # Explicit-period RONIC, re-based on the SAME faded reinvestment path:
    # year-1 incremental NOPAT over year-0's own (unfaded, since the fade is
    # years 6-10 only) reinvestment — unchanged in shape from before this
    # correction, just reading the faded path's own year-1 entry.
    ronic_explicit = (nopats[1] - nopats[0]) / reinvests[0]
    ronic_year10 = (nopats[10] - nopats[9]) / reinvests[9]
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
    print()

    print("== THE REAL PRODUCTION EV -> EQUITY BRIDGE (modules/enterpriseValue.ts, re-derived) ==")
    print(f"Raw shares outstanding (dei:EntityCommonStockSharesOutstanding, {max(share_obs)}): {RAW_SHARE_COUNT}")
    print(f"Treasury-method dilution (FY2026, IncrementalCommonSharesAttributableToShareBasedPaymentArrangements): {TREASURY_DILUTION}")
    print(f"Diluted share count (raw + dilution): {DILUTED_SHARE_COUNT}")
    print(f"Total debt (LongTermDebt + CommercialPaper + ShortTermBorrowings): ${float(TOTAL_DEBT)/1e9:.3f}B")
    print(f"Finance lease liabilities: ${float(FINANCE_LEASES)/1e9:.3f}B")
    print(f"Cash and marketable debt securities (cash + short-term investments): ${float(CASH_AND_MARKETABLE_SECURITIES)/1e9:.3f}B")
    print(f"§4.4 non-operating equity investments at book (us-gaap:LongTermInvestments, Calvin's issue #188 ruling): ${float(NON_OPERATING_INVESTMENTS)/1e9:.3f}B")
    sign = "net cash" if NET_DEBT_BRIDGE < 0 else "net debt"
    print(f"EV bridge term (debt + leases - cash/securities - non-op investments) = ${float(NET_DEBT_BRIDGE)/1e9:+.3f}B ({sign} position of ${abs(float(NET_DEBT_BRIDGE))/1e9:.3f}B)")
    print(f"(For contrast only, NOT used below) simplified bridge omitting the §4.4 term: ${float(SIMPLIFIED_NET_DEBT_BRIDGE)/1e9:+.3f}B")
    print()

    print("== CANDIDATE — per-scenario EV / equity / per-share, on the REAL production bridge, with full year-by-year detail (DO-5) ==")
    candidate_results = {}
    for name, s in CANDIDATE.items():
        res = run_scenario(name, s["growth"], s["margin"], s["intensity"], s["terminal_roic"], verbose=True)
        candidate_results[name] = res
        print(f"{name}: EV=${float(res['ev'])/1e9:.1f}B equity=${float(res['equity'])/1e9:.1f}B "
              f"per_share=${float(res['per_share']):.2f} terminal_share={float(res['terminal_share'])*100:.1f}%")
        print()

    print("== Reproduction check — this oracle's per-share figures vs. the production run's own figures ==")
    expected = {"bear": "214.26", "base": "283.31", "bull": "402.73"}
    for name, res in candidate_results.items():
        rounded = f"{float(res['per_share']):.2f}"
        status = "MATCH" if rounded == expected[name] else "MISMATCH"
        print(f"{name}: oracle=${rounded} production=${expected[name]} -> {status}")
    print()

    print("== Comparison: candidate terminal ROIC vs. the two REJECTED alternatives (on the REAL production bridge) ==")
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
        res = candidate_results[name]
        flag = "BREACH >85%" if res["terminal_share"] > Decimal("0.85") else (
            "CAUTION >75%" if res["terminal_share"] > Decimal("0.75") else "within normal 60-75%" if res["terminal_share"] > Decimal("0.60") else "below 60% (not a caution, just low)"
        )
        print(f"{name}: terminal_share={float(res['terminal_share'])*100:.1f}% -> {flag}")
    print()

    print("== §2.4(i)/(ii) diagnostics, re-stated on the candidate (disclosed, not hidden or silently fixed) ==")
    print("(Bridge-independent — RONIC and terminal/year-10 FCF ratios depend only on NOPAT/reinvestment, not on the EV->equity bridge, so these are unaffected by the §4.4 bridge correction above.)")
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

    print("== Materiality: unmapped acquisitions/deltaNwc (+1pp / +2pp of revenue), on the CANDIDATE, on the REAL production bridge ==")
    for name, s in CANDIDATE.items():
        base_res = candidate_results[name]
        for bump_label, bump in [("+1pp", "0.01"), ("+2pp", "0.02")]:
            bumped_intensity = str(Decimal(s["intensity"]) + Decimal(bump))
            bumped_res = run_scenario(name, s["growth"], s["margin"], bumped_intensity, s["terminal_roic"])
            delta_pct = (bumped_res["per_share"] - base_res["per_share"]) / base_res["per_share"]
            print(f"{name} {bump_label}: per_share=${float(bumped_res['per_share']):.2f} "
                  f"(baseline ${float(base_res['per_share']):.2f}, {float(delta_pct)*100:+.2f}%)")


if __name__ == "__main__":
    main()
