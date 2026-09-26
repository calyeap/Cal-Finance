"use server";

import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { activeProvider } from "@/lib/marketdata";
import {
  resolveAnalyzerIdentity,
  mayBeginAnalysis,
  type AnalyzerIdentity,
} from "@/lib/analyzer/identity";
import {
  createRun,
  getRun,
  recordFactDecision,
  recordJudgment,
  recordProfileDecision,
  REASON_CODES,
  JUDGMENT_KEYS,
  type FactDecision,
  type ReasonCode,
  type ProfileDecision,
  type JudgmentKey,
} from "@/lib/analyzer/runStore";
import { fixtureForTicker } from "@/lib/analyzer/gate";
import { advanceRunAutomatically } from "@/lib/analyzer/autoRun";
import type { ResolveState } from "@/lib/analyzer/resolveState";
import { createDeepSnapshot } from "@/lib/analyzer/snapshotAnalysis";

// ---------------------------------------------------------------------------
// Server actions for the human steps. Every one of these runs on the server,
// which is the point: the Step 2 gate is server-side (design §104), and a
// decision recorded only in client state could not gate anything.
// ---------------------------------------------------------------------------

/**
 * Step 1 resolution. Fires on blur or Enter; there is no Resolve button.
 *
 * Creates nothing. The run commits only when the analyst confirms the
 * resolved company (design:121), which is beginAnalysisAction below.
 */
export async function resolveTickerAction(
  _prev: ResolveState,
  formData: FormData
): Promise<ResolveState> {
  const entered = String(formData.get("ticker") ?? "");
  if (entered.trim() === "") {
    return { identity: null, entered };
  }
  const identity = await resolveAnalyzerIdentity(entered, activeProvider());
  return { identity, entered };
}

/**
 * Refuses exactly as Screen 1 does when an identity does not resolve, or
 * otherwise commits a brand-new run for it and runs the run through the
 * unchanged acquire → verify → compute pipeline.
 *
 * Shared by beginAnalysisAction (Step 1, a client-typed ticker) and
 * beginUpdateRunAction (CF-UPDATE-FIRST-OUTCOME-01, a prior run's own
 * server-held ticker) so the two entry points refuse identically and neither
 * can drift from the other's fixture/refusal behaviour.
 *
 * CF-ANALYZER-AUTORUN-01 — this used to hand the analyst to Screen 2's
 * per-fact queue. Calvin ruled on 22 September 2026 04:28:04Z that the normal
 * contract is "ticker in → report out", so acquisition, routine verification
 * and the profile determination now run here, behind the scenes, and the
 * analyst lands on the run's Overview. Screen 2 and Screen 3 are unchanged and
 * still reachable, from the Sources / Details links on Overview and Full
 * Analysis — they are detail, not steps.
 */
async function commitAndRunAnalysis(identity: AnalyzerIdentity): Promise<void> {
  if (!mayBeginAnalysis(identity) || identity.outcome !== "RESOLVED") {
    // Nothing is created. The screen re-renders with the refusal.
    redirect("/analyzer");
  }

  // M7 serves the two validation fixtures; acquisition arrives at M8. A
  // company that resolves but has no fact set cannot be spot-checked, and a
  // run that cannot be spot-checked must not exist.
  if ((await fixtureForTicker(identity.ticker)) === null) {
    redirect(`/analyzer?unavailablefixture=${encodeURIComponent(identity.ticker)}`);
  }

  const runId = await createRun(identity.ticker, identity.companyName);

  // The only human interaction in the normal path ended at the confirmation
  // that produced this request. Everything Step 2 and Step 6 used to stop for
  // happens here instead — and nothing is skipped: every queued fact still
  // gets a decision, the §3.8.2 cross-checks still run, and a fact the
  // software cannot confirm is recorded NOT CONFIRMED so §5 carries INCOMPLETE
  // to whatever depends on it.
  //
  // The route pages call this too (it is idempotent), so a run whose creation
  // was interrupted here still reaches a report rather than stalling.
  await advanceRunAutomatically(runId);

  redirect(`/analyzer/${runId}`);
}

/**
 * Commits the run, runs the analysis, and moves to the report.
 *
 * Re-resolves rather than trusting the posted company name: the identity in
 * the form is client-supplied, and a run must not be created for a company the
 * server has not itself resolved. This is the same reasoning as the gate —
 * what the client says happened is not evidence that it did.
 */
export async function beginAnalysisAction(formData: FormData): Promise<void> {
  const ticker = String(formData.get("ticker") ?? "");
  const identity = await resolveAnalyzerIdentity(ticker, activeProvider());
  await commitAndRunAnalysis(identity);
}

