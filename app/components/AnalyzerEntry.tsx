"use client";

import { useActionState, useRef, type RefObject } from "react";
import { resolveTickerAction, beginAnalysisAction } from "@/app/actions/analyzer";
import { EMPTY_RESOLVE_STATE } from "@/lib/analyzer/resolveState";
import type { AnalyzerIdentity } from "@/lib/analyzer/identity";
import { disabledReason, offersTryAgain } from "@/lib/analyzer/identity";

// Analyzer Home — ANALYZER-V2-PREREPORT-01, on the design authority doc's
// "Pre-report states": "one dominant ticker/company entry action. Input +
// Analyze may stay inline when readable and stack at narrow portrait/mobile
// widths." This is a restyle onto the V2 shell (.az-home, not the legacy
// flat-1100px .cb-steps container Screens 2/3 still use), not a change to
// identity-resolution semantics: resolution still fires on blur or Enter,
// there is still no separate Resolve button (#211/#216, unchanged), the five
// outcomes below are unchanged, and the §17 comprehension content is not
// deleted — it moves behind a single top-level disclosure so it no longer
// occupies the first viewport (SCOPE item 2's "progressively disclosed, not
// deleted").
//
// "Input + Analyze" inline: the ticker field and whatever real action exists
// for the current identity (Begin analysis once RESOLVED, Try again for
// UNAVAILABLE) sit in one row at readable widths and stack under 600px — the
// same phone threshold AnalyzerShell's own nav already uses, so "narrow
// portrait/mobile" means one width system across this screen, not two. A
// permanently-visible disabled "Begin analysis" placeholder button (the old
// Step 1 markup rendered one even before any ticker existed) is not restored:
// disabledReason's copy is still rendered for every non-RESOLVED outcome
// (DONE WHEN requires the copy, not a non-functional control), which is a
// presentation simplification, not a semantic one.

export function AnalyzerEntry({ fixtureMissing }: { fixtureMissing?: string }) {
  const [state, formAction] = useActionState(resolveTickerAction, EMPTY_RESOLVE_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <AnalyzerHomeContent
      entered={state.entered}
      identity={state.identity}
      fixtureMissing={fixtureMissing}
      formAction={formAction}
      formRef={formRef}
    />
  );
}

/**
 * The presentational half of Analyzer Home — every outcome's copy, the
 * comprehension disclosure, and the two forms (resolve, begin analysis).
 * Kept prop-driven and free of `useActionState` on purpose: it is what
 * AnalyzerEntry.test.tsx renders directly, so Home's own tests need no
 * server-action dispatch machinery to exercise every identity outcome.
 */
