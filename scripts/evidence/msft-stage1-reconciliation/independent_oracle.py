#!/usr/bin/env python3
"""Independent oracle for CF-MSFT-FINANCE-CONSISTENCY-01.

Second, independently-written extraction + arithmetic path over the SAME
committed raw SEC capture (lib/analyzer/acquisition/captures/msft-companyfacts.json).
Does NOT import or call any production TypeScript module (history.ts,
tagMap.ts, computeReinvestment, computeScenarioEnterpriseValue). Implements
its own period-selection and arithmetic from first principles, reading only
the raw XBRL facts, so an agreement with PR #436's draft figures is genuine
independent corroboration rather than the same code checking itself.
"""
import json
from decimal import Decimal, getcontext

getcontext().prec = 30

CAPTURE_PATH = "lib/analyzer/acquisition/captures/msft-companyfacts.json"


def load():
    with open(CAPTURE_PATH) as f:
        return json.load(f)


def annual_values(tag_units, unit="USD"):
    """Return {fiscal_year_end_date: Decimal value} for ~365-day duration
    facts (annual flow figures), independently selecting one observation per
    period end by preferring the LATEST filed (highest accession/frame) value
    for that exact (start,end) pair, then collapsing to one value per end
    date by taking the one tied to the largest `end` that is itself a fiscal
    year-end (i.e. the as-filed annual, not a quarter). This is a simpler,
    independently-reasoned rule than history.ts's own selection logic, not a
    port of it.
    """
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
            continue  # keep only ~annual-duration facts
        key = (start, end)
        # Prefer the fact with the latest 'filed' date for this exact period.
        prior = by_period.get(key)
        if prior is None or (o.get("filed", "") >= prior.get("filed", "")):
            by_period[key] = o
    # Collapse to one value per period end (fiscal year), preferring entries
    # whose own filed date is latest, in case of overlapping periods.
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


