import json, sys, os
runs = sys.argv[1]
MAP = [("revenue", "current-revenue"), ("operatingIncome", "operating-income"), ("totalDebt", "total-debt"), ("cashAndEquivalents", "cash-balance")]
out = ["| Co. | Fact | Golden (AR2, period end · accession) | Report (run) | Match |", "|---|---|---|---|---|"]
for t in ["msft", "cost", "nvda", "nue", "ko", "lly", "oklo", "jpm"]:
    g = json.load(open(f"/home/user/Cal-Finance/lib/analyzer/golden/{t}.json"))
    p = os.path.join(runs, f"{t}-report.json")
    rep = json.load(open(p)) if os.path.exists(p) else {}
    facts = {f["id"]: f for f in (rep.get("result") or {}).get("facts", [])}
    for gk, rk in MAP:
        gf = g["facts"].get(gk)
        gv = None if gf is None else gf.get("value")
        gdesc = "null — " + str(g["facts"].get(gk + "Note", ""))[:80] if gf is None else f"{gv:,} ({gf['periodEnd']} · {gf['accessionNumber']})" if gv is not None else f"null ({gf.get('note','')[:60]})"
        rf = facts.get(rk)
        rv = rf.get("value") if rf else None
        rdesc = "—" if rf is None else (f"{float(rv):,.0f} ({rf['source'].split(' · ')[0]})" if rv not in (None, "") else f"not acquired ({rf.get('source','')[:40]})")
        if gv is None or rv in (None, ""):
            m = "n/a"
        else:
            import re
            rd = re.search(r"(\d{4}-\d{2}-\d{2})", rf.get("source", ""))
            same = rd is not None and rd.group(1) == gf["periodEnd"]
            if abs(float(rv) - float(gv)) < 0.5:
                m = "exact"
            elif not same:
                m = f"period differs (report {rd.group(1) if rd else '?'} vs golden {gf['periodEnd']}) — re-check against SEC at the report's period"
            else:
                m = f"**DIFF {float(rv)-float(gv):+,.0f}**"
        out.append(f"| {t.upper()} | {gk} | {gdesc} | {rdesc} | {m} |")
print("\n".join(out))