/**
 * CF-UPDATE-FIRST-OUTCOME-01 — the UPDATE entry point: "Look at this company
 * again", surfaced from an existing completed report (AnalyzerReportFrame).
 *
 * Starts a brand-new, independent Analyzer run for the SAME, already-
 * confirmed company — skipping only Screen 1's ticker-entry/resolution
 * interaction — while the full Step 2 per-fact spot-check pass still runs
 * unchanged on the new run, exactly as it would on a first run. Nothing is
 * copied forward from the prior run: the new run gets its own runId and its
 * own fact decisions, and the prior run's row and report are left untouched.
 *
 * The company identity comes ONLY from the prior run's own server-held
 * ticker (getRun), re-resolved server-side through the same
 * resolveAnalyzerIdentity call Screen 1 uses — never from anything the
 * client posts. This is the same property beginAnalysisAction already holds
 * ("what the client says happened is not evidence that it did"), applied to
 * an entry point that has no client-typed ticker to begin with. A ticker
 * that no longer resolves is refused by commitAndRunAnalysis exactly as it
 * would be on Screen 1 — this entry point does not weaken that check.
 */
export async function beginUpdateRunAction(formData: FormData): Promise<void> {
  const priorRunId = String(formData.get("runId") ?? "");
  const priorRun = await getRun(priorRunId);
  if (priorRun === null) notFound();

  const identity = await resolveAnalyzerIdentity(priorRun.ticker, activeProvider());
  await commitAndRunAnalysis(identity);
}

function parseReasonCode(raw: FormDataEntryValue | null): ReasonCode | null {
  const value = raw === null ? "" : String(raw);
  return (REASON_CODES as readonly string[]).includes(value) ? (value as ReasonCode) : null;
}

/**
 * Records one Step 2 decision.
 *
 * A non-confirmation without a valid reason code is refused here, refused by
 * runStore, and refused by the table's CHECK constraint. Three layers is not
 * belt-and-braces for its own sake: the first gives a usable message, the
 * second protects every other caller, and only the third cannot be bypassed.
 */
export async function recordFactDecisionAction(formData: FormData): Promise<void> {
  const runId = String(formData.get("runId") ?? "");
  const factId = String(formData.get("factId") ?? "");
  const decision = String(formData.get("decision") ?? "") as FactDecision;

  if (decision !== "CONFIRMED" && decision !== "NOT CONFIRMED") {
    throw new Error("Step 2 offers exactly two decisions (§3.8.3)");
  }

  const reasonCode = decision === "NOT CONFIRMED" ? parseReasonCode(formData.get("reasonCode")) : null;

  await recordFactDecision(runId, factId, decision, reasonCode);
  revalidatePath(`/analyzer/${runId}/facts`);
}

export async function recordJudgmentAction(formData: FormData): Promise<void> {
  const runId = String(formData.get("runId") ?? "");
  const judgmentKey = String(formData.get("judgmentKey") ?? "") as JudgmentKey;
  const selection = String(formData.get("selection") ?? "");
  const rawReason = String(formData.get("reason") ?? "").trim();

  if (!(JUDGMENT_KEYS as readonly string[]).includes(judgmentKey)) {
    throw new Error("Unknown judgment (§4.4 defines three)");
  }
  if (selection.trim() === "") {
    throw new Error("A judgment records the selection that was made (§4.4)");
  }

  await recordJudgment(runId, judgmentKey, selection, rawReason === "" ? null : rawReason);
  revalidatePath(`/analyzer/${runId}/facts`);
}

/**
 * Records the Step 6 outcome and moves to the report.
 *
 * human_confirmed is not accepted from the form — runStore derives it from the
 * decision, so Cannot judge cannot arrive as a confirmation.
 */
export async function recordProfileDecisionAction(formData: FormData): Promise<void> {
  const runId = String(formData.get("runId") ?? "");
  const decision = String(formData.get("decision") ?? "") as ProfileDecision;
  const recommended = String(formData.get("recommendedProfile") ?? "");
  const overrideProfile = String(formData.get("overrideProfile") ?? "").trim();
  const overrideReason = String(formData.get("overrideReason") ?? "").trim();

  if (decision !== "CONFIRMED" && decision !== "OVERRIDDEN" && decision !== "CANNOT JUDGE") {
    throw new Error("Step 6 offers exactly three outcomes (§6.3)");
  }

  if (decision === "OVERRIDDEN") {
    if (overrideProfile === "") throw new Error("An override names the profile it selects (§6.3)");
    if (overrideReason === "") throw new Error("An override is recorded with its reason (§6.3)");
    await recordProfileDecision(runId, decision, overrideProfile, overrideReason);
  } else {
    // Confirm and Cannot judge both proceed on the recommended profile. The
    // difference is human_confirmed, which runStore sets, not this action.
    await recordProfileDecision(runId, decision, recommended, null);
  }

  // M9-DESKTOP-SHELL-01 — Overview is now the top-level destination for a
  // run (docs/design/m9-analyzer-design-contract.md §2.1); Full Analysis
  // remains reachable from Overview slot 12.
  redirect(`/analyzer/${runId}`);
}

/**
 * CF-V2-PROOF-01 — takes one immutable, versioned copy of the report this
 * run currently renders and sends the analyst to it.
 *
 * Runs the same shared path the report page itself calls
 * (createDeepSnapshot -> analysisForReport -> computeAnalysisForRun); no
 * calculation is forked for this action.
 */
export async function createDeepSnapshotAction(formData: FormData): Promise<void> {
  const runId = String(formData.get("runId") ?? "");

  const { version } = await createDeepSnapshot(runId);

  redirect(`/analyzer/${runId}/snapshot/${version}`);
}
