import type { ReactNode } from "react";
import Decimal from "decimal.js";
import type { AnalysisResult, Profile, SuppressingState } from "@/lib/analyzer/types";
import { ValuationStrip } from "./ValuationStrip";
import { boundState, isBoundTo, NOT_COMPUTED_BINDING } from "@/lib/analyzer/notComputed";
import { trustStatusLine } from "@/lib/analyzer/trustCopy";
import { plainReason } from "@/lib/analyzer/overviewCopy";

// IA-audit restoration (2026-09-05) — Quick Read's eight items are the
// AUTHORISED INTERIM STATE of §17.16, not its full contract. §17.16
// specifies TEN items: items 1 and 2 (the §10.6 CHEAP/FAIR/EXPENSIVE
// valuation-position token and the §10.6.4 action clause beneath it) are
// blocked on M8-c, whose band thresholds remain PROVISIONAL and unruled,
// and the position renderer is deliberately disabled. Eight is authorised
// until M8-c lands (RULED by Calvin, 14 Sep 2026 — settles CB-AUDIT-01 §7
// conflict B). Always visible, one component (no "Learn more" drawer —
// §17.12: "QUICK READ / the finding block, always visible"). A state or
// flag that qualifies or suppresses an output travels with the item it
// belongs to; it is never one click away behind a disclosure.
//
// Everything below restates a field already computed elsewhere in the
// AnalysisResult (§10.0.2 rule 3 applies here too, even though Quick Read
// sits outside §10.2's own section list) — no new calculation, score,
// verdict or AI call. No "N of M" ratio is manufactured anywhere in this
// file — that count is not itself a field anywhere in the Analysis Result
// (only each cell/definition's own state is), so only existence checks
// (`.some`) are used, never a count (Quick Read contract check).

const PROFILE_LABELS: Record<Profile, string> = {
  MATURE_PROFITABLE_STABLE_FCF: "mature, profitable, stable free cash flow",
  HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY: "high-growth, profitable, uncertain durability",
  PRE_REVENUE_UNPROFITABLE: "pre-revenue / unprofitable",
  ASSET_BASED: "asset-based",
};

// Best-effort section reference for a suppressing/qualifying state's own
// `appliesTo` text, so a consolidated Quick Read line can still point the
// reader at the full detail — never required, only a convenience.
function sectionRefFor(appliesTo: string): string | null {
  // The outputs lib/analyzer/notComputed.ts binds a state to, by the name it
  // binds them under — checked first, because their causes name inputs
  // ("operating margin") the looser matches below would misplace.
  if (isBoundTo(appliesTo, NOT_COMPUTED_BINDING.rateSensitivity)) return "E";
  if (isBoundTo(appliesTo, NOT_COMPUTED_BINDING.rateAtWhichBaseEqualsPrice)) return "G";
  if (isBoundTo(appliesTo, NOT_COMPUTED_BINDING.terminalShareOfValue)) return "G";
  if (isBoundTo(appliesTo, NOT_COMPUTED_BINDING.priceLocationWithinRange)) return "G";
  if ((["bear", "base", "bull"] as const).some((s) => isBoundTo(appliesTo, NOT_COMPUTED_BINDING.scenarioDrivers(s)))) {
    return "F";
  }
  const a = appliesTo.toLowerCase();
  if (a.includes("reverse-dcf")) return "E";
  if (a.includes("fcf yield")) return "D";
  if (a.includes("own-history") || a.includes("history-based")) return "D";
  if (a.includes("all valuation outputs")) return "C";
  if (a.includes("rate-dependent")) return "C";
  if (a.includes("margin")) return "D";
  return null;
}

interface ConsolidatedState {
  state: SuppressingState;
  sectionRef: string | null;
}