export function AnalyzerHomeContent({
  entered,
  identity,
  fixtureMissing,
  formAction,
  formRef,
}: {
  entered: string;
  identity: AnalyzerIdentity | null;
  fixtureMissing?: string;
  formAction: (formData: FormData) => void;
  formRef: RefObject<HTMLFormElement>;
}) {
  return (
    <div className="az-home">
      <section className="az-home-hero">
        <h1 className="az-home-title">Analyze a company</h1>

        <div className="az-home-entryrow">
          <form ref={formRef} action={formAction} className="az-home-field">
            <label htmlFor="ticker">Ticker</label>
            <input
              className="az-home-input"
              id="ticker"
              name="ticker"
              type="text"
              defaultValue={entered}
              autoComplete="off"
              spellCheck={false}
              onBlur={() => formRef.current?.requestSubmit()}
            />
          </form>

          {identity && identity.outcome === "RESOLVED" && (
            <form action={beginAnalysisAction} className="az-home-actionform">
              <input type="hidden" name="ticker" value={identity.ticker} />
              <button className="az-home-analyze act" type="submit">
                Begin analysis
              </button>
            </form>
          )}

          {identity && identity.outcome !== "RESOLVED" && offersTryAgain(identity) && (
            <button
              className="az-home-analyze act"
              type="button"
              onClick={() => formRef.current?.requestSubmit()}
            >
              Try again
            </button>
          )}
        </div>

        <p className="az-home-scope">
          A US-listed operating company, one per run. ETFs and other funds are out of scope
          here — they have no filings of their own.
        </p>
      </section>

      {fixtureMissing && (
        <div className="az-home-result">
          <div className="state">
            <span className="plain">
              {fixtureMissing} resolves as a listed operating company, but this build has no
              fact set for it.
            </span>
            <span className="name">Unavailable — no fact set in this build</span>
            <span className="cause">
              Facts are acquired from SEC filings for any resolved ticker. The scenario inputs
              Step 7 supplies — not yet an interface, so still carried from the validation
              set — are recorded for MSFT and OKLO only, and a run cannot open without them.
            </span>
          </div>
          <p className="note">
            No run was created. A run that cannot be spot-checked must not exist, because
            Step 2 is what every calculation after it depends on.
          </p>
        </div>
      )}

      {identity && identity.outcome === "RESOLVED" && (
        <div className="az-home-result">
          <div className="idcard">
            <p className="idkicker">{identity.ticker} resolved to</p>
            <h2 className="idname">{identity.companyName}</h2>
            <p className="idline">Listed operating company · reporting in USD</p>
            <div className="stamp">
              <span>Secondary</span>
              <span className="sep">·</span>
              <span>Deterministic/structured</span>
              <span className="sep">·</span>
              <span>Resolved</span>
            </div>

            <div className="idsource">
              <h3>Resolution</h3>
              <dl>
                <dt>Provider</dt>
                <dd>Market-data provider, instrument lookup</dd>
                <dt>Instrument type</dt>
                <dd>EQUITY — supported</dd>
                <dt>Symbol queried</dt>
                <dd>{identity.ticker}, exactly as typed</dd>
                {/* Resolution had no timestamp until the DESIGN gate. It is
                    the moment the provider answered, carried on the
                    identity rather than read from the clock at render. */}
                <dt>Resolved at</dt>
                <dd>{formatResolvedAt(identity.resolvedAt)}</dd>
              </dl>
            </div>
          </div>

          {/* No price renders on Home. */}
          <p className="note">
            No price appears on this screen. Identity is one question and today&rsquo;s market
            data is another; putting a number here would answer the second before the first
            has been acted on.
          </p>
        </div>
      )}

      {identity && identity.outcome !== "RESOLVED" && (
        <div className="az-home-result">
          {/* UNAVAILABLE is OPEN — no answer yet. The rejections are
              SUPPRESSION — a settled answer, and the answer is no run. */}
          <div className={offersTryAgain(identity) ? "open" : "state"}>
            <span className="plain">{plainFor(identity.outcome, identity.ticker)}</span>
            <span className="name">{stateNameFor(identity)}</span>
            <span className="cause">{causeFor(identity.outcome, identity.ticker)}</span>
          </div>

          <p className="note">{noteFor(identity.outcome)}</p>
          <p className="note">{disabledReason(identity)}</p>
        </div>
      )}

      {/* The §17 comprehension layer, progressively disclosed rather than
          occupying the first viewport (SCOPE item 2). Copy is
          mock-screen1-entry.html's, verbatim. */}
      <details className="az-home-learnmore disclose">
        <summary>
          <span className="lbl">How ticker resolution works</span>
        </summary>
        <div className="body">
          <div className="finding">
            <p className="lede">
              One field, one ticker. Before any data is fetched, the provider is asked a single
              question — is this a real instrument of a type this analyzer runs on — and nothing
              else happens until that has an answer.
            </p>
            <dl>
              <dt>Why it matters</dt>
              <dd>
                A ticker that looks right and is not — a typo one letter away from a live symbol,
                a delisted shell, a foreign listing of a similar name — produces an analysis that
                is internally coherent and about the wrong company. Resolving identity first is
                what prevents that, and it is the only thing that happens before the software
                commits to anything.
              </dd>
              <dt>What this does not tell you</dt>
              <dd>
                Whether there is usable data behind the symbol. Identity and data availability are
                separate questions. A symbol can resolve cleanly here and still turn out to have
                too little filed history to analyse, which is found later and reported as its own
                state.
              </dd>
              <dt>What to examine</dt>
              <dd>
                The company name that comes back. Four letters are easy to get wrong and the name
                is the cheapest place to catch it.
              </dd>
            </dl>
            <details className="disclose">
              <summary>
                <span className="lbl">
                  Why is there no way to continue with a symbol that doesn&rsquo;t resolve?
                </span>
              </summary>
              <div className="body">
                Because that path once existed elsewhere in Calboard and let an unrecognised
                symbol into the portfolio. Identity now has no override: no &ldquo;add
                anyway&rdquo;, no manual instrument entry, no typing a name the provider did not
                confirm. There is also no autocomplete and no symbol list, because a picker is a
                catalogue by another name and would quietly become the thing that decides what is
                real. You type; the provider answers. If the provider cannot be reached, that is
                treated as no answer rather than as a rejection — the two are shown differently
                and behave differently.
              </div>
            </details>
          </div>
        </div>
      </details>
    </div>
  );
}

