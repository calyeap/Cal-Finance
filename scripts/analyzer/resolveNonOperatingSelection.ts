import type { CandidateInvestment } from "../../lib/analyzer/acquisition/acquire";

// ---------------------------------------------------------------------------
// ai-run.ts's --nonoperating= flag, resolved to the selection string
// recordJudgment stores and selectionToNonOperatingInvestments
// (lib/analyzer/acquisition/nonOperatingJudgment.ts) reads back.
//
// THE DEFECT THIS REPLACES: ai-run.ts used to treat any value other than
// "none" as a signal to join EVERY candidate's tag, ignoring what was
// actually passed after "=". That made it impossible to record a specific
// tag selection — for MSFT, the only value the flag could produce besides
// "none" was the all-three $60.748B sum, which is exactly the double-count
// Calvin's §4.4 ruling (#188) rejects for the $36.348B `LongTermInvestments`
// aggregate alone.
//
// An unrecognised tag fails loudly rather than silently falling back to
// joining everything — the same reason ai-run.ts's own comment gives for
// making this a flag with no default: a run's output must never be read as
// though the analyzer had decided this itself.
// ---------------------------------------------------------------------------

export function resolveNonOperatingSelection(
  flagValue: string,
  candidates: readonly CandidateInvestment[]
): string {
  if (flagValue === "none") return "None of these are non-operating";

  const requestedTags = flagValue.split(" + ");
  const knownTags = new Set(candidates.map((c) => c.tag));
  const unknown = requestedTags.filter((tag) => !knownTags.has(tag));
  if (unknown.length > 0) {
    throw new Error(
      `--nonoperating: unrecognised tag(s) ${unknown.join(", ")}. ` +
        `Known candidates for this run: ${candidates.map((c) => c.tag).join(", ") || "(none)"}.`
    );
  }
  return requestedTags.join(" + ");
}
