# The §3.5 EV bridge's cross-entry period coherence — reconciliation

`CF-EV-BRIDGE-PERIOD-COHERENCE-IMPL-01` (issue #309), implementing
**CALVIN RULING — A, REQUIRE SAME-DATE EV BRIDGE INPUTS**, 25 Sep 2026
03:46:48Z ([#308 comment 5826340062](https://github.com/calyeap/Cal-Finance/issues/308#issuecomment-5826340062)),
quoted here in full:

> For the §3.5 EV bridge, require `total-debt`, `finance-lease-liabilities`, and
> `cash-and-marketable-debt-securities` to resolve to the same as-of date.
>
> If the resolved dates disagree, return `INCOMPLETE` with a stated cause naming
> the mismatched dates.
>
> Use zero tolerance. Do not invent a date window or substitute older/newer
> values merely to force alignment.
>
> This ruling applies only to those three instant balance-sheet bridge inputs.
> It does not alter the existing timing rules for shares outstanding, price,
> treasury-method dilution, or §4.4 judgments.
>
> Proceed with the bounded outcome under this ruling and keep the existing hard
> bounds in force.

**This is Calvin's ruling, not a determination from spec text.** Issue #308's
own reconciliation ([comment 5823118066](https://github.com/calyeap/Cal-Finance/issues/308#issuecomment-5823118066))
found the cross-entry same-period question genuinely **not determined** by
`docs/technical-specs.md`'s frozen §7.2 M1 / §4.3 and returned exactly one
closed `CALVIN REQUIRED:` naming options A and B. Calvin ruled A. This
document implements that ruling; it does not re-derive it from authority, and
it re-litigates nothing (`CALVIN REQUIRED` on this outcome is `None`, per the
issue).

**This document reconciles, corrects and reports. It rules nothing.** It
answers no §11 item, marks no acceptance-matrix row, and produces no verdict.

**Result, stated up front.** Ruling A is implemented for exactly the three
named inputs, zero tolerance, no new constant. Re-probed at head (`9ce3de6`),
the correction is **latent-only** for every company this repo can run today:
MSFT and OKLO already resolve all three inputs to the same as-of date; NVDA's
`finance-lease-liabilities` does not resolve at all (`NO_TAG_IN_FILINGS`), so
the pre-existing missing-REQUIRED-input `INCOMPLETE` governs there and there
is no date to compare. No company's `gates.leverage`, `fairValueRange`,
`trust.status` or verdict status moves — the SCOPE 5 tripwire is not tripped
for any of the three captures this repo holds.

## 1. SCOPE 1 — dates re-probed at head, per company

Re-verified independently by direct probe against the committed captures
(`resolveEntry` over `TAG_MAP`, at `9ce3de6` — the same commit #308 itself was
read at), rather than trusted from #308's own record:

| Ticker | `total-debt` | `finance-lease-liabilities` | `cash-and-marketable-debt-securities` | Coherent? |
|---|---|---|---|---|
| MSFT | @2026-06-30 | @2026-06-30 | @2026-06-30 | Yes — all three agree |
| OKLO | @2026-06-30 | @2026-06-30 | @2026-06-30 | Yes — all three agree |
| NVDA | @2026-07-26 | `NO_TAG_IN_FILINGS` (does not resolve) | @2026-07-26 | N/A — no mismatch to report; the absent input's own `INCOMPLETE` governs (SCOPE 2) |

These match #308's own probe exactly. **Not latent for any company today**:
none of MSFT, OKLO or NVDA presents an actual date mismatch across the three
named inputs — the correction is latent-only, confirmed rather than assumed.

## 2. SCOPE 2 — implementing ruling A

`computeEnterpriseValue` (`lib/analyzer/modules/enterpriseValue.ts`) now
performs two checks, in order:

1. **Existing, unchanged**: any of the seven REQUIRED inputs is `null` →
   `INCOMPLETE`, cause `"missing REQUIRED input(s): …"`.
2. **New (ruling A)**: only once all seven are present, the three named
   inputs' as-of dates are compared by exact string equality — the identical
   strictness `acquisition/selectTagged.ts`'s `componentAtSamePeriod` already
   uses within one mapping entry (`row.end !== primary.end`), extended across
   the three entries the ruling names. If they disagree → `INCOMPLETE`, cause
   naming all three fact ids and their resolved dates, e.g.:

   ```
   EV bridge inputs resolve to different as-of dates (CALVIN RULING A, issue
   #308/#309): total-debt=2026-06-30, finance-lease-liabilities=2026-03-31,
   cash-and-marketable-debt-securities=2026-06-30
   ```

Ordering (1) before (2) is what gives NVDA's absent `finance-lease-liabilities`
the missing-input cause rather than a fabricated mismatch — "there is no
mismatch to report against an input that has no value" (issue text, SCOPE 2),
confirmed by a regression test (§7 below).

No new numeric tolerance, window, band or constant: the comparison is a bare
`!==` on the two ISO date strings already carried on each `FactRecord`. No
older/newer value is substituted for another — a mismatch suppresses the
whole bridge, never a partial or mixed-date figure.

## 3. SCOPE 3 — the seam, and why

Two ways to get the mismatched dates into `computeEnterpriseValue`'s own
cause were available, as the issue itself framed:

- **(i) Detect and suppress at the `companyInputs.ts` seam** — build the
  `INCOMPLETE` cause there (where the full `FactRecord`, including
  `asOfDate`, is already in hand via `byId`) and short-circuit before
  `computeEnterpriseValue` runs at all.
- **(ii) Carry `asOfDate` through to the module** — add the three dates as
  additional fields on `EnterpriseValueInput` and let
  `computeEnterpriseValue` do the comparison itself.

**Chosen: (ii).** This module's own header comment states the governing
constraint directly: *"Single definition, applied identically to every
company (§9 mistake 18): no per-company variation, no alternate path."*
Option (i) would mean the same-period decision — REQUIRED-input completeness,
now extended to date coherence — is made in two different places depending on
which rule is firing: the missing-input check stays in
`computeEnterpriseValue`, but the new date-coherence check would live one
layer up, in a file that is not the EV module and does not otherwise decide
what makes this bridge `INCOMPLETE`. That is a second, physically separate
decision point for the same kind of question the module already owns, which
is exactly the drift the module's own comment warns against. Option (ii)
keeps `computeEnterpriseValue` as the single place this bridge decides
whether it can compute, with `companyInputs.ts` doing nothing more than what
it already does for every other REQUIRED input: reading a fact off `byId` and
handing it down.

The added state is exactly what the issue's own SCOPE 3 licenses for (ii):
"internal plumbing for the cause string only." Three fields —
`totalDebtAsOfDate`, `financeLeaseLiabilitiesAsOfDate`,
`cashAndMarketableDebtSecuritiesAsOfDate` — added to `EnterpriseValueInput`,
each `string | null | undefined` and **optional**, so every pre-#309 caller
(`scripts/analyzer/calibrate-position.ts`, every existing unit test's
synthetic `EnterpriseValueInput` literal, `lib/analyzer/fixtures/msft.ts` and
`fixtures/oklo.ts` — none of which supply the new fields) is unaffected: the
same-date test is skipped entirely unless all three dates are actually
supplied. No new rendered state, no new visual treatment, no new public
contract — `AnalysisResult`'s own shape (`EnterpriseValueBridge = Figure<…>`)
is untouched; only the cause string inside an already-existing `INCOMPLETE`
state changes for the one new case.

## 4. SCOPE 4 — nothing removed, nothing new computed

No existing `INCOMPLETE` case changed shape or disappeared: the
missing-REQUIRED-input check runs first, unchanged, and takes precedence
(§2, §7). No new computed figure is produced by this outcome — the new branch
only ever produces a **new INCOMPLETE**, never a value. The seven existing
`computeEnterpriseValue` field-missing tests, and every real-run test that
already asserted an `INCOMPLETE`/computed EV state, pass unmodified (§8).

## 5. SCOPE 5 — per-company delta (tripwire honoured)

**MSFT.** `enterpriseValue.totalDebtAsOfDate`, `.financeLeaseLiabilitiesAsOfDate`
and `.cashAndMarketableDebtSecuritiesAsOfDate` are now populated on the
fixture (all `2026-06-30`, confirmed by direct probe on the real acquired run,
`acquiredRun.test.ts`). Because all three agree, `computeEnterpriseValue`
takes exactly the same path as before this outcome — the acquired-run test
that already computes MSFT's real enterprise value
(`bridge.totalDebt`/`financeLeaseLiabilities`/`cashAndMarketableDebtSecurities`,
`acquiredRun.test.ts:112`) is unmodified and still passes.
`diagnostics.enterpriseValue`, `gates.leverage`, `fairValueRange`,
`trust.status`, the reverse-DCF grid, `states.suppressing` and
`deriveVerdict` are **all unchanged** for MSFT — **tripwire not tripped**.

**OKLO.** Same three dates populated, same coherence (`2026-06-30` ×3,
confirmed by direct probe). OKLO's EV bridge was already, and remains,
`INCOMPLETE` for an unrelated, pre-existing reason —
`treasuryMethodDilution` is not acquired for OKLO in this mapping version —
confirmed by a regression test asserting the cause string is byte-identical
(`"missing REQUIRED input(s): treasuryMethodDilution"`) before and after this
change, even with the §4.4 judgment supplied. The new date-coherence check
never fires for OKLO because the pre-existing missing-input check fires
first. **Tripwire not tripped** — OKLO's `gates.leverage`, `fairValueRange`,
`trust.status` and verdict status are all unchanged, for the same reason
they were already unchanged before this outcome (EV was already `INCOMPLETE`
on the acquired path for every company in this calibration set — see
`docs/ev-double-count-sizing.md` §"What 'today' means").

**NVDA.** `totalDebtAsOfDate` and `cashAndMarketableDebtSecuritiesAsOfDate`
populate (`2026-07-26`); `financeLeaseLiabilitiesAsOfDate` is `null` because
the fact never resolves at all (`NO_TAG_IN_FILINGS`, confirmed:
`nvdaRealRunObservation.test.ts`'s existing cause string,
`"missing REQUIRED input(s): treasuryMethodDilution, price,
financeLeaseLiabilities, nonOperatingEquityInvestmentsAtBook"`, is unchanged
by this diff). The same-date test is skipped in this case by construction
(§2: not all three dates are known), so the cause is exactly what it was
before — never a fabricated mismatch. **Tripwire not tripped.**

**Any fixture or company with a coherent bridge, or with no `asOfDate` wired
through at all.** Unaffected by construction — the same-date test only ever
narrows an already-computing bridge into `INCOMPLETE` when a real mismatch is
present and all three dates are known; every other path is byte-identical to
before.

## 6. SCOPE 3.5 / phase-a-bridge-coherence-blast-radius.md — what this outcome is not

`docs/phase-a-bridge-coherence-blast-radius.md` §5/§7 (read before writing
any code here) argues that **satisfying** a same-date requirement — making
the bridge's three inputs actually agree by re-resolving them against a
shared anchor date — would need a new anchor-date resolution model that
changes which row wins for essentially every balance-sheet fact (its own
measured example: UNP's cash moves 27%), which would bump
`TAG_MAPPING_VERSION` and trigger a §3.8.1 review of every previously
acquired fact.

**Ruling A does not ask for that, and it was not built.** The ruling is a
**refusal** rule: when the three independently resolved dates disagree, the
bridge declines to compute and says so, naming the dates. It explicitly
forbids substituting an older or newer value to force alignment — the
opposite of an anchor-date model, which would *change* which row each entry
resolves to in order to make them agree. `resolveEntry`'s per-entry
latest-eligible-row rule (`selectTagged.ts:216-289`) is untouched by this
diff; no `TAG_MAP` candidate was added, removed or reordered; no
`TAG_MAPPING_VERSION` bump; no §3.8.1 re-review. That doc's stop signal 1
therefore does not fire against this outcome, exactly as AUTHORITY predicted.

## 7. Tests reproducing this outcome in CI

No new parallel harness — reused, per SCOPE item 7:

- `lib/analyzer/modules/enterpriseValue.test.ts` — a new `describe` block,
  unit-level: same-date computes normally; mismatched dates return
  `INCOMPLETE` naming all three fact ids and dates; a one-day difference is
  still a mismatch (zero tolerance); a mismatch never produces a partial
  figure; the test is skipped entirely when no dates, or only some dates,
  are supplied (protects every pre-#309 caller); the missing-REQUIRED-input
  check takes precedence over the date check (the NVDA case, reproduced at
  unit level); the other four REQUIRED inputs' own timing is untouched.
- `lib/analyzer/acquiredRun.test.ts` — the probe-style regression SCOPE 7
  asks for, on the real MSFT capture: one test confirms the real acquired
  dates are coherent today (latent-only, `2026-06-30` ×3) and the bridge
  still computes; one test takes that same real, capture-derived
  `enterpriseValue` object and forces `financeLeaseLiabilitiesAsOfDate` to a
  different date (`2026-03-31`) — the real dollar values are untouched, only
  the plumbed date is perturbed — and asserts the honest `INCOMPLETE` with
  all three fact ids and dates in the cause. A matching same-date regression
  for OKLO asserts the pre-existing `treasuryMethodDilution` cause survives
  byte-identical.
- `lib/analyzer/nvdaRealRunObservation.test.ts` — unmodified; its existing
  assertion on NVDA's exact missing-REQUIRED-input cause string (test (c))
  is the regression proving the new check does not fire when
  `finance-lease-liabilities` never resolved in the first place.

## 8. What was checked, and what was not touched

- `lib/analyzer/verdict.ts`, `lib/analyzer/policy.ts` — byte-unchanged.
- `docs/frozen/` — no byte changed; `FROZEN_HASHES` — no entry changed.
- `lib/analyzer/acquisition/tagMap.ts`, `TAG_MAPPING_VERSION` — unchanged.
- `lib/analyzer/fixtures/msft.ts`, `fixtures/oklo.ts` — byte-unchanged; every
  isolating/forcing test builds a copy of a real, acquired-run
  `enterpriseValue` object with one field overridden, in test code only.
- `resolveEntry`'s per-entry selection rule — unchanged; no `TAG_MAP`
  candidate added/removed/reordered; no acquisition-side re-resolution of
  any kind.
- The other four REQUIRED inputs (`sharesOutstanding`, `price`,
  `treasuryMethodDilution`, `nonOperatingEquityInvestmentsAtBook`) — no
  timing change; the same-date test reaches only the three named inputs.
- No §4.4 judgment made; no §11 item answered; no acceptance-matrix row
  marked; no verdict produced; no `INCOMPLETE` removed by assertion.
- `npx tsc --noEmit` — clean.
- `npm test` — 2074/2075 passing; the one failure is the documented
  CI-exempt Playwright `chrome-headless-shell` baseline
  (`scripts/evidence/selfTest.test.ts`, `.github/workflows/ci.yml`'s named
  environmental exception), unrelated to this change. No other existing
  test's expected value changed.

## Summary

| Item | Determined by | Implemented? | Reachable today? |
|---|---|---|---|
| Same-date requirement, three named inputs | CALVIN RULING A (issue #308, 25 Sep 2026) | Yes — `computeEnterpriseValue`, zero tolerance, no new constant | Latent for MSFT/OKLO (coherent today); N/A for NVDA (absent input governs first) |
| Cause names the mismatched dates | Same ruling | Yes — internal `asOfDate` plumbing (SCOPE 3 option (ii)) | Exercised by regression tests forcing a mismatch on the real MSFT capture |
| Anchor-date resolution model | `docs/phase-a-bridge-coherence-blast-radius.md` §5/§7 | **Not built** — out of scope by the ruling's own text | N/A |

Ruling A is fully implemented for exactly the three named inputs. The
correction is latent-only for every company this repo can currently run;
that is stated plainly, not treated as a reason to have skipped it. No
`INCOMPLETE` is removed. `docs/ev-double-count-sizing.md`'s line 118 is
updated with a one-line pointer to this document.