def main():
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

    shares = d["facts"].get("dei", {}).get("EntityCommonStockSharesOutstanding", {}).get("units", {})
    share_obs = instant_values(shares, unit="shares")

    fy_ends = sorted(set(revenue) & set(opinc) & set(capex) & set(lease_rou) & set(dep) & set(amort))
    print("Fiscal year-ends with full data:", fy_ends)
    print()

    rows = []
    for end in fy_ends:
        rev = revenue[end]
        oi = opinc[end]
        cpx = capex[end]
        rou = lease_rou[end]
        da = dep[end] + amort[end]
        margin = oi / rev
        gross_capex_ratio = cpx / rev
        lease_incl_gross = (cpx + rou) / rev
        net_reinvest_partial = cpx + rou - da
        net_of_da_ratio = net_reinvest_partial / rev
        rows.append(dict(end=end, revenue=rev, opinc=oi, capex=cpx, rou=rou, da=da,
                          margin=margin, gross_capex_ratio=gross_capex_ratio,
                          lease_incl_gross=lease_incl_gross,
                          net_reinvest_partial=net_reinvest_partial,
                          net_of_da_ratio=net_of_da_ratio))

    print(f"{'FY end':12} {'Revenue($M)':>12} {'Margin':>8} {'CapexRatio':>11} {'LeaseInclGross':>15} {'NetOfDA':>9}")
    for r in rows:
        print(f"{r['end']:12} {float(r['revenue'])/1e6:12.0f} {float(r['margin'])*100:7.2f}% "
              f"{float(r['gross_capex_ratio'])*100:10.2f}% {float(r['lease_incl_gross'])*100:14.2f}% "
              f"{float(r['net_of_da_ratio'])*100:8.2f}%")
    print()

    # ---- FY2026 figures (most recent fiscal year end in the capture) ----
    fy2026 = rows[-1]
    fy2025 = rows[-2]
    print("== FY2026 headline figures (independent extraction) ==")
    print("Revenue:", fy2026["revenue"])
    print("Operating margin:", fy2026["margin"])
    print("Revenue growth FY2025->FY2026:", (fy2026["revenue"] - fy2025["revenue"]) / fy2025["revenue"])
    print("Gross cash-capex/revenue:", fy2026["gross_capex_ratio"])
    print("Lease-inclusive gross capital intensity (no acquisitions):", fy2026["lease_incl_gross"])
    print("Net-of-D&A partial reinvestment/revenue:", fy2026["net_of_da_ratio"])
    print()

    # ---- Ten-year margin cyclicality (independent recompute) ----
    ten = rows[-10:]
    margins = [r["margin"] for r in ten]
    max_m, min_m = max(margins), min(margins)
    worst_decline = max((margins[i - 1] - margins[i] for i in range(1, len(margins)) if margins[i] < margins[i - 1]), default=Decimal(0))
    print("== Ten-year margin cyclicality (independent) ==")
    print("Window:", ten[0]["end"], "to", ten[-1]["end"])
    print("Max margin:", max_m, "Min margin:", min_m, "Range:", max_m - min_m)
    print("Worst single-year decline:", worst_decline)
    print()

    # ---- OCF ten-year series + FCF after cash capex, FCF after lease-funded capacity ----
    ocf_fy_ends = sorted(set(ocf) & set(capex) & set(lease_rou))
    ocf_ten = ocf_fy_ends[-10:]
    print("== Operating cash flow / FCF character (independent) ==")
    prev_ocf = None
    declines = []
    fcf_after_capex_rows = []
    for end in ocf_ten:
        o = ocf[end]
        cpx = capex[end]
        rou = lease_rou[end]
        fcf_after_capex = o - cpx
        fcf_after_capex_and_lease = o - cpx - rou
        fcf_after_capex_rows.append((end, o, cpx, rou, fcf_after_capex, fcf_after_capex_and_lease))
        if prev_ocf is not None:
            declines.append((end, (o - prev_ocf) / prev_ocf))
        prev_ocf = o
    for end, o, cpx, rou, fac, facl in fcf_after_capex_rows:
        print(f"{end}: OCF={float(o)/1e6:.0f}M capex={float(cpx)/1e6:.0f}M leaseROU={float(rou)/1e6:.0f}M "
              f"FCF(after cash capex)={float(fac)/1e6:.0f}M FCF(after capex+lease-funded capacity)={float(facl)/1e6:.0f}M")
    print()
    print("YoY OCF changes:", [(e, f"{float(v)*100:.2f}%") for e, v in declines])
    neg_fcf_after_capex = [end for end, _, _, _, fac, _ in fcf_after_capex_rows if fac < 0]
    neg_fcf_after_capex_and_lease = [end for end, _, _, _, _, facl in fcf_after_capex_rows if facl < 0]
    print("Years FCF-after-cash-capex negative:", neg_fcf_after_capex)
    print("Years FCF-after-capex-and-lease-funded-capacity negative:", neg_fcf_after_capex_and_lease)
    print()

    # ---- Net debt bridge, FY2026 ----
    end26 = fy2026["end"]
    debt = ltdebt.get(end26, Decimal(0)) + cp.get(end26, Decimal(0)) + stb.get(end26, Decimal(0))
    leases = leaseliab.get(end26, Decimal(0))
    cash_and_sec = cash.get(end26, Decimal(0)) + stinv.get(end26, Decimal(0))
    net_debt = debt + leases - cash_and_sec
    print("== Net debt bridge FY2026 (independent) ==")
    print("Debt (LT debt + CP + ST borrowings):", debt)
    print("Finance lease liabilities:", leases)
    print("Cash + marketable debt securities:", cash_and_sec)
    print("Net debt:", net_debt)
    print()

    # ---- Share count ----
    latest_share_end = max(share_obs)
    print("Share count as of", latest_share_end, ":", share_obs[latest_share_end])
    print()

    # ---- Independent scenario DCF re-run, SAME formula shape as policy.ts/scenarioOutputs.ts
    #      but coded from scratch here, not calling the TS function. ----
    r = Decimal("0.10")
    g = Decimal("0.03")
    tax = Decimal("0.19")
    base_rev = fy2026["revenue"]
    share_count = share_obs[latest_share_end]

    def path_shape(const_growth, years=10):
        # constant years 1-5, linear fade to g by year 10, terminal thereafter
        path = []
        for t in range(1, 6):
            path.append(const_growth)
        for t in range(6, 11):
            frac = (t - 5) / 5
            path.append(const_growth + (g - const_growth) * Decimal(frac))
        return path

    def run_scenario(name, growth, margin, intensity, terminal_roic_path):
        growth_path = path_shape(Decimal(str(growth)))
        revs = [base_rev]
        rev = base_rev
        for t in range(10):
            rev = rev * (1 + growth_path[t])
            revs.append(rev)
        pv_sum = Decimal(0)
        for t in range(1, 11):
            nopat = revs[t] * Decimal(str(margin)) * (1 - tax)
            reinvestment = revs[t] * Decimal(str(intensity))
            fcff = nopat - reinvestment
            pv_sum += fcff / ((1 + r) ** t)
        nopat10 = revs[10] * Decimal(str(margin)) * (1 - tax)
        terminal_nopat = nopat10 * (1 + g)
        term_roic = Decimal(str(terminal_roic_path))
        terminal_fcf = terminal_nopat * (1 - g / term_roic)
        term_value_y10 = terminal_fcf / (r - g)
        term_pv = term_value_y10 / ((1 + r) ** 10)
        ev = pv_sum + term_pv
        equity = ev - net_debt
        per_share = equity / share_count
        return dict(name=name, ev=ev, pv_sum=pv_sum, term_pv=term_pv, equity=equity, per_share=per_share,
                    terminal_share=term_pv / ev)

    print("== Independent scenario re-run: methodology-as-written (analyst-specified terminal ROIC) ==")
    for name, growth, margin, intensity, troic in [
        ("bear", "0.08", "0.4168", "0.12", "0.10"),
        ("base", "0.14", "0.45", "0.22", "0.10"),
        ("bull", "0.20", "0.4678", "0.30", "0.20"),
    ]:
        res = run_scenario(name, growth, margin, intensity, troic)
        print(f"{name}: EV={float(res['ev'])/1e9:.1f}B equity={float(res['equity'])/1e9:.1f}B "
              f"per_share=${float(res['per_share']):.2f} terminal_share={float(res['terminal_share'])*100:.1f}%")
    print()

    print("== Independent scenario re-run: runtime-equivalent (terminal ROIC fixed at r+3pp=13%) ==")
    for name, growth, margin, intensity in [
        ("bear", "0.08", "0.4168", "0.12"),
        ("base", "0.14", "0.45", "0.22"),
        ("bull", "0.20", "0.4678", "0.30"),
    ]:
        res = run_scenario(name, growth, margin, intensity, "0.13")
        print(f"{name}: EV={float(res['ev'])/1e9:.1f}B equity={float(res['equity'])/1e9:.1f}B "
              f"per_share=${float(res['per_share']):.2f} terminal_share={float(res['terminal_share'])*100:.1f}%")
    print()

    print("== Independent scenario re-run: net-of-D&A reinvestment basis (§2.1 proposal) ==")
    # Net-of-D&A historical range from the ten-year table: FY2017-23 2.18-8.37%,
    # FY2025 20.25%, FY2026 (peak) 30.60%. Re-anchoring bear/base/bull to this
    # basis using the SAME relative position each driver already holds in the
    # cash-capex series (bear: just below the pre-buildout top; base: at the
    # FY2025 level; bull: ~14% relatively below the FY2026 peak) — see doc §2.1.
    for name, growth, margin, intensity in [
        ("bear (net-of-D&A basis)", "0.08", "0.4168", "0.07"),
        ("base (net-of-D&A basis)", "0.14", "0.45", "0.20"),
        ("bull (net-of-D&A basis)", "0.20", "0.4678", "0.26"),
    ]:
        res = run_scenario(name, growth, margin, intensity, "0.13")
        print(f"{name}: EV={float(res['ev'])/1e9:.1f}B equity={float(res['equity'])/1e9:.1f}B "
              f"per_share=${float(res['per_share']):.2f} terminal_share={float(res['terminal_share'])*100:.1f}%")

    print()
    print("== Independent scenario re-run: bull only, net-of-D&A basis + methodology-as-written terminal ROIC (20%, unfaded) ==")
    res = run_scenario("bull (net-of-D&A, 20% terminal ROIC)", "0.20", "0.4678", "0.26", "0.20")
    print(f"per_share=${float(res['per_share']):.2f} terminal_share={float(res['terminal_share'])*100:.1f}%")

    # ---- §2.4 / §5.5: scenario and terminal coherence, independent second pass ----
    # Lagged RONIC_t = (NOPAT_t - NOPAT_{t-1}) / Reinvestment_{t-1}: return in
    # year t on capital reinvested in year t-1. Not a port of run_scenario();
    # recomputes NOPAT/reinvestment paths directly from the same formula shape.
    def coherence(name, growth, margin, intensity, terminal_roic):
        growth_path = path_shape(Decimal(str(growth)))
        revs = [base_rev]
        rev = base_rev
        for t in range(10):
            rev = rev * (1 + growth_path[t])
            revs.append(rev)
        nopats = [base_rev * Decimal(str(margin)) * (1 - tax)]
        reinvests = [base_rev * Decimal(str(intensity))]
        for t in range(1, 11):
            nopats.append(revs[t] * Decimal(str(margin)) * (1 - tax))
            reinvests.append(revs[t] * Decimal(str(intensity)))
        ronic_explicit = (nopats[1] - nopats[0]) / reinvests[0]
        ronic_year10 = (nopats[10] - nopats[9]) / reinvests[9]
        term_roic = Decimal(str(terminal_roic))
        terminal_fcf = nopats[10] * (1 + g) * (1 - g / term_roic)
        year10_fcf = nopats[10] - reinvests[10]
        return dict(name=name, ronic_explicit=ronic_explicit, ronic_year10=ronic_year10,
                    terminal_over_year10=terminal_fcf / year10_fcf)

    print()
    print("== §2.4(i): cross-scenario explicit-period RONIC, lagged (independent second pass) ==")
    for basis, rows in [
        ("cash-capex (current, 12/22/30%)", [
            ("bear", "0.08", "0.4168", "0.12"), ("base", "0.14", "0.45", "0.22"), ("bull", "0.20", "0.4678", "0.30")]),
        ("net-of-D&A (proposed, 7/20/26%)", [
            ("bear", "0.08", "0.4168", "0.07"), ("base", "0.14", "0.45", "0.20"), ("bull", "0.20", "0.4678", "0.26")]),
    ]:
        print(f"-- {basis} --")
        for name, growth, margin, intensity in rows:
            res = coherence(name, growth, margin, intensity, "0.13")
            print(f"  {name}: explicit-period RONIC={float(res['ronic_explicit'])*100:.2f}% "
                  f"year-10 RONIC={float(res['ronic_year10'])*100:.2f}%")

    print()
    print("== §2.4(ii): terminal-boundary FCF jump, methodology-as-written terminal ROIC (10/10/20%) ==")
    for basis, rows in [
        ("cash-capex", [
            ("bear", "0.08", "0.4168", "0.12", "0.10"), ("base", "0.14", "0.45", "0.22", "0.10"),
            ("bull", "0.20", "0.4678", "0.30", "0.20")]),
        ("net-of-D&A", [
            ("bear", "0.08", "0.4168", "0.07", "0.10"), ("base", "0.14", "0.45", "0.20", "0.10"),
            ("bull", "0.20", "0.4678", "0.26", "0.20")]),
    ]:
        print(f"-- {basis} --")
        for name, growth, margin, intensity, troic in rows:
            res = coherence(name, growth, margin, intensity, troic)
            print(f"  {name}: terminal FCF / year-10 FCF = x{float(res['terminal_over_year10']):.2f}")

    # ---- §3 sensitivity: unmapped acquisitions/deltaNwc net-reinvestment,
    #      approximated as +1pp / +2pp of revenue added to the reinvestment
    #      intensity each year (same path shape, terminal ROIC fixed at the
    #      runtime-equivalent 13%, i.e. holding everything else exactly as
    #      in §5.4's "runtime-equivalent" rows). No new driver values are
    #      invented; only the stated-size addition itself is tested. ----
    print()
    print("== §3 sensitivity: +1pp / +2pp unmapped net-reinvestment (acquisitions + deltaNwc), terminal ROIC fixed 13% ==")
    baseline_by_basis = {
        "cash-capex": {"bear": ("0.08", "0.4168", "0.12"), "base": ("0.14", "0.45", "0.22"), "bull": ("0.20", "0.4678", "0.30")},
        "net-of-D&A": {"bear": ("0.08", "0.4168", "0.07"), "base": ("0.14", "0.45", "0.20"), "bull": ("0.20", "0.4678", "0.26")},
    }
    bumped_per_share = {}
    for basis, scenarios in baseline_by_basis.items():
        print(f"-- {basis} --")
        bumped_per_share[basis] = {}
        for name, (growth, margin, intensity) in scenarios.items():
            base_res = run_scenario(name, growth, margin, intensity, "0.13")
            bumped_per_share[basis][name] = {}
            for bump_label, bump in [("+1pp", "0.01"), ("+2pp", "0.02")]:
                bumped_intensity = str(Decimal(intensity) + Decimal(bump))
                bumped_res = run_scenario(name, growth, margin, bumped_intensity, "0.13")
                bumped_per_share[basis][name][bump_label] = bumped_res["per_share"]
                delta_pct = (bumped_res["per_share"] - base_res["per_share"]) / base_res["per_share"]
                print(f"  {name} {bump_label}: per_share=${float(bumped_res['per_share']):.2f} "
                      f"(baseline ${float(base_res['per_share']):.2f}, {float(delta_pct)*100:+.2f}%)")

    print()
    print("== §3 sensitivity: does the +1pp/+2pp bump change the §2.1 cash-capex vs. net-of-D&A basis-adoption delta? ==")
    for bump_label in ["+1pp", "+2pp"]:
        print(f"-- {bump_label} --")
        for name in ["bear", "base", "bull"]:
            cc = bumped_per_share["cash-capex"][name][bump_label]
            nd = bumped_per_share["net-of-D&A"][name][bump_label]
            print(f"  {name}: cash-capex=${float(cc):.2f} net-of-D&A=${float(nd):.2f} "
                  f"delta={float((nd - cc) / cc) * 100:+.2f}%")


if __name__ == "__main__":
    main()