// Collapses repeated identical states (e.g. several DEGENERATE reverse-DCF
// cells) into one line each — never dumping the same state name once per
// row.
function consolidateStates(suppressing: AnalysisResult["states"]["suppressing"]): ConsolidatedState[] {
  const seen = new Map<SuppressingState, string | null>();
  for (const s of suppressing) {
    if (!seen.has(s.state)) {
      seen.set(s.state, sectionRefFor(s.appliesTo));
    }
  }
  return Array.from(seen.entries()).map(([state, sectionRef]) => ({ state, sectionRef }));
}

function formatDollar(v: Decimal): string {
  return `$${v.toFixed(2)}`;
}
function formatPct(v: Decimal, dp = 1): string {
  return `${v.mul(100).toFixed(dp)}%`;
}

function SecLink({ id, children }: { id: string; children: ReactNode }) {
  return <a href={`#${id}`}>{children}</a>;
}

// CF-AR1-QUICK-READ-OVERVIEW-01 — the two things that change when this
// file's content is rendered on the Overview tab instead of (or in addition
// to) Evidence: the lettered sections (`SecLink`) this component points to
// exist only on the Evidence tab's own page under the seven-tab shell, so a
// pointer to one from Overview would be a dead, unresolvable anchor — the
// same reason `overviewCopy.ts` already forbids a bare `"see Evidence"`
// placeholder. And every raw `SuppressingState` literal shown in bold here
// must instead go through `overviewCopy.ts`'s plain-English translation
// (DO item 3). Both are pure presentation swaps on a `plain` flag; no
// branch condition, figure or computation anywhere in this file changes.
// `QuickRead`'s own call (Evidence tab) always passes `plain={false}` and
// so renders byte-for-byte as before this outcome.

/**
 * The Evidence-only section pointer; dropped entirely when `plain`. The
 * connector is each call site's own base wording (" — see ", " — " or " "),
 * so the Evidence tab renders exactly as before this outcome.
 */
function sectionPointer(plain: boolean, id: string, connector: " — see " | " — " | " " = " — see "): ReactNode {
  if (plain) return null;
  return (
    <>
      {connector}
      <SecLink id={id}>Section {id}</SecLink>
    </>
  );
}

/** A technical state name — bold and raw on Evidence, overviewCopy.ts's plain English when `plain`. */
function stateClause(
  plain: boolean,
  state: SuppressingState,
  cause = "",
  leverage?: AnalysisResult["gates"]["leverage"]
): ReactNode {
  return plain ? plainReason(state, cause, leverage) : <b>{state}</b>;
}

interface QuickReadItem {
  label: string;
  body: ReactNode;
}

// --- Item 8, "Data and model quality" -------------------------------------
// Material suppression, qualification and provenance issues — not the whole
// register (§17.16). This is the content that used to live behind the
// single "Learn more" drawer; it is the same restatement, just always
// visible under its own named item instead of hidden behind a disclosure.
function dataAndModelQualityItem(result: AnalysisResult, plain: boolean): ReactNode {
  const { states, trust } = result;
  const consolidated = consolidateStates(states.suppressing);
  const anyNonDefaultProvenanceFact = result.facts.some(
    (f) =>
      f.sourceClass === "SECONDARY" ||
      f.extractionType === "AI-EXTRACTED" ||
      // §3.2: only CONFIRMED is a human confirmation. SPOT-CHECK NOT REQUIRED
      // "must never be displayed as one", so it qualifies here too.
      f.verificationState !== "CONFIRMED"
  );
  const bullets: ReactNode[] = [
    ...consolidated.map((c) => (
      <li key={`s-${c.state}`}>
        {plain ? (
          <>One or more outputs are not computed yet — {plainReason(c.state, "", result.gates.leverage)}.</>
        ) : (
          <>
            Output(s) return <b>{c.state}</b>
            {c.sectionRef ? (
              <>
                {" — see "}
                <SecLink id={c.sectionRef}>Section {c.sectionRef}</SecLink>
              </>
            ) : (
              "."
            )}
          </>
        )}
      </li>
    )),
    ...states.qualifying.map((q, i) => (
      <li key={`q-${i}`}>
        <b>{q.flag}</b> — {q.appliesTo}.
      </li>
    )),
    ...(anyNonDefaultProvenanceFact
      ? [
          <li key="prov">
            {plain ? (
              <>
                One or more facts behind this analysis carry a non-default provenance marker (secondary source,
                AI-extracted, or unverified).
              </>
            ) : (
              <>
                One or more facts in <SecLink id="B">Section B</SecLink> carry a non-default provenance marker
                (secondary source, AI-extracted, or unverified).
              </>
            )}
          </li>,
        ]
      : []),
  ];
  // §17.16 item 10 requires this item to carry the §9.6 trust status on
  // every run, including CLEAN — read off the Analysis Result, never
  // worked out here (§10.0.2 rule 3).
  const statusLine = (
    <p className="t">
      <b>{trustStatusLine(trust.status, false)}</b>
    </p>
  );
  if (bullets.length === 0) {
    return (
      <>
        {statusLine}
        <p className="t">No suppressing state or qualifying flag is active for this analysis.</p>
      </>
    );
  }
  return (
    <>
      {statusLine}
      <ul>{bullets}</ul>
    </>
  );
}

