# Analyzer Reset — acceptance and freeze record (AR8)

**Outcome:** `CF-AR8-ACCEPTANCE-FREEZE-01` (issue #458), the last step of the Analyzer Reset (AR0–AR8).

**Frozen state:** `origin/master` = `03176d1da8cebb4ed725e46f2598329bfba990b9`. That is the merge of PR #505 (`CF-AR8-CORRECTIONS-01`) on top of PR #502 (`CF-AR8-REAL-APP-ACCEPTANCE-01`, `f60e52d`), on Cal Finance Methodology v3.

**Authority:** Calvin's answers on #458, given through the native question in session `session_016KcubNdoe2gNe14Lf6VnAG` and relayed verbatim there:
1. 20 Oct 2026, about 7:45pm SGT, on the AR8 evidence: **"1 — Not yet: fix first"** ([comment 6289984585](https://github.com/calyeap/Cal-Finance/issues/458#issuecomment-6289984585)). This routed the bounded correction #504.
2. 20 Oct 2026, about 7:55pm SGT, on #504: **"1 — Yes, use identity"** for KO's D7 bound ([comment 6290059489](https://github.com/calyeap/Cal-Finance/issues/504#issuecomment-6290059489)).
3. 20 Oct 2026, about 8:10pm SGT, on the re-presentation: **"1 — Accept"** ([comment 6290477557](https://github.com/calyeap/Cal-Finance/issues/458#issuecomment-6290477557)).

This record replaces the superseded Analyzer V2 freeze (`docs/analyzer-v2-final-acceptance-freeze.md`, product-decisions item 25). That file stays as history. The decision itself is product-decisions item 32.

## What is accepted

The Analyzer as it stands at `03176d1`, run as the real app (ticker → report) on Methodology v3, with these results for the eight golden companies (product-decisions item 31):

| Co. | State at acceptance | Evidence |
|---|---|---|
| MSFT | Valued: Bear / Base / Bull $184 / $334 / $449 at the 19 Oct close $533.52; draft points to SELL; final verdict waits for adoption | `docs/evidence/ar8-acceptance/` |
| COST, NVDA, NUE, LLY | The report completes; valuation waits on Calvin's one-time §4.4 non-operating-investments answer, which the bottom line names. Once given, every draft points to SELL (what-if with "none") | `…/corrections/README.md` |
| KO | The report completes; valuation waits on the §4.4 answer, as for the four above. With "none" (what-if), D7's conservative lease bound (total liabilities by identity, Calvin's #504 ruling) puts net debt at 12.5% of EV, above the 10% domain, so KO reads "can't bound value" | `…/corrections/README.md` |
| OKLO | "Can't conclude": no filed revenue | `…/runs/oklo-overview.txt` |
| JPM | Refused: banks are not valued | `…/runs/jpm-overview.txt` |

The checks recorded in #457 DO 3:
- **Time to report:** 2–4 s deterministic; 55–185 s with AI prose.
- **Golden-facts figure review by an independent reviewer:** 153 SEC facts, all exact or footing.
- **Comparisons:** the AI-only baseline and an outside reference, both humility checks only.
- **OKLO and JPM:** as shown above.

**Spend:** $3.96 recorded, at most $4.40, against the $5 cap.

## Known limitations accepted with it

- **§4.4 is per company and Calvin's.** A company without a recorded non-operating-investments answer shows an INCOMPLETE valuation with that cause named (frozen spec §4.4, M9-1).
- **KO is not valued under the current D7 bound and 10% gate** (shown with §4.4 "none" as a what-if). Revisiting either is a methodology question, not a defect.
- **Open follow-ups from the AR8 evidence:**
  - F5: a bank is drafted, at cost, before Gate 0 refuses it.
  - F6: the RM-brief evaluator predates adopt-to-finalize; this needs a reviewed evaluator change.
  - F7: the traceability guard refused OKLO's AI prose.
- **Not recorded:** the per-company "do I understand why?" times (#458 DO 1) were not supplied with Calvin's acceptance. This record states that instead of inventing them.

## Not changed by this record

No code, threshold, rule or verdict logic. This is a status change against `03176d1`, and every figure above points into the evidence files rather than re-deriving anything.
