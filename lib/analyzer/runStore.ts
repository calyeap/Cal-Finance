import { randomUUID } from "node:crypto";
import { getPool } from "../db";

// ---------------------------------------------------------------------------
// R7 — run persistence. Server-side, runId in the URL, no index, no history
// list, no listing endpoint. Lose the URL and the run is gone.
//
// There is deliberately no listRuns, findAllRunsByTicker or recentRuns
// function in this module, and none may be added. The absence of every
// general listing surface is what keeps this clear of Saved Analysis
// (§13.1), and a listing helper written "just for debugging" is how that
// boundary would quietly go.
//
// getLatestRunsForTickers below is a narrow, explicitly authorised exception
// (CF-PORTFOLIO-REVIEW-FIRST-OUTCOME-01, issue #352 SCOPE 6), not a
// reopening of this rule: it takes a caller-supplied, bounded set of tickers
// — always the symbols already present in the caller's own current
// positions — and answers only "does this specific held symbol have a
// report?", never "what runs exist?", and an empty ticker list yields
// nothing rather than defaulting to "all". Every caller in this repo passes
// only symbols the caller already knows are held; nothing in this module
// enumerates tickers on its own, so it remains distinct from the general
// run-listing/browse/search surface this file and HARD BOUNDS both continue
// to forbid.
// ---------------------------------------------------------------------------

// The vocabulary lives in ./decisions, which has no server dependency, so
// client components can render these controls without pulling `pg` into the
// browser bundle. Re-exported here so existing server-side callers are
// unaffected by where it is defined.
import type {
  FactDecision,
  ReasonCode,
  ProfileDecision,
  JudgmentKey,
  DecisionOrigin,
  StoredFactDecision,
  StoredJudgment,
} from "./decisions";

export { REASON_CODES, JUDGMENT_KEYS } from "./decisions";
export type {
  FactDecision,
  ReasonCode,
  ProfileDecision,
  JudgmentKey,
  DecisionOrigin,
  StoredFactDecision,
  StoredJudgment,
};

export interface AnalyzerRun {
  runId: string;
  ticker: string;
  resolvedCompanyName: string;
  createdAt: string;
  profileDecision: ProfileDecision | null;
  profile: string | null;
  profileOverrideReason: string | null;
  profileHumanConfirmed: boolean;
  /**
   * CF-ANALYZER-AUTORUN-01 — the profile the acquired inputs recommended,
   * recorded by the software when Step 6 resolved automatically, or null.
   *
   * Deliberately separate from `profileDecision`: §6.3's three outcomes are a
   * HUMAN's outcomes, and writing one of them for a determination nobody made
   * would state something false in the field the report reads to decide
   * whether a human confirmed the profile. A run carrying this still has
   * profileDecision null and profileHumanConfirmed false, so PROFILE NOT
   * CONFIRMED, the trust consequence (§9.6) and the §10.6.3 suppression all
   * keep working exactly as they did.
   */
  profileAutoResolved: string | null;
}


/**
 * Creates a run. Called only on confirmation of the resolved company at Step 1
 * (design:121) — never on ticker entry, and never for a ticker that failed
 * identity resolution, which per §9.3.1 is refused "before a run exists".
 *
 * The id is a v4 UUID from the platform CSPRNG. It is the run's only handle
 * and it travels in the URL, so it must be unguessable: a sequential key makes
 * every run reachable by typing /analyzer/1, which is a listing surface
 * arriving without a listing endpoint.
 */
export async function createRun(ticker: string, resolvedCompanyName: string): Promise<string> {
  const runId = randomUUID();
  await getPool().query(
    `INSERT INTO analyzer_runs (run_id, ticker, resolved_company_name, instrument_class)
     VALUES ($1, $2, $3, 'LISTED OPERATING COMPANY')`,
    [runId, ticker, resolvedCompanyName]
  );
  return runId;
}

export interface LatestRunSummary {
  runId: string;
  createdAt: string;
}

/**
 * Looks up the most recent run per ticker, for a caller-supplied set of
 * tickers only — never all tickers, never unbounded.
 *
 * This exists for PORTFOLIO REVIEW's holding-to-report link
 * (CF-PORTFOLIO-REVIEW-FIRST-OUTCOME-01, issue #352 SCOPE 6): every caller
 * passes only the symbols already present in the user's own current
 * positions (lib/portfolioReview.ts), never a browse-everything query. This
 * is still not the listing/browse/search surface the module header disclaims
 * — it answers "does this specific, already-held symbol have a report?", not
 * "what runs exist?" — and no caller may use it that way.
 */
export async function getLatestRunsForTickers(
  tickers: readonly string[]
): Promise<Map<string, LatestRunSummary>> {
  if (tickers.length === 0) return new Map();

  const { rows } = await getPool().query(
    `SELECT DISTINCT ON (ticker) ticker, run_id, created_at
       FROM analyzer_runs
      WHERE ticker = ANY($1::text[])
      ORDER BY ticker, created_at DESC`,
    [tickers]
  );

  const result = new Map<string, LatestRunSummary>();
  for (const r of rows) {
    result.set(r.ticker, { runId: r.run_id, createdAt: r.created_at });
  }
  return result;
}