// --- Item 7, "Strongest challenger point" ---------------------------------
function challengerItem(result: AnalysisResult, plain: boolean): ReactNode {
  if (result.challenger === null) {
    return plain ? (
      <p className="t">
        Findings from the independent challenger call will appear on the Risks &amp; Thesis tab, unreconciled with
        the analysis above, once that call completes.
      </p>
    ) : (
      <p className="t">
        Findings from the independent challenger call appear in <SecLink id="I2">Section I2</SecLink>, unreconciled
        with the analysis above, once that call completes.
      </p>
    );
  }
  const first = result.challenger.findings[0];
  if (!first) {
    return plain ? (
      <p className="t">The independent challenger call completed with no findings recorded.</p>
    ) : (
      <p className="t">
        The independent challenger call completed with no findings recorded — see <SecLink id="I2">Section I2</SecLink>.
      </p>
    );
  }
  return plain ? (
    <p className="t">
      {first.claimOrFactReference} — unreconciled with the analysis above; the full finding is on the Risks &amp;
      Thesis tab.
    </p>
  ) : (
    <p className="t">
      {first.claimOrFactReference} — see <SecLink id="I2">Section I2</SecLink>, unreconciled with the analysis above.
    </p>
  );
}

/**
 * Quick Read's own eight items (§17.16). `plain` is presentation-only (DO
 * item 3 / sectionPointer's own doc comment above) — every branch condition
 * and figure below is identical regardless of its value.
 */
