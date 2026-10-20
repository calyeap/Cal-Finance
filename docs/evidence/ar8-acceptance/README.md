# AR8 — real-app acceptance, eight golden companies (CF-AR8-REAL-APP-ACCEPTANCE-01, #457)

Run 20 Oct 2026 (18:14–18:40 SGT) in a Claude Code cloud session on Methodology v3 (PR #501, `f6d8d76`), prices at the 19 Oct close.
Calvin's acceptance and the freeze record are on #458, not here.

## Bottom line

- **Speed.** The deterministic report is ready in 2–4 s for every company. The Quick Read with AI prose takes 55–185 s.
- **Only MSFT is valued in a fresh database.** Each other company needs one §4.4 answer from Calvin: which of its investments are non-operating. MSFT already has his answer, recorded on #188. Until then the report says INCOMPLETE and gives the reason, as designed (frozen spec §4.4, M9-1).
- **Values with "none" as the answer** (a WHAT-IF, not Calvin's answer): COST, NVDA, NUE and LLY reproduce #499's v3 values to the dollar. Every draft points to SELL.
- **KO cannot be valued under the current rules.** The D7 lease bound cannot be formed for it (finding F3).
- **OKLO** says "can't conclude" ✔. **JPM** is refused as a bank ✔.
- **One defect found and fixed here.** LLY's stale dilution tag, RED → GREEN (F2).
- **Spend: $3.96 recorded, at most $4.40 worst case,** against the $5 cap.

## Per company

Price is the 19 Oct close. "Draft zone" is where the unadopted draft points. The final verdict waits for Calvin's adoption (product decision 30).

| Co. | Rate | Real app (normal path) | Bear / Base / Bull | Price ÷ Base (8.5–9.5% or 10.5–11.5%) | Draft zone | Report / Quick Read |
|---|---|---|---|---|---|---|
| MSFT | 9.0% stable | **Valued** | $184 / $334 / $449 | 1.47–1.73× | SELL | 4.2 s / 97 s |
| COST | 9.0% stable | INCOMPLETE: needs §4.4 | what-if $252 / $394 / $535 | 2.37–2.69× | SELL | 2.7 s / 78 s |
| NVDA | 11.0% cyclical | INCOMPLETE: needs §4.4 | what-if $34 / $132 / $297 | 1.54–1.75× | SELL | 3.2 s / 55 s |
| NUE | 11.0% cyclical | INCOMPLETE: needs §4.4 | what-if $49 / $102 / $182 | 2.40–2.72× | SELL | 2.9 s / 109 s |
| KO | 9.0% stable | INCOMPLETE: §4.4 and finance leases (F3) | not valued, even with "none" | — | CANNOT BOUND VALUE | 3.2 s / 185 s |
| LLY | 9.0% stable | INCOMPLETE: needs §4.4 | what-if, after the F2 fix: $138 / $373 / $637 | 2.96–3.73× | SELL | 3.1 s (re-run) / 111 s |
| OKLO | 11.0% pre-revenue | **Can't conclude** ✔ | — | — | — | 1.8 s / 137 s |
| JPM | — | **Refused, bank** ✔ | — | — | — | 3.6 s / 124 s |

### Comparisons (humility checks only, never inputs)

| Co. | Analyzer Base | AI-only baseline (fixed prompt, fresh agent, no repo) | Outside: analyst consensus target (Yahoo, n) |
|---|---|---|---|
| MSFT | $334 | $396–$416, HOLD (master plan App. B, 4 Sep cut-off, its own conventions) | $599 (53), strong buy |
| COST | what-if $394 | $409, SELL (App. B, 16 Oct cut-off) | $1,066 (36), buy |
| NVDA | what-if $132 | $115 at 11%, SELL (1.89×) | $329 (59), strong buy |
| NUE | what-if $102 | $113 at 11%, SELL (2.31×) | $285 (16), buy |
| KO | not valued | $41 at 9%, SELL (2.29×) | $95 (23), buy |
| LLY | what-if $373 | $687 at 9%, SELL (1.81×) | $1,328 (30), buy |
| OKLO | can't conclude | can't conclude; cash $16.14 per share at 30 Jun | $75 (20), buy |
| JPM | refused | not run (no DCF for a bank) | $373 (23), buy |

- **The AI-only baselines agree on the verdict zone** wherever both value: SELL. LLY's Base differs most, $373 vs $687. The draft takes the operating margin from the TTM 42.2% down to 27.0% by year 5 (#499), while the baseline holds 43–44% and fades to 38% only by year 10.
- **The consensus targets sit far above both.** The 9%/11% market-anchored rate (D1) is the main reason. It is a deliberate policy, not an error.

## The contract's checks, per company

| Check (#457 DO 3) | Result |
|---|---|
| Time to Quick Read | Recorded above for all eight (`runs/<t>-acceptance.md`, "Stage timings"). |
| Every figure vs golden facts | `golden-facts-check.md`: 16 exact; 10 differ only in period (the bridge uses the latest 10-Q, the AR2 golden facts are 10-K); 0 same-period differences. NVDA's period rows were re-checked against data.sec.gov (debt $33,366m and cash $22,443m at 26 Jul 2026, both exact). **The independent reviewer re-checks the rest.** |
| AI-only side-by-side, one outside reference | Table above. Baselines are in `ai-only/`; the outside reference is `outside-reference-yahoo.json`. |
| OKLO says "can't conclude" | ✔ Overview: "the valuation cannot be concluded from filed history" (`runs/oklo-overview.txt`). |
| The bank is refused | ✔ Gate 0: "UNSUPPORTED PROFILE — ASSET-BASED ROW NOT VALIDATED IN v1"; Overview: "this version of the model does not value asset-based businesses such as banks and insurers". |
| MSFT "newer filing" then refresh | Not applicable. This run is 20 Oct; MSFT reports Q1 FY27 on 28 Oct. |

## Findings

| # | Finding | Effect | Route |
|---|---|---|---|
| F1 | NVDA has tagged its current marketable securities as `DebtSecuritiesCurrent` ($34.1bn at 26 Jul 2026) since FY27. The bridge's cash leaves them out. | About +$1.40/share, roughly 1% of Base. The zone does not change. | Build defect, follow-up (tag drift) |
| F2 | LLY: live SEC carries `IncrementalCommonShares…` only for FY2008–FY2011. The run took the FY2011 value (6.86m) as today's dilution; it was NOT CONFIRMED, so EV went INCOMPLETE. The committed capture had trimmed the tag, so #499 never saw this. | LLY could not be valued live. | **Fixed in this PR:** a tag older than the latest 10-K's share period counts as absent, so the D8 fallback applies. RED → GREEN in `lib/analyzer/acquisition/staleDilutionTag.test.ts`. |
| F3 | KO files no finance-lease tag and no `Liabilities` tag, so D7's same-date upper bound cannot be formed and the bridge stays INCOMPLETE (D7: "where no same-date bound can be formed"). Its debt tag `LongTermDebtAndCapitalLeaseObligations` suggests leases sit inside debt, but nesting needs a cited disclosure (#311/#312). | KO cannot be valued. | Follow-up: retrieve the cited KO 10-K disclosure (AI-owned). If none exists, it is a methodology question. |
| F4 | §4.4 non-operating investments needs a human answer, by design. However, the Overview's bottom line then reads "the balance-sheet inputs needed to measure its debt load are not all available", which names the wrong cause. The metrics line names it correctly. | Misleading copy for 5 of 8 companies. | Copy defect, follow-up |
| F5 | JPM: three paid price-blind drafts plus the AI layer ran before Gate 0 refused the bank. | About $0.81 per first view of a bank | Cost follow-up |
| F6 | The RM-brief evaluator (`briefAcceptance.ts`, 7 Oct) fails MSFT's FULL_BRIEF on the PENDING ADOPTION bottom line. It predates adopt-to-finalize; the rendered text is plain English. | Evaluator FAIL, not a product defect | Not loosened (protected evaluator); listed for a reviewed evaluator change |
| F7 | OKLO's AI prose was refused twice by the product's traceability guard ("SPELLED-OUT QUANTITY"). | No AI prose for OKLO. The deterministic "can't conclude" still shows. | Guard working; prompt follow-up only if it recurs |
| F8 | A transient SEC submissions timeout (32 s) degraded LLY's paid run: no classification, so no profile. | The run was honest but not representative. | Re-run deterministically, free: clean (`runs/lly-deterministic-rerun/`) |

## How this was run

- **Where.** Cloud, isolated database `calboard_ar8`, freshly migrated. Calvin's database was never touched. Data came from live SEC companyfacts and submissions plus Yahoo prices.
- **Path.** The product's own path for each company: `npx tsx scripts/analyzer/acceptance-run.ts <T>`, which runs `createRun → advanceRunAutomatically → analysisForReport → overviewTabText`. No human fact, profile or judgement decision was recorded.
- **Sheets.** The six valued companies use the price-blind drafts already frozen on 19 Oct (#495; MSFT's from the AR7 prototype run), seeded as their sheets in force (`seeded-sheets.txt`). This is the app's re-run path, and it kept spend inside the cap. OKLO and JPM took the new-ticker path live: OKLO's drafter returned CANNOT CONCLUDE without a model call, and JPM drafted three times.
- **Spend.** `count_tokens` preflight first (`preflight-count-tokens.json`: 19 calls, 139,433 input tokens). Paid runs went through a metered cap at $5, lowered to $4.56 after one interrupted call (`runs/spend.json`): 24 calls, 187,525 input + 121,037 output tokens, **$3.96** at claude-opus-5 list price ($5 / $25 per M). One LLY call was cut off by a session time limit and may have been billed without being recorded; its worst case is $0.44, so the total is at most **$4.40**.
- **WHAT-IF.** `what-if/what-if-none.ts` is free: no model call, a throwaway run, and "None of these are non-operating". It shows what Calvin's §4.4 answer would unlock. **It is not his answer and is not recorded anywhere he would see it.**
- **Not used.** The manual live-proof workflow (`analyzer-live-proof.yml`) was left unchanged and not dispatched: it spends a different key, outside this run's cap.

## Files

`runs/` holds per-ticker acceptance, overview, report and console files plus `spend.json`. `runs/lly-console-killed-attempt.txt` is the interrupted call. `ai-only/` holds the baselines and their models. `what-if/` holds the deterministic WHAT-IFs. Also: `golden-facts-check.md` with its script `golden_check.py`, `outside-reference-yahoo.json`, `preflight-count-tokens.json`, `seeded-sheets.txt` and `red-base-acceptance-run.txt` (the tooling RED).