function stateNameFor(identity: { outcome: string; ticker: string }): string {
  switch (identity.outcome) {
    case "UNKNOWN":
      return `Unknown — no provider evidence for ${identity.ticker}`;
    case "UNSUPPORTED":
      return "Unsupported — not an operating company";
    case "NO_FILING_HISTORY":
      return "No filing history — zero annual filings on record";
    default:
      return "Unavailable — provider not reached";
  }
}

function plainFor(outcome: string, ticker: string): string {
  switch (outcome) {
    case "UNKNOWN":
      return "The provider answered, and has no instrument under this symbol.";
    case "UNSUPPORTED":
      return "This is a real instrument. It is not one this analyzer can run.";
    case "NO_FILING_HISTORY":
      return "This resolves to a real, listed operating company. It has filed no annual report.";
    default:
      return `We could not reach the provider. This says nothing about whether ${ticker} exists.`;
  }
}

function causeFor(outcome: string, ticker: string): string {
  switch (outcome) {
    case "UNKNOWN":
      return "Provider responded normally · zero matches returned";
    case "UNSUPPORTED":
      return "Analyzer accepts listed operating companies only";
    case "NO_FILING_HISTORY":
      return `Provider identifies ${ticker} as a listed operating company · SEC filing search returns zero annual reports for this registrant`;
    default:
      return "The request to the identity service did not complete";
  }
}

function noteFor(outcome: string): string {
  switch (outcome) {
    case "UNKNOWN":
      return "Check the spelling and type it again. A symbol that does not resolve cannot start a run, and there is no way to continue with one that did not.";
    case "UNSUPPORTED":
      return "A fund has no filings of its own, and every step after this one reads filings — so there would be nothing to spot-check and nothing to value. This is about the instrument type, not the business.";
    case "NO_FILING_HISTORY":
      return "Every step after this one takes a company apart through its annual filings, and this registrant has none — a run would only fail late, against a fact set that was never going to exist. A company can be listed under one registrant while its filing history sits under another after a reorganisation; Calboard does not follow that link, so identity stays decided here. This is not the same as too little history to analyse, which is a later question reported as its own state.";
    default:
      return "Nothing has been rejected and nothing has been recorded. Your entry is still in the field. Try again now or later — a failure to reach the provider is never treated as evidence about a symbol.";
  }
}

/**
 * The resolution timestamp, in the mock's shape: "4 Sep 2026, 21:04 SGT".
 * Rendered from the identity's own recorded moment, never from the clock at
 * render time — that would timestamp the page view rather than the answer.
 */
function formatResolvedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date}, ${time}`;
}