function buildQuickRead(result: AnalysisResult, plain: boolean): QuickReadItem[] {
  const { gates, states, priceImplied, preRevenue, fairValueRange, scenarioOutputs } = result;
  const marginAtHigh = states.qualifying.some((q) => q.flag === "MARGIN AT HISTORICAL HIGH");

  const challengerItemBody = challengerItem(result, plain);
  const dataQualityBody = dataAndModelQualityItem(result, plain);

  // --- Gate/leverage refusal takes priority over everything else -------
  const gate0Result = gates.gate0.result;
  if (gate0Result !== "PASS") {
    return [
      {
        label: "Main finding",
        body: (
          <p className="qlead">
            Calboard cannot value {result.companyName} with this method —{" "}
            {plain ? plainReason(gate0Result, "") : <b>{gate0Result}</b>}
            {!plain && <> (<SecLink id="C">Section C</SecLink>)</>}.
          </p>
        ),
      },
      {
        label: "Price vs scenarios",
        body: (
          <p className="t">
            Every price-implied and scenario output is suppressed under this state{sectionPointer(plain, "H")}.
          </p>
        ),
      },
      {
        label: "What today's price requires",
        body: (
          <p className="t">
            Not shown — no valuation output survives this gate.{!plain && <> See <SecLink id="C">Section C</SecLink>.</>}
          </p>
        ),
      },
      {
        label: "What supports the case",
        body: (
          <p className="t">
            Facts, and whatever multiples and history diagnostics remain arithmetically defined, are still shown
            {sectionPointer(plain, "D")}.
          </p>
        ),
      },
      {
        label: "What worries Calboard",
        body: (
          <p className="t">
            The gate refuses outright rather than producing a confident-looking answer from the wrong model
            {sectionPointer(plain, "C")}.
          </p>
        ),
      },
      {
        label: "Biggest uncertainty",
        body: (
          <p className="t">
            Whether the classification itself is right{plain ? "." : <> — see <SecLink id="C">Section C</SecLink> for the exact test that fired.</>}
          </p>
        ),
      },
      { label: "Strongest challenger point", body: challengerItemBody },
      { label: "Data and model quality", body: dataQualityBody },
    ];
  }

  if (gates.leverage.result === "LEVERAGE UNSUPPORTED IN v1" && preRevenue === null) {
    return [
      {
        label: "Main finding",
        body: (
          <p className="qlead">
            The leverage precondition fails for {result.companyName}, so every rate-dependent output here is
            suppressed
            {plain ? (
              <> — {plainReason("LEVERAGE UNSUPPORTED IN v1", "", gates.leverage)}.</>
            ) : (
              <>
                {" "}
                (<b>LEVERAGE UNSUPPORTED IN v1</b> — <SecLink id="C">Section C</SecLink>).
              </>
            )}
          </p>
        ),
      },
      {
        label: "Price vs scenarios",
        body: (
          <p className="t">The fair-value range is suppressed under this state{sectionPointer(plain, "H")}.</p>
        ),
      },
      {
        label: "What today's price requires",
        body: (
          <p className="t">
            Not shown — the reverse DCF, steady-state EV/PVGO, implied exit multiple and the fair-value range
            are all suppressed.{!plain && <> See <SecLink id="E">Section E</SecLink>.</>}
          </p>
        ),
      },
      {
        label: "What supports the case",
        body: (
          <p className="t">
            Facts and whatever diagnostics do not depend on the levered structure remain shown
            {sectionPointer(plain, "D")}.
          </p>
        ),
      },
      {
        label: "What worries Calboard",
        body: (
          <p className="t">
            A capital structure this levered can no longer be treated as a straightforward unlevered claim
            {sectionPointer(plain, "C")}.
          </p>
        ),
      },
      {
        label: "Biggest uncertainty",
        body: (
          <p className="t">
            The net debt ratio itself and whether it is likely to change{sectionPointer(plain, "C")}.
          </p>
        ),
      },
      { label: "Strongest challenger point", body: challengerItemBody },
      { label: "Data and model quality", body: dataQualityBody },
    ];
  }

  // --- Pre-revenue, acquired cash-per-share basis not established ---------
  //
  // CalFinance Methodology v2's acquired-run cash basis is a REQUIRED input
  // of the fair-value range itself (assemble.ts), so its absence removes the
  // range — distinct from every other reason the range can be gone, and
  // checked first so a pre-revenue run never falls through to the
  // mature-company reading below.
  if (preRevenue !== null && fairValueRange.kind === "suppressed") {
    return [
      {
        label: "Main finding",
        body: (
          <p className="qlead">
            Calboard cannot show a fair-value distribution for {result.companyName} on this run —{" "}
            {stateClause(plain, fairValueRange.state, fairValueRange.cause)}
            {!plain && <> (<SecLink id="D">Section D</SecLink>)</>}.
          </p>
        ),
      },
      {
        label: "Price vs scenarios",
        body: plain ? (
          <p className="t">{plainReason(fairValueRange.state, fairValueRange.cause)}.</p>
        ) : (
          <p className="t">
            {fairValueRange.cause} <SecLink id="D">Section D</SecLink>
          </p>
        ),
      },
      {
        label: "What today's price requires",
        body: (
          <p className="t">
            Not shown — no fair-value distribution survives this state.{!plain && <> See <SecLink id="D">Section D</SecLink>.</>}
          </p>
        ),
      },
      {
        label: "What supports the case",
        body: (
          <p className="t">
            Whichever success definitions and funding-stack figures remain independently computable are still shown
            {sectionPointer(plain, "D")}.
          </p>
        ),
      },
      {
        label: "What worries Calboard",
        body: (
          <p className="t">
            The acquired cash-per-share basis is not established, so the failure floor and any success weight built
            on it are withheld rather than shown on an invented basis{sectionPointer(plain, "D")}.
          </p>
        ),
      },
      {
        label: "Biggest uncertainty",
        body: (
          <p className="t">
            Whether a later run can acquire the missing cash, share or burn evidence this basis needs
            {sectionPointer(plain, "D")}.
          </p>
        ),
      },
      { label: "Strongest challenger point", body: challengerItemBody },
      { label: "Data and model quality", body: dataQualityBody },
    ];
  }

  // --- Pre-revenue --------------------------------------------------------
  if (preRevenue !== null && fairValueRange.kind === "pre-revenue-distribution") {
    const anyWorthLessThanFailure = preRevenue.successDefinitions.some(
      (d) => d.state.kind === "THIS SUCCESS IS WORTH LESS THAN FAILURE"
    );
    const anyRateCapped = preRevenue.successDefinitions.some((d) => d.rateCapped);
    const anyClearsFloor = preRevenue.successDefinitions.some((d) => d.vSuccess.greaterThan(fairValueRange.cashFloor));
    const range = fairValueRange.successAsCommonlyDescribed;
    const rangeText = range.low.equals(range.high)
      ? formatDollar(range.low)
      : `${formatDollar(range.low)}-${formatDollar(range.high)}`;

    return [
      {
        label: "Main finding",
        body: (
          <p className="qlead">
            {anyWorthLessThanFailure ? (
              <>
                On one or more of the modelled ways {result.companyName} could succeed, shareholders would end up
                with less than if it simply held its cash
                {plain ? (
                  <> — {plainReason("THIS SUCCESS IS WORTH LESS THAN FAILURE", "")}.</>
                ) : (
                  <>
                    {" "}
                    (<b>THIS SUCCESS IS WORTH LESS THAN FAILURE</b>) — see <SecLink id="D">Section D</SecLink> for
                    which.
                  </>
                )}
              </>
            ) : (
              <>
                Every modelled way {result.companyName} could succeed is worth more than simply holding its cash
                {plain ? "." : " — none returns THIS SUCCESS IS WORTH LESS THAN FAILURE."}
              </>
            )}
          </p>
        ),
      },
      {
        label: "Price vs scenarios",
        body: (
          <p className="t">
            Not a bear-bull range. The outcomes are separate worlds, so the output is a distribution: failure{" "}
            {formatDollar(fairValueRange.failure)}, success as commonly described {rangeText}.
            {!plain && <> <SecLink id="H">Section H</SecLink></>}
          </p>
        ),
      },
      {
        label: "What today's price requires",
        body: (
          <p className="t">
            Success as today&apos;s price requires is {formatDollar(fairValueRange.successAsPriceRequires)} per
            share.{!plain && <> <SecLink id="H">Section H</SecLink></>}
          </p>
        ),
      },
      {
        label: "What supports the case",
        body: (
          <ul>
            <li>
              A cash floor of {formatDollar(fairValueRange.cashFloor)} per share that does not depend on{" "}
              {result.companyName}&apos;s operations succeeding{sectionPointer(plain, "H", " — ")}
            </li>
            {anyClearsFloor && (
              <li>At least one modelled success clears the cash floor by a wide margin{sectionPointer(plain, "D", " — ")}</li>
            )}
          </ul>
        ),
      },
      {
        label: "What worries Calboard",
        body: (
          <ul>
            {anyWorthLessThanFailure && (
              <li>
                One or more success definitions {plain ? "show" : "return"}{" "}
                {stateClause(plain, "THIS SUCCESS IS WORTH LESS THAN FAILURE")} — a finding, not an error.
                {!plain && <> <SecLink id="D">Section D</SecLink></>}
              </li>
            )}
            {anyRateCapped && (
              <li>
                The levered cost-of-equity cap binds on one or more success definitions (
                <b>RATE CAPPED — VALUE IS AN UPPER BOUND</b>), so those values are upper bounds
                {sectionPointer(plain, "D", " — ")}
              </li>
            )}
            {!anyWorthLessThanFailure && !anyRateCapped && <li>No value-level concern is active for this analysis.</li>}
          </ul>
        ),
      },
      {
        label: "Biggest uncertainty",
        body: (
          <p className="t">
            The capacity ramp shape used in the funding stack — back-loaded versus steady moves the same success
            case&apos;s value.{sectionPointer(plain, "D", " ")}
          </p>
        ),
      },
      { label: "Strongest challenger point", body: challengerItemBody },
      { label: "Data and model quality", body: dataQualityBody },
    ];
  }

  // --- Mature / high-growth (reverse-DCF applies) -------------------------
  // M7's one solve (frozen spec §14.9 AR0-2); absent on a snapshot stored
  // before AR4, which carried the retired grid instead.
  const solve = priceImplied.reverseDcf as typeof priceImplied.reverseDcf | undefined;
  const cleanCell = solve !== undefined && !solve.fiveYearGrowth.suppressed && !solve.tenYearCagr.suppressed ? solve : undefined;
  const anyDegenerateCell =
    solve !== undefined && solve.fiveYearGrowth.suppressed && solve.fiveYearGrowth.state === "DEGENERATE — TERMINAL EXCEEDS TOTAL VALUE";
  const ronic = result.diagnostics.impliedReturnOnNewCapital.value;
  const rateInUse = result.valuationBasis?.discountRate.rate ?? null;
  const ronicAboveEveryRate = !ronic.suppressed && rateInUse !== null && ronic.value.greaterThan(rateInUse);

  const growthLine =
    cleanCell && !cleanCell.fiveYearGrowth.suppressed && !cleanCell.tenYearCagr.suppressed
      ? `Today's price implies roughly ${formatPct(cleanCell.tenYearCagr.value)} annual growth over ten years (${formatPct(
          cleanCell.fiveYearGrowth.value
        )} for the next five, at the base scenario's margin and a ${formatPct(cleanCell.rate)} discount rate).`
      : solve !== undefined && solve.fiveYearGrowth.suppressed && /^Pending adoption/.test(solve.fiveYearGrowth.cause)
        ? `What today's price implies is not computed yet — ${plainReason("INCOMPLETE", solve.fiveYearGrowth.cause)}.`
        : "The reverse DCF does not resolve to a usable growth figure at this run's inputs.";

  const inRange = fairValueRange.kind === "range" ? scenarioOutputs.priceLocationWithinRange : null;
  const insideRange = inRange !== null && inRange.greaterThanOrEqualTo(0) && inRange.lessThanOrEqualTo(1);

  return [
    {
      label: "Main finding",
      body: (
        <p className="qlead">
          {growthLine}{" "}
          {anyDegenerateCell && (
            <>
              {plain ? (
                <>
                  The reverse DCF returns no number at all rather than a misleading one —{" "}
                  {plainReason("DEGENERATE — TERMINAL EXCEEDS TOTAL VALUE", "")}.
                </>
              ) : (
                <>
                  The reverse DCF returns no number at all (
                  <b>DEGENERATE — TERMINAL EXCEEDS TOTAL VALUE</b>) rather than a misleading one — see{" "}
                  <SecLink id="E">Section E</SecLink> for which.
                </>
              )}
            </>
          )}
        </p>
      ),
    },
    {
      label: "Price vs scenarios",
      // `fairValueRange.kind === "range"` does not by itself imply
      // `priceLocationWithinRange` is non-null — a fixture that states its
      // own `leverage.enterpriseValue` can pass the leverage precondition
      // even when M1 (and so the price behind this figure) is INCOMPLETE
      // (see docs/noprice-honesty-reconciliation.md §2). Gating on `inRange
      // !== null` here, rather than on `kind` alone, is what keeps this from
      // ever printing "Outside the authored bear-bull range" for a position
      // that is actually unknown.
      body: fairValueRange.kind === "range" && inRange !== null ? (
        <p className="t">
          {insideRange ? "Inside" : "Outside"} the authored bear-bull range, with the weighted value shown inside the
          range rather than as a headline
          {fairValueRange.scenarioLabelsWarning && " (the bounds are scenario labels, not confidence bounds)"}.
          {!plain && <> <SecLink id="H">Section H</SecLink></>}
        </p>
      ) : (
        <p className="t">The fair-value range is suppressed{sectionPointer(plain, "H")}.</p>
      ),
    },
    {
      label: "What today's price requires",
      body:
        cleanCell && !cleanCell.fiveYearGrowth.suppressed && !cleanCell.tenYearCagr.suppressed ? (
          <p className="t">
            {formatPct(cleanCell.fiveYearGrowth.value)} revenue growth for five years at r ={" "}
            {formatPct(cleanCell.rate)}, equivalent to {formatPct(cleanCell.tenYearCagr.value)} over
            ten.{!plain && <> <SecLink id="E">Section E</SecLink></>}
          </p>
        ) : (
          <p className="t">
            {solve !== undefined && solve.fiveYearGrowth.suppressed && /^Pending adoption/.test(solve.fiveYearGrowth.cause)
              ? `Not computed yet — ${plainReason("INCOMPLETE", solve.fiveYearGrowth.cause)}.`
              : "The reverse DCF does not resolve to a usable growth figure at this run's inputs."}
            {!plain && <> <SecLink id="E">Section E</SecLink></>}
          </p>
        ),
    },
    {
      label: "What supports the case",
      body: (
        <ul>
          {ronicAboveEveryRate && (
            <li>Return on new capital of {formatPct(ronic.value)}, above the discount rate in use{sectionPointer(plain, "D", " — ")}</li>
          )}
          {cleanCell && (
            <li>
              The reverse DCF resolves to a usable growth figure rather than returning a state
              {sectionPointer(plain, "E", " — ")}
            </li>
          )}
          {!ronicAboveEveryRate && !cleanCell && <li>No supporting figure resolves cleanly for this analysis.</li>}
        </ul>
      ),
    },
    {
      label: "What worries Calboard",
      body: (
        <ul>
          {marginAtHigh && (
            <li>
              Operating margin sits at or near its own ten-year high (<b>MARGIN AT HISTORICAL HIGH</b>), and the
              base scenario the reverse DCF holds may start from that level{sectionPointer(plain, "D", " — ")}
            </li>
          )}
          {anyDegenerateCell && (
            <li>
              {plain ? (
                <>The reverse DCF returns no number — {plainReason("DEGENERATE — TERMINAL EXCEEDS TOTAL VALUE", "")}</>
              ) : (
                <>
                  The reverse DCF returns <b>DEGENERATE — TERMINAL EXCEEDS TOTAL VALUE</b> rather than a
                  number — <SecLink id="E">Section E</SecLink>
                </>
              )}
            </li>
          )}
          {!marginAtHigh && !anyDegenerateCell && <li>No value-level concern is active for this analysis.</li>}
        </ul>
      ),
    },
    {
      label: "Biggest uncertainty",
      body: marginAtHigh ? (
        <p className="t">
          Which margin level is the right base — the current level or the ten-year median. The gap moves the
          valuation; the margin sensitivity shows by how much.{sectionPointer(plain, "D", " ")}
        </p>
      ) : (
        <p className="t">
          How much of the value sits in the terminal period.{sectionPointer(plain, "E", " ")}
        </p>
      ),
    },
    { label: "Strongest challenger point", body: challengerItemBody },
    { label: "Data and model quality", body: dataQualityBody },
  ];
}

