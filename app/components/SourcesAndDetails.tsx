import Link from "next/link";

// CF-ANALYZER-AUTORUN-01 — the one place Screens 2 and 3 are reached from.
//
// Calvin's CALVIN RULING, 22 September 2026 04:28:04Z: "Technical
// acquisition/validation detail should remain available optionally under
// Sources / Details, but must not sit in the normal path."
//
// So this is a link, not a step. Both routes keep every control they have —
// the per-fact provenance and its two decisions, the judgment selectors, the
// gate bands, the profile override — and nothing on either of them is removed
// or reduced by this outcome. What changed is only that the analyst goes there
// when they want to, instead of being sent there before a report exists.
//
// Deliberately not a new navigation mechanism and not a primary action: plain
// links in the product's existing note register, one block, no chrome. The
// Analyzer's own "one dominant primary action per screen" convention is left
// to the page's real primary action (View full analysis / Save this version).

export function SourcesAndDetails({ runId }: { runId: string }) {
  return (
    <div className="cb-steps">
      <div className="wrap">
        <div className="sechead">
          <h2>Sources / Details</h2>
          <span className="screenlabel">Optional · not part of the analysis path</span>
        </div>
        <hr className="rule" />
        <p className="note">
          Every figure was acquired, classified, cross-checked and verified before this report was
          produced, without asking you to do any of it. These pages show that work and let you
          change it.
        </p>
        <p className="note">
          <Link href={`/analyzer/${runId}/facts`}>
            Facts, provenance and spot-check decisions
          </Link>{" "}
          — each acquired figure with all six of its fields, the automatic cross-check outcomes,
          the decision recorded against it and who recorded it, and the three §4.4 judgments.
        </p>
        <p className="note">
          <Link href={`/analyzer/${runId}/profile`}>Gates and profile</Link> — the Gate 0 and Gate 1
          results with the values they were evaluated on, the recommended profile with the facts
          that drove it, and the controls to confirm or override it.
        </p>
      </div>
    </div>
  );
}
