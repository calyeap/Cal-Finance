# Nucor FY2025 finance-lease classification — scoped issuer-source capture

**Purpose:** durable, reviewable *evidence input* for open PR #469 / outcome `CF-AR6-BRIDGE-INPUT-RECOVERY-01`, under issue #468 DO 3. **Not code acceptance, a finance-methodology ruling, an independently authenticated original filing download, or a proxy for a fresh HEAVY REVIEW.**

## Provenance and retrieval limitations

- Issuer: **Nucor Corporation**, CIK **0000073309**.
- Filing: **FY2025 Form 10-K**, period ended **2025-12-31**, accession **0001193125-26-071575**.
- Primary SEC filing: https://www.sec.gov/Archives/edgar/data/73309/000119312526071575/nue-20251231.htm
- Primary SEC SEC/XBRL rendered disclosure pages, same accession: [Note 6 lease table](https://www.sec.gov/Archives/edgar/data/73309/000119312526071575/R19.htm); [lease detail and extensible-enumeration disclosure](https://www.sec.gov/Archives/edgar/data/73309/000119312526071575/R58.htm); [balance sheet](https://www.sec.gov/Archives/edgar/data/73309/000119312526071575/R2.htm).
- Latest captured 2026-07-04 issuer quarterly filing: https://www.sec.gov/Archives/edgar/data/73309/000119312526345891/nue-20260704.htm , accession **0001193125-26-345891**. This quarter retains explicitly lease-inclusive current/non-current debt-line captions, but **the FY2025 $24M / $234M values are not claimed to be 2026-07-04 balances**.
- Independent issuer-hosted balance-sheet corroboration: https://investors.nucor.com/news/news-details/2026/Nucor-Reports-Results-for-the-Fourth-Quarter-of-2025/
- Secondary independent text transcription/corroboration (not the canonical issuer source): https://fintel.io/doc/sec-nucor-corporation-73309-10k-2026-february-25-20509-7289

**How captured:** A separate AI research route retrieved *indexed snippets from the primary SEC EDGAR pages* (R19, R58 and R2) and issuer-hosted reporting, outside the restricted BUILD session. The restricted Claude Code BUILD environment had **CONNECT 403** for the issuer 10-K HTML, SEC note view and issuer PDF. This file is a human-readable **transcription of indexed primary-filing evidence**, not a byte-for-byte copy of the downloaded SEC HTML, not a cryptographic archive, and not evidence that the BUILD worker itself fetched the originals. Reviewers must make an explicit source-authenticity and task-standard judgement; if insufficient, fail closed rather than assuming the citation proves more than it does.

## Direct issuer disclosure — balance-sheet liability classification

SEC FY2025 Note 6 supplemental balance-sheet table, **USD millions**:

| Liability row in issuer note | Issuer-disclosed balance-sheet caption | FY2025 | FY2024 |
| --- | --- | ---: | ---: |
| **Current finance** | **“Current portion of long-term debt and finance lease obligations”** | **24** | 17 |
| **Non-current finance** | **“Long-term debt and finance lease obligations due after one year”** | **234** | 174 |

- **Calculation:** FY2025 finance lease liability **24 + 234 = 258 million**, equals the Note 6 finance-lease present-value liability of **258 million** and corroborated companyfacts `FinanceLeaseLiabilityCurrent`, `FinanceLeaseLiabilityNoncurrent` and `FinanceLeaseLiability` for this exact filing.
- **Balance-sheet identity at 2025-12-31:** current combined long-term debt-and-lease caption is **90 million**; non-current combined debt-and-lease caption is **6,909 million**; short-term debt is **122 million**. Total combined obligations plus short-term = **7,121 million**, matching the AR2 golden total-debt composition for FY2025. These are **inclusive balance-sheet captions**, *not* a separate debt-only 2025 measurement.
- **Positive classification evidence:** The issuer explicitly names finance leases as components of *both* the current and non-current debt-and-lease balance-sheet lines. This is stronger than inferring nesting from a tag name or from 66+24=90 alone; the non-current classification is directly disclosed in Note 6, and SEC R58 also exposes an extensible-enumeration fact naming that placement.
- **Operating leases are separate:** current operating in accrued expenses; non-current operating in deferred credits/other liabilities. Do not mix them into the finance-lease 258 million.

## What this evidence does NOT settle

1. It is dated **FY2025**. The newer **2026-07-04** issuer 10-Q uses debt-and-lease labels, but REVIEW must verify that existing #468 cited-disclosure mechanism permits a FY2025 Note 6 source to support the current candidate; it cannot assume lease amounts or any other input migrate across dates. Keep #308/#309's same-date inputs unchanged.
2. A `FINANCE_LEASES_INSIDE_TOTAL_DEBT` record is a **code implementation of an existing approved counted-once mechanism**, not a new valuation formula. Reviewer must check the record format (existing LLY example), exact CIK and source text, and the correct company/period scope.
3. REVIEW independently identified a separate NUE **invested-capital / RONIC history** double count in `investedCapitalAt`. Evidence alone does not fix it. Correct on this same PR only if #468's existing authority, including #298 counted-once, allows the smallest adjustment; otherwise STOP for Product reconciliation without changing methodology silently.
4. KO and NVDA may remain INCOMPLETE under #468 / Calvin's Option B; don't infer absent leases are zero or relax AR6's six-company spread acceptance.

## Product/independent-REVIEW gate

- Treat this captured excerpt and source links as **supplied third-party research evidence**, not self-authenticating proof. Independent REVIEW must challenge issuer identity, accession, correct note/current vs non-current placement, units and period scope. Compare with live `data.sec.gov` where available.
- If the evidence meets the already approved source standard without requiring live network egress from *each* cloud session, BUILD may apply the existing cited-disclosure mechanism and test the counted-once correction. If the source standard actually requires direct live original-file authentication by the actor, record that precise Product-owned limitation as `BLOCKED: AI — SOURCE_UNAVAILABLE` and do not escalate ordinary public filing retrieval to Calvin.
- One outcome, same PR #469, independent HEAVY REVIEW, green deterministic financial tests, no unapproved product/model/egress/spend changes. Do not merge merely because this evidence file exists.
