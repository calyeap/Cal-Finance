// The Analyzing pre-report state — ANALYZER-V2-PREREPORT-01, on the design
// authority doc's "Pre-report states": "narrow calm vertical progress state
// with company identity and only the approved user-level stages ... No fake
// percentage, backend jargon or extra controls."
//
// Order and copy are locked verbatim (issue #267's PRE-REPORT FLOW / #264):
// Gathering company information -> Checking financial data -> Running
// valuation -> Preparing analysis. Reordering, renaming, adding or dropping
// a stage here is the exact defect the DOM-order test in
// AnalyzingState.test.tsx exists to catch.
export const ANALYZING_STAGES = [
  "Gathering company information",
  "Checking financial data",
  "Running valuation",
  "Preparing analysis",
] as const;

export interface AnalyzingIdentity {
  ticker: string;
  companyName: string;
}

/**
 * Whether a given stage may honestly be shown as done.
 *
 * SCOPE item 4 (HARD BOUNDS: "do not fake progress"): stage state must come
 * from the run's own real state, never a timer or a guess, and a stage whose
 * completion this boundary cannot observe renders unclaimed rather than
 * assumed.
 *
 * The only real signal available here is `identity` — the run's own
 * confirmed ticker/company name, fetched from the run itself (see
 * loading.tsx). That makes stage 0 ("Gathering company information") the
 * one stage this boundary can honestly claim: a run only reaches this screen
 * after identity resolved. The remaining three happen inside one
 * un-instrumented request (advanceRunAutomatically + analysisForReport, both
 * awaited synchronously by [runId]/page.tsx before it returns any markup),
 * with no cheaper real signal available without duplicating that
 * acquisition/compute path — so they render unclaimed, not guessed.
 */
export function isStageDone(index: number, identity: AnalyzingIdentity | null): boolean {
  return index === 0 && identity !== null;
}

export function AnalyzingState({ identity }: { identity: AnalyzingIdentity | null }) {
  return (
    <div className="az-analyzing">
      <div className="az-analyzing-card">
        <p className="az-analyzing-kicker">Analyzing</p>
        <h1 className="az-analyzing-company">
          {identity ? `${identity.companyName} (${identity.ticker})` : "Resolving company…"}
        </h1>
        <ol className="az-analyzing-stages">
          {ANALYZING_STAGES.map((label, index) => (
            <li
              key={label}
              className="az-analyzing-stage"
              data-state={isStageDone(index, identity) ? "done" : "pending"}
            >
              <span className="az-analyzing-mark" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