export async function getRun(runId: string): Promise<AnalyzerRun | null> {
  // A malformed id is a miss, not a crash: runIds arrive from the URL bar,
  // where anything can be typed, and Postgres rejects a non-UUID literal.
  if (!isUuid(runId)) return null;

  const { rows } = await getPool().query(
    `SELECT run_id, ticker, resolved_company_name, created_at,
            profile_decision, profile, profile_override_reason, profile_human_confirmed,
            profile_auto_resolved
       FROM analyzer_runs
      WHERE run_id = $1`,
    [runId]
  );
  if (rows.length === 0) return null;

  const r = rows[0];
  return {
    runId: r.run_id,
    ticker: r.ticker,
    resolvedCompanyName: r.resolved_company_name,
    createdAt: r.created_at,
    profileDecision: r.profile_decision,
    profile: r.profile,
    profileOverrideReason: r.profile_override_reason,
    profileHumanConfirmed: r.profile_human_confirmed,
    profileAutoResolved: r.profile_auto_resolved,
  };
}

/**
 * Records one Step 2 decision, replacing any earlier decision on the same
 * fact so an analyst may change their mind before the step completes.
 *
 * §3.8.4: a non-confirmation is not complete without a reason code. That rule
 * is a CHECK constraint on the table and this validation does not replace it —
 * it exists so a caller gets a legible error instead of a constraint
 * violation. The database remains the enforcement; deleting these four lines
 * would not let a bad row through.
 */
export async function recordFactDecision(
  runId: string,
  factId: string,
  decision: FactDecision,
  reasonCode: ReasonCode | null
): Promise<void> {
  if (decision === "NOT CONFIRMED" && reasonCode === null) {
    throw new Error(
      "Cannot verify requires a reason code (§3.8.4): CONTRADICTED BY SOURCE or NOT LOCATED"
    );
  }
  if (decision === "CONFIRMED" && reasonCode !== null) {
    throw new Error("Confirm carries no reason code (§3.8.4)");
  }

  await getPool().query(
    `INSERT INTO analyzer_run_fact_decisions (run_id, fact_id, decision, reason_code, origin)
     VALUES ($1, $2, $3, $4, 'HUMAN')
     ON CONFLICT (run_id, fact_id)
     DO UPDATE SET decision = EXCLUDED.decision,
                   reason_code = EXCLUDED.reason_code,
                   origin = EXCLUDED.origin,
                   decided_at = now()`,
    [runId, factId, decision, reasonCode]
  );
}

/**
 * Records the decisions the SOFTWARE took on a run's queue
 * (CF-ANALYZER-AUTORUN-01, Calvin's 22 Sep 2026 04:28:04Z ruling).
 *
 * Two properties this function exists to hold, neither of which is optional:
 *
 * 1. **`origin = 'AUTOMATIC'`, always, literal.** It is not a parameter, so no
 *    caller can route an automatic confirmation through this path and have it
 *    recorded as a human one. The human path (recordFactDecision above) writes
 *    'HUMAN' the same way, for the same reason.
 * 2. **`DO NOTHING`, not `DO UPDATE`.** A fact an analyst has already decided
 *    is left exactly as they decided it. That makes the automatic pass
 *    idempotent — running it twice on the same run is a no-op — and makes it
 *    safe to run on a run someone is part-way through, which is what lets it
 *    sit on the ordinary load path without a second state machine deciding
 *    when it may fire.
 *
 * The §3.8.4 reason-code rule is not relaxed for this path: the same
 * validation the human path performs runs here, and the table's CHECK
 * constraint refuses a bad row underneath both.
 */
export async function recordAutomaticFactDecisions(
  runId: string,
  decisions: readonly { factId: string; decision: FactDecision; reasonCode: ReasonCode | null }[]
): Promise<void> {
  if (decisions.length === 0) return;

  for (const d of decisions) {
    if (d.decision === "NOT CONFIRMED" && d.reasonCode === null) {
      throw new Error(
        "Cannot verify requires a reason code (§3.8.4): CONTRADICTED BY SOURCE or NOT LOCATED"
      );
    }
    if (d.decision === "CONFIRMED" && d.reasonCode !== null) {
      throw new Error("Confirm carries no reason code (§3.8.4)");
    }
  }

  // One statement rather than one per fact: the whole queue is answered by a
  // single deterministic pass, so it lands as a single write.
  await getPool().query(
    `INSERT INTO analyzer_run_fact_decisions (run_id, fact_id, decision, reason_code, origin)
     SELECT $1, d.fact_id, d.decision, d.reason_code, 'AUTOMATIC'
       FROM UNNEST($2::text[], $3::text[], $4::text[]) AS d(fact_id, decision, reason_code)
     ON CONFLICT (run_id, fact_id) DO NOTHING`,
    [
      runId,
      decisions.map((d) => d.factId),
      decisions.map((d) => d.decision),
      decisions.map((d) => d.reasonCode),
    ]
  );
}

