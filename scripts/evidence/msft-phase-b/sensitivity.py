#!/usr/bin/env python3
"""One-variable sensitivity sweeps for CF-ANALYZER-MSFT-VALUATION-PHASE-B-PROOF-01.

Each sweep perturbs exactly one input in inputs.json (deep-copied, never the
committed file) and reruns Engine A (shadow_dcf.run) end to end. Reports
value-per-share and the terminal-value share of enterprise value for each
scenario, plus flags for the two candid red lines the issue asks for:
terminal-value share > 85% of EV, and WACC <= terminal growth (r <= g).
"""
import copy
import json
import pathlib

import driver_schedule
import shadow_dcf

HERE = pathlib.Path(__file__).parent


def load_inputs():
    return json.loads((HERE / "inputs.json").read_text())


def run_one(inp):
    drv = driver_schedule.build(inp)
    result = shadow_dcf.run(inp, drv)
    flags = []
    if result["terminalValueShareOfEv"] > 0.85:
        flags.append("TERMINAL_VALUE_OVER_85_PCT_OF_EV")
    if result["wacc"]["wacc"] <= result["terminalGrowth"]:
        flags.append("R_LE_G_TERMINAL_VALUE_UNDEFINED_OR_NEGATIVE")
    return {
        "wacc": result["wacc"]["wacc"],
        "valuePerShare": result["valuePerShare"],
        "terminalValueShareOfEv": result["terminalValueShareOfEv"],
        "flags": flags,
    }


def sweep_discount_rate(base_inp):
    out = {}
    for label, delta in [("-1pp", -0.01), ("base", 0.0), ("+1pp", 0.01)]:
        inp = copy.deepcopy(base_inp)
        inp["externallySourcedAssumptions_mustBeReadAsAssumptionsNotFacts"]["riskFreeRate"]["val"] += delta
        out[label] = run_one(inp)
    return out


def sweep_revenue_growth(base_inp):
    out = {}
    for label, delta in [("-2pp", -0.02), ("base", 0.0), ("+2pp", 0.02)]:
        inp = copy.deepcopy(base_inp)
        inp["forecastDrivers"]["revenueGrowthY1"] += delta
        inp["forecastDrivers"]["revenueGrowthFadeTo"] = max(
            0.005, inp["forecastDrivers"]["revenueGrowthFadeTo"] + delta
        )
        out[label] = run_one(inp)
    return out


def sweep_operating_margin(base_inp):
    out = {}
    for label, delta in [("-2pp", -0.02), ("base", 0.0), ("+2pp", 0.02)]:
        inp = copy.deepcopy(base_inp)
        inp["forecastDrivers"]["operatingMarginFadeTo"] += delta
        out[label] = run_one(inp)
    return out


def sweep_reinvestment(base_inp):
    """Varies stable terminal ROIC, which drives the terminal reinvestment
    rate (g/ROIC) and the Year-1 reinvestment rate's convergence target."""
    out = {}
    for label, delta in [("-5pp_ROIC", -0.05), ("base", 0.0), ("+5pp_ROIC", 0.05)]:
        inp = copy.deepcopy(base_inp)
        inp["externallySourcedAssumptions_mustBeReadAsAssumptionsNotFacts"]["stableTerminalRoic"]["val"] += delta
        out[label] = run_one(inp)
    return out


def implied_growth_at_observed_price(base_inp, tol=0.01, max_iter=60):
    """Context only (not an input): bisect on revenueGrowthY1 (holding the
    fade shape, margin, reinvestment and discount-rate assumptions fixed at
    base case) to find the growth path that reconciles this shadow model's
    value-per-share with the historical captured price."""
    target = base_inp["realDataFromCommittedPriceCapture"]["historicalClose"]["val"]

    def value_at(g1):
        inp = copy.deepcopy(base_inp)
        inp["forecastDrivers"]["revenueGrowthY1"] = g1
        return run_one(inp)["valuePerShare"]

    lo, hi = -0.10, 0.60
    for _ in range(max_iter):
        mid = (lo + hi) / 2
        v = value_at(mid)
        if abs(v - target) < tol:
            return {"impliedRevenueGrowthY1": mid, "valuePerShareAtThatGrowth": v, "targetPrice": target}
        if v < target:
            lo = mid
        else:
            hi = mid
    return {"impliedRevenueGrowthY1": mid, "valuePerShareAtThatGrowth": value_at(mid), "targetPrice": target,
            "note": "did not fully converge within max_iter/tol"}


def run_all():
    base_inp = load_inputs()
    return {
        "discountRate": sweep_discount_rate(base_inp),
        "revenueGrowth": sweep_revenue_growth(base_inp),
        "operatingMargin": sweep_operating_margin(base_inp),
        "reinvestmentViaTerminalRoic": sweep_reinvestment(base_inp),
        "impliedGrowthAtObservedPrice_contextOnly": implied_growth_at_observed_price(base_inp),
    }


if __name__ == "__main__":
    print(json.dumps(run_all(), indent=2))