// §10.7 rule 2 — the four page-one sentences that "genuinely vary" between
// companies. Where the interpretation call has run, its prose replaces the
// template for exactly these four and no others; rule 1 keeps every
// fixed-shape sentence deterministic, and "no model may rewrite one after it
// is filled".
//
// The substitution happens HERE, after buildQuickRead has produced the full
// eight-item template set, so the fallback is never a gap: a run whose call
// has not completed shows the same eight items with their [S] copy, which is
// §10.7's first legitimate provenance rather than an absence.
const VARIABLE_ITEM_TO_PAGE_ONE_KEY: Record<string, keyof NonNullable<AnalysisResult["interpretation"]["pageOne"]>> = {
  "Main finding": "mainFinding",
  "What supports the case": "whatSupportsTheCase",
  "What worries Calboard": "whatWorriesCalboard",
  "Biggest uncertainty": "biggestUncertainty",
};

function applyInterpretedPageOne(items: QuickReadItem[], result: AnalysisResult): QuickReadItem[] {
  const pageOne = result.interpretation.pageOne;
  if (pageOne === null) return items;

  return items.map((item) => {
    const key = VARIABLE_ITEM_TO_PAGE_ONE_KEY[item.label];
    if (key === undefined) return item;
    // Every figure in this sentence was substituted from the Analysis Result
    // before it reached here (§10.7 rule 3, enforced in lib/analyzer/ai).
    return { label: item.label, body: <p className="qlead">{pageOne[key].statement}</p> };
  });
}