export async function getFactDecisions(runId: string): Promise<StoredFactDecision[]> {
  if (!isUuid(runId)) return [];
  const { rows } = await getPool().query(
    `SELECT fact_id, decision, reason_code, origin
       FROM analyzer_run_fact_decisions
      WHERE run_id = $1
      ORDER BY decided_at`,
    [runId]
  );
  return rows.map((r) => ({
    factId: r.fact_id,
    decision: r.decision,
    reasonCode: r.reason_code,
    origin: r.origin,
  }));
}

/**
 * The decided fact ids, in the shape isSpotCheckComplete wants. This is what
 * the route gate reads, and it reads it from the database on every request
 * rather than from a session or a cookie — a client-held run cannot be gated
 * by the server (R7).
 */
export async function getDecidedFactIds(runId: string): Promise<Set<string>> {
  const decisions = await getFactDecisions(runId);
  return new Set(decisions.map((d) => d.factId));
}

export async function recordJudgment(
  runId: string,
  judgmentKey: JudgmentKey,
  selection: string,
  reason: string | null
): Promise<void> {
  await getPool().query(
    `INSERT INTO analyzer_run_judgments (run_id, judgment_key, selection, reason)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (run_id, judgment_key)
     DO UPDATE SET selection = EXCLUDED.selection,
                   reason = EXCLUDED.reason,
                   decided_at = now()`,
    [runId, judgmentKey, selection, reason]
  );
}

export async function getJudgments(runId: string): Promise<StoredJudgment[]> {
  if (!isUuid(runId)) return [];
  const { rows } = await getPool().query(
    `SELECT judgment_key, selection, reason
       FROM analyzer_run_judgments
      WHERE run_id = $1`,
    [runId]
  );
  return rows.map((r) => ({
    judgmentKey: r.judgment_key,
    selection: r.selection,
    reason: r.reason,
  }));
}

/**
 * Records the Step 6 outcome (§6.3).
 *
 * human_confirmed is derived here rather than passed in, so no caller can
 * record Cannot judge as a confirmation. The table's CHECK constraint refuses
 * that combination too — this is the same rule stated where the decision is
 * made and where it is stored, and neither alone is trusted.
 */
export async function recordProfileDecision(
  runId: string,
  decision: ProfileDecision,
  profile: string,
  overrideReason: string | null
): Promise<void> {
  if (decision === "OVERRIDDEN" && !overrideReason?.trim()) {
    throw new Error("An override is recorded with its reason (§6.3)");
  }
  if (decision !== "OVERRIDDEN" && overrideReason !== null) {
    throw new Error("Only an override carries a reason (§6.3)");
  }

  // Cannot judge never counts as confirmation (§6.3).
  const humanConfirmed = decision === "CONFIRMED" || decision === "OVERRIDDEN";

  await getPool().query(
    `UPDATE analyzer_runs
        SET profile_decision = $2,
            profile = $3,
            profile_override_reason = $4,
            profile_human_confirmed = $5,
            profile_decided_at = now()
      WHERE run_id = $1`,
    [runId, decision, profile, overrideReason, humanConfirmed]
  );
}

/**
 * Records the Step 6 outcome the SOFTWARE reached (CF-ANALYZER-AUTORUN-01).
 *
 * §6.3 gives a human three outcomes. This is none of them, and it deliberately
 * does not write `profile_decision`: the run proceeds on the profile the
 * acquired inputs themselves recommended, and the record says that is what
 * happened rather than borrowing a word that would claim an analyst answered.
 *
 * `profile_human_confirmed` is untouched and stays FALSE, which is the whole
 * point. PROFILE NOT CONFIRMED still raises, trust still drops below CLEAN
 * (§9.6) and the §10.6 position is still suppressed (§10.6.3) — this outcome
 * removes a stop from the normal path, it does not manufacture a confirmation
 * nobody gave.
 *
 * `WHERE ... IS NULL` makes it idempotent and makes a human decision win: once
 * an analyst has decided on Screen 3, or once an earlier pass has recorded the
 * automatic resolution, a later pass writes nothing.
 */
export async function recordAutomaticProfileResolution(
  runId: string,
  recommendedProfile: string
): Promise<void> {
  if (recommendedProfile.trim() === "") {
    throw new Error("An automatic profile resolution records the profile it resolved to");
  }

  await getPool().query(
    `UPDATE analyzer_runs
        SET profile_auto_resolved = $2,
            profile_auto_resolved_at = now()
      WHERE run_id = $1
        AND profile_auto_resolved IS NULL
        AND profile_decision IS NULL`,
    [runId, recommendedProfile]
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
