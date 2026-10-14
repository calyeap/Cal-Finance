#!/usr/bin/env python3
"""Engine A — the one shadow 10-year FCFF DCF candidate for
CF-ANALYZER-MSFT-VALUATION-PHASE-B-PROOF-01.

Standalone, provisional, non-governing. Does not import, read or reuse
lib/analyzer/modules/scenarioOutputs.ts or any other production code.
Pure stdlib; no network access; deterministic given inputs.json and the
shared driver_schedule.py assumption path.

Discounts the explicit-period FCFF year by year (loop), then adds a Gordon-
growth terminal value computed in the most direct textbook form:
  TV_N = FCFF_{N+1} / (wacc - g)
"""
import json
import pathlib

import driver_schedule

HERE = pathlib.Path(__file__).parent


def load_inputs():
    return json.loads((HERE / "inputs.json").read_text())


def compute_wacc(inp):
    sec = inp["realDataFromCommittedSecCapture"]
    ext = inp["externallySourcedAssumptions_mustBeReadAsAssumptionsNotFacts"]
    price = inp["realDataFromCommittedPriceCapture"]["historicalClose"]["val"]
    shares = sec["sharesOutstandingCoverPage"]["val"]
    market_cap = price * shares

    debt = (
        sec["longTermDebtTotalUsd"]["val"]
        + sec["financeLeaseLiabilityUsd"]["val"]
        + sec["operatingLeaseLiabilityUsd"]["val"]
    )

    rf = ext["riskFreeRate"]["val"]
    erp = ext["equityRiskPremium"]["val"]
    beta = ext["beta"]["val"]
    cost_of_equity = rf + beta * erp

    pretax_cost_of_debt = ext["pretaxCostOfDebt"]["val"]
    tax = ext["effectiveTaxRateFy2026"]["val"]
    after_tax_cost_of_debt = pretax_cost_of_debt * (1 - tax)

    total_capital = market_cap + debt
    w_equity = market_cap / total_capital
    w_debt = debt / total_capital

    return {
        "costOfEquity": cost_of_equity,
        "afterTaxCostOfDebt": after_tax_cost_of_debt,
        "weightEquity": w_equity,
        "weightDebt": w_debt,
        "wacc": w_equity * cost_of_equity + w_debt * after_tax_cost_of_debt,
        "marketCap": market_cap,
        "debt": debt,
    }


def equity_bridge(inp, enterprise_value):
    """No separate non-operating-investments add-back: in the committed capture,
    EquityMethodInvestments and EquitySecuritiesWithoutReadilyDeterminableFairValueAmount
    are consistently subsets of LongTermInvestments (8.9B/15.4B at 2025-06-30 and
    24.4B/36.3B at 2026-06-30), not amounts sitting outside it. Adding both would
    double-count ~$24.4B already inside cash_and_investments."""
    sec = inp["realDataFromCommittedSecCapture"]
    cash_and_investments = (
        sec["cashUsd"]["val"]
        + sec["shortTermInvestmentsUsd"]["val"]
        + sec["longTermInvestmentsUsd"]["val"]
    )
    debt = (
        sec["longTermDebtTotalUsd"]["val"]
        + sec["financeLeaseLiabilityUsd"]["val"]
        + sec["operatingLeaseLiabilityUsd"]["val"]
    )
    equity_value = enterprise_value + cash_and_investments - debt
    shares = sec["sharesOutstandingCoverPage"]["val"]
    return {
        "cashAndInvestments": cash_and_investments,
        "debtAndLeaseEquivalents": debt,
        "equityValue": equity_value,
        "sharesOutstanding": shares,
        "valuePerShare": equity_value / shares,
    }


def run(inp=None, drivers=None):
    inp = inp or load_inputs()
    drivers = drivers or driver_schedule.build(inp)
    wacc_info = compute_wacc(inp)
    wacc = wacc_info["wacc"]

    rows = []
    for yr in drivers["schedule"]:
        reinvestment = yr["ebitAfterTax"] * yr["reinvestmentRate"]
        fcff = yr["ebitAfterTax"] - reinvestment
        t = yr["year"]
        discount_factor = 1.0
        for _ in range(t):
            discount_factor = discount_factor / (1 + wacc)
        pv = fcff * discount_factor
        rows.append({**yr, "reinvestment": reinvestment, "fcff": fcff,
                     "discountFactor": discount_factor, "pv": pv})

    g = drivers["terminalGrowth"]
    rT = drivers["terminalReinvestmentRate"]
    last_ebit_at = rows[-1]["ebitAfterTax"]
    terminal_fcff_next_year = last_ebit_at * (1 + g) * (1 - rT)
    terminal_value_at_year_n = terminal_fcff_next_year / (wacc - g)
    pv_terminal_value = terminal_value_at_year_n * rows[-1]["discountFactor"]

    sum_pv_explicit = 0.0
    for r in rows:
        sum_pv_explicit = sum_pv_explicit + r["pv"]

    enterprise_value = sum_pv_explicit + pv_terminal_value
    bridge = equity_bridge(inp, enterprise_value)

    return {
        "engine": "A (shadow_dcf.py — year-by-year loop discounting)",
        "wacc": wacc_info,
        "rows": rows,
        "terminalGrowth": g,
        "terminalReinvestmentRate": rT,
        "terminalFcffNextYear": terminal_fcff_next_year,
        "terminalValueAtYearN": terminal_value_at_year_n,
        "pvTerminalValue": pv_terminal_value,
        "sumPvExplicit": sum_pv_explicit,
        "enterpriseValue": enterprise_value,
        "terminalValueShareOfEv": pv_terminal_value / enterprise_value,
        **bridge,
    }


if __name__ == "__main__":
    result = run()
    print(json.dumps({
        "engine": result["engine"],
        "wacc": result["wacc"]["wacc"],
        "enterpriseValue": result["enterpriseValue"],
        "equityValue": result["equityValue"],
        "valuePerShare": result["valuePerShare"],
        "terminalValueShareOfEv": result["terminalValueShareOfEv"],
    }, indent=2))
