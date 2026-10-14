#!/usr/bin/env python3
"""Shared, disclosed assumption schedule for CF-ANALYZER-MSFT-VALUATION-PHASE-B-PROOF-01.

This module ONLY encodes the judgment-call driver path (revenue growth,
operating margin, reinvestment rate per forecast year) from inputs.json.
It contains no discounting, no terminal value, no equity bridge — those are
computed independently and separately by shadow_dcf.py (Engine A) and
independent_oracle.py (Engine B) from this one shared, disclosed schedule,
so that any numeric disagreement between the two engines reflects a formula/
arithmetic bug, not a difference in assumptions.
"""
import json
import pathlib

HERE = pathlib.Path(__file__).parent


def load_inputs():
    return json.loads((HERE / "inputs.json").read_text())


def build(inp=None):
    inp = inp or load_inputs()
    sec = inp["realDataFromCommittedSecCapture"]
    ext = inp["externallySourcedAssumptions_mustBeReadAsAssumptionsNotFacts"]
    drv = inp["forecastDrivers"]

    years = drv["horizonYears"]
    g1 = drv["revenueGrowthY1"]
    gT = drv["revenueGrowthFadeTo"]
    m1 = drv["operatingMarginFy2026Actual"]
    mT = drv["operatingMarginFadeTo"]
    r1 = drv["reinvestmentRateY1"]
    stable_roic = ext["stableTerminalRoic"]["val"]
    rT = gT / stable_roic
    tax = ext["effectiveTaxRateFy2026"]["val"]

    revenue0 = sec["revenueUsd"]["fy2026"]

    schedule = []
    revenue_prev = revenue0
    for t in range(1, years + 1):
        frac = (t - 1) / (years - 1)
        growth = g1 + (gT - g1) * frac
        margin = m1 + (mT - m1) * frac
        reinvest_rate = r1 + (rT - r1) * frac
        revenue = revenue_prev * (1 + growth)
        ebit = revenue * margin
        ebit_after_tax = ebit * (1 - tax)
        schedule.append({
            "year": t,
            "revenueGrowth": growth,
            "revenue": revenue,
            "operatingMargin": margin,
            "ebit": ebit,
            "taxRate": tax,
            "ebitAfterTax": ebit_after_tax,
            "reinvestmentRate": reinvest_rate,
        })
        revenue_prev = revenue

    return {
        "terminalGrowth": gT,
        "terminalReinvestmentRate": rT,
        "stableTerminalRoic": stable_roic,
        "schedule": schedule,
    }


if __name__ == "__main__":
    out = build()
    (HERE / "output").mkdir(exist_ok=True)
    (HERE / "output" / "driver_schedule.json").write_text(json.dumps(out, indent=2))
    print(json.dumps(out, indent=2))
