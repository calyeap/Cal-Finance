# Extract the supplementary annual + TTM facts calibration #2 needs from full SEC companyfacts.
# Untrusted input: parsed as data only. Writes one JSON per company.
import json, sys
from datetime import date
raw, out, fetched = sys.argv[1], sys.argv[2], sys.argv[3]
CIK = {"MSFT":"0000789019","COST":"0000909832","NVDA":"0001045810","NUE":"0000073309","LLY":"0000059478"}
DUR = {"tax":["IncomeTaxExpenseBenefit"],
       "pretax":["IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest"],
       "nonoperating":["NonoperatingIncomeExpense"],
       "interestExpense":["InterestExpense","InterestExpenseNonoperating"],
       "interestIncome":["InvestmentIncomeInterest"],
       "equityMethodIncome":["IncomeLossFromEquityMethodInvestments"],
       "acqBusinesses":["PaymentsToAcquireBusinessesNetOfCashAcquired"],
       "acqBusinessTwo":["PaymentsToAcquireBusinessTwoNetOfCashAcquired"],
       "acqOther":["OtherPaymentsToAcquireBusinesses"],
       "goodwillAcquired":["GoodwillAcquiredDuringPeriod"],
       "intangiblesAcquired":["FinitelivedIntangibleAssetsAcquired1"],
       "capex":["PaymentsToAcquirePropertyPlantAndEquipment","PaymentsToAcquireProductiveAssets","PaymentsToAcquireOtherPropertyPlantAndEquipment"]}
INST = {"assetsCurrent":["AssetsCurrent"],"liabilitiesCurrent":["LiabilitiesCurrent"],
        "cash":["CashAndCashEquivalentsAtCarryingValue"],"shortTermInvestments":["ShortTermInvestments","MarketableSecuritiesCurrent"],
        "debtCurrent":["DebtCurrent"],"longTermDebtCurrent":["LongTermDebtCurrent","LongTermDebtAndCapitalLeaseObligationsCurrent"],
        "shortTermBorrowings":["ShortTermBorrowings"],"commercialPaper":["CommercialPaper"],
        "longTermDebtNoncurrent":["LongTermDebtNoncurrent"]}
def rows(g, tag):
    return sorted(g.get(tag, {}).get("units", {}).get("USD", []), key=lambda r: r["filed"])
def days(r): return (date.fromisoformat(r["end"]) - date.fromisoformat(r["start"])).days
for t, cik in CIK.items():
    g = json.load(open(f"{raw}/{t}.json"))["facts"]["us-gaap"]
    res = {"ticker": t, "source": f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json", "fetchedAt": fetched,
           "note": "Supplementary facts for CF-METHODOLOGY-V3-DRIVERS-01 (#496), extracted verbatim from SEC XBRL company facts (latest-filed value per period). Not part of the frozen 19 Oct capture.",
           "annual": {}, "instant": {}, "ttm": {}}
    for key, tags in DUR.items():
        best = None
        for tag in tags:  # the candidate whose latest annual period is newest
            fy = {}
            for r in rows(g, tag):
                if r.get("form") == "10-K" and r.get("start") and 350 <= days(r) <= 380:
                    fy[r["end"]] = {"val": r["val"], "accn": r["accn"], "tag": tag}
            if fy and (best is None or max(fy) > max(best)): best = fy
        if best: res["annual"][key] = dict(sorted(best.items())[-7:])
    for key, tags in INST.items():
        best = None
        for tag in tags:
            fy = {}
            for r in rows(g, tag):
                if r.get("form") == "10-K" and r.get("fp") == "FY":
                    fy[r["end"]] = {"val": r["val"], "accn": r["accn"], "tag": tag}
            if fy and (best is None or max(fy) > max(best)): best = fy
        if best: res["instant"][key] = dict(sorted(best.items())[-8:])
    # Every cash-flow working-capital line (us-gaap IncreaseDecreaseIn*), annual 10-K values.
    res["workingCapitalCashFlow"] = {}
    for tag in sorted(k for k in g if k.startswith("IncreaseDecreaseIn")):
        fy = {}
        for r in rows(g, tag):
            if r.get("form") == "10-K" and r.get("start") and 350 <= days(r) <= 380:
                fy[r["end"]] = {"val": r["val"], "accn": r["accn"]}
        if fy and max(fy) >= "2022": res["workingCapitalCashFlow"][tag] = dict(sorted(fy.items())[-7:])
    # TTM = latest FY + latest YTD − prior-year YTD of the same length (10-Q rows), where a 10-Q is later than the FY.
    for key in ["pretax", "nonoperating", "interestExpense", "interestIncome", "equityMethodIncome", "tax"]:
        if key not in res["annual"]: continue
        tag = next(iter(res["annual"][key].values()))["tag"]
        fyEnd = max(res["annual"][key]); fyVal = res["annual"][key][fyEnd]["val"]
        # 10-Q year-to-date rows that start the day after the latest fiscal year ends.
        q = [r for r in rows(g, tag) if r.get("form") == "10-Q" and r.get("start") and r["end"] > fyEnd and abs((date.fromisoformat(r["start"]) - date.fromisoformat(fyEnd)).days) <= 7]
        if not q:
            res["ttm"][key] = {"end": fyEnd, "val": fyVal, "basis": "latest fiscal year (no later 10-Q)"}; continue
        ytd = max(q, key=lambda r: (r["end"], days(r)))
        L = days(ytd)
        prior = [r for r in rows(g, tag) if r.get("start") and abs(days(r) - L) <= 7 and abs((date.fromisoformat(ytd["end"]) - date.fromisoformat(r["end"])).days - 365) <= 10]
        if not prior:
            res["ttm"][key] = None; continue
        p = prior[-1]
        res["ttm"][key] = {"end": ytd["end"], "val": fyVal + ytd["val"] - p["val"], "basis": f"FY ending {fyEnd} + YTD to {ytd['end']} ({ytd['accn']}) − YTD to {p['end']} ({p['accn']})"}
    json.dump(res, open(f"{out}/{t.lower()}-supplementary-facts.json", "w"), indent=1)
    print(t, {k: list(v)[-1] for k, v in res["annual"].items()}, {k: (v or {}).get("end") for k, v in res["ttm"].items()})