export function QuickRead({ result }: { result: AnalysisResult }) {
  const items = applyInterpretedPageOne(buildQuickRead(result, false), result);
  const profileLabel = PROFILE_LABELS[result.profile.confirmedOrOverridden];
  // CF-PRICE-DISPLAY-HONESTY-RECON-01 — result.price.timestamp is "" on a
  // priceless run (§3.4's own always-present sentinel); the clause is
  // omitted rather than printed blank, the same "never a placeholder" rule
  // ValuationStrip's own showLocation line already follows.
  const priceState = boundState(result.states, NOT_COMPUTED_BINDING.price);

  return (
    <section id="quickread" aria-label="Quick read">
      <div className="sechead">
        <h2>Quick read</h2>
        <span className="k">
          {result.companyName} · {profileLabel}
          {priceState === null && ` · price as of ${result.price.timestamp}`}
        </span>
      </div>
      <hr />
      <ValuationStrip result={result} showLocation />
      {items.map((item) => (
        <div className="qitem" key={item.label}>
          <span className="k">{item.label}</span>
          {item.body}
        </div>
      ))}
    </section>
  );
}

/**
 * CF-AR1-QUICK-READ-OVERVIEW-01 — Quick Read's own items (§17.16), rendered
 * in the Overview tab body (DO item 1). Same branch logic and figures as
 * `QuickRead` above, via the same `buildQuickRead`/`applyInterpretedPageOne`
 * — nothing here is computed twice or differently. Two differences only,
 * both presentational: the bear/base/bull/current-price grid is omitted —
 * the hero's `ScenarioRangeStrip`, shared by every tab, already renders it
 * immediately above (no duplicate verdict card) — and `buildQuickRead`'s
 * `plain` flag routes every technical state name through overviewCopy.ts
 * and drops the Evidence-only "see Section X" cross-reference (see
 * `sectionPointer`'s doc comment above).
 */
export function OverviewQuickRead({ result }: { result: AnalysisResult }) {
  const items = applyInterpretedPageOne(buildQuickRead(result, true), result);

  return (
    <div className="ovslot" id="slot-quickread">
      <h3>Quick read</h3>
      {items.map((item) => (
        <div className="qitem" key={item.label}>
          <span className="k">{item.label}</span>
          {item.body}
        </div>
      ))}
    </div>
  );
}
