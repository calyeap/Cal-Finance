### NVDA — FAIL (complete, or explained in plain English)
Run `2d543969-b6d2-4c96-86d4-bc580d586e72`

| # | Section | Status | What the reader sees / why |
|---|---|---|---|
| 1 | Company, current price and as-of date | CONTENT | NVIDIA CORP · $217.09 as of 2026-10-19 |
| 2 | 30-second view / bottom line | MISSING | "What matters most" is missing — the AI layer did not complete (NOT CONFIGURED: No model credentials are configured, so the interpretation and challenger calls did not run. Every computed value on this page is unaffected.) / Bottom line: No valuation verdict for this company yet — its enterprise value needs a decision on which of its investments are non-operating, which is not available yet, and the valuation depends on it. [engine: no price-vs-range position for this run] |
| 3 | What the company does | CONTENT | NVIDIA Corporation operates as a data center scale AI infrastructure company in the United States, Taiwan, China, Hong Kong, Europe, and internationally. It op… [source: YAHOO company summary; 10-K Item 1 not used because: The Item 1 extraction rule (item1-2026-10-1) could not locate the section in the filing: found 2 standalone "Item 1. Business" heading lines — expected exactly one.] |
| 4 | Key financial metrics | EXPLAINED | Market cap: Not computed for this company yet — it needs a decision on which of its investments are non-operating, which is not available for this company. [engine: INCOMPLETE: missing REQUIRED input(s): nonOperatingEquityInvestmentsAtBook] / P/E (trailing) 27.445 / FCF yield 0.0184783 / 52-week range 165.17–239.24 / Leverage: Not computed for this company yet — the balance-sheet inputs needed to measure its debt load are not all available, and the valuation depends on that measure. [engine: LEVERAGE UNSUPPORTED IN v1, net debt ratio not computed] |
| 5 | Bear / Base / Bull and price context | EXPLAINED | Fair-value range: No fair-value range for this company yet — its enterprise value needs a decision on which of its investments are non-operating, which is not available yet, and the valuation depends on it. [engine: LEVERAGE UNSUPPORTED IN v1: inputs missing — the ratio could not be computed, so the precondition fails closed — enterprise value: missing REQUIRED input(s): nonOperatingEquityInvestmentsAtBook] |
| 6 | Why own it | MISSING | missing — the AI layer did not complete (NOT CONFIGURED: No model credentials are configured, so the interpretation and challenger calls did not run. Every computed value on this page is unaffected.) |
| 7 | Why be cautious / biggest risks | MISSING | missing "Why be cautious" and "Biggest risk" — the AI layer did not complete (NOT CONFIGURED: No model credentials are configured, so the interpretation and challenger calls did not run. Every computed value on this page is unaffected.) |
| 8 | What today's price assumes | EXPLAINED | Steady-state EV: Not computed for this company yet — the balance-sheet inputs needed to measure its debt load are not all available, and the valuation depends on that measure. [engine: LEVERAGE UNSUPPORTED IN v1: leverage precondition failed (§6.5)] / PVGO share of EV: Not computed for this company yet — the balance-sheet inputs needed to measure its debt load are not all available, and the valuation depends on that measure. [engine: LEVERAGE UNSUPPORTED IN v1: leverage precondition failed (§6.5)] / Implied growth, yrs 1-5 at r = 11.0%: Not computed for this company yet — it needs the company's enterprise value, which is not available for this company. [engine: INCOMPLETE: missing REQUIRED input(s): targetEnterpriseValue] |
| 9 | Latest material development | CONTENT | 8-K filed 2026-09-03 |
| 10 | What would change the view | CONTENT | largest driver ronic, full-range impact 51.9% |

**Failures (with causes):**
- #2 30-second view / bottom line: "What matters most" is missing — the AI layer did not complete (NOT CONFIGURED: No model credentials are configured, so the interpretation and challenger calls did not run. Every computed value on this page is unaffected.) | Bottom line: No valuation verdict for this company yet — its enterprise value needs a decision on which of its investments are non-operating, which is not available yet, and the valuation depends on it. [engine: no price-vs-range position for this run]
- #6 Why own it: missing — the AI layer did not complete (NOT CONFIGURED: No model credentials are configured, so the interpretation and challenger calls did not run. Every computed value on this page is unaffected.)
- #7 Why be cautious / biggest risks: missing "Why be cautious" and "Biggest risk" — the AI layer did not complete (NOT CONFIGURED: No model credentials are configured, so the interpretation and challenger calls did not run. Every computed value on this page is unaffected.)

## Stage timings
- acquisition + automatic decisions (advanceRunAutomatically): 2577ms
- deterministic computation: 480ms
- AI layer (interpretation + challenger): 0ms
- render the normal Overview: 17ms
- **total measured:** 3074ms

### AI model calls
_No model call ran — no credentials configured, or this run's AI outputs were already stored._
