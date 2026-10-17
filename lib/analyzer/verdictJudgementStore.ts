import { getPool } from "../db";
import {
  NO_VERDICT_JUDGEMENTS,
  judgementInputProblem,
  type ProcessItems,
  type Recorded,
  type VerdictJudgementInput,
  type VerdictJudgementKey,
  type VerdictJudgements,
} from "./verdictJudgements";

// ---------------------------------------------------------------------------
// CF-AR5-VERDICT-CONSOLIDATION-01 — migration 013's append-only judgement
// rows. Recording inserts a row; nothing here updates or deletes one. The
// version of an answer is its position in the sequence of rows for its key
// (and, for a close call, for the run inputs it is bound to).
// ---------------------------------------------------------------------------

export class InvalidVerdictJudgementError extends Error {
  constructor(reason: string) {
    super(`This answer cannot be recorded: ${reason}`);
    this.name = "InvalidVerdictJudgementError";
  }
}

export async function recordVerdictJudgement(ticker: string, input: VerdictJudgementInput): Promise<void> {
  const problem = judgementInputProblem(input);
  if (problem !== null) throw new InvalidVerdictJudgementError(problem);
  const note = input.note === null || input.note.trim() === "" ? null : input.note.trim();
  await getPool().query(
    `INSERT INTO analyzer_verdict_judgements (ticker, judgement_key, answer, note, detail, bound_to)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      ticker,
      input.key,
      input.answer,
      note,
      input.key === "PROCESS ITEMS" && input.items !== null ? JSON.stringify(input.items) : null,
      input.key === "CLOSE CALL" ? input.boundTo : null,
    ]
  );
}

interface Row {
  judgement_key: VerdictJudgementKey;
  answer: string;
  note: string | null;
  detail: ProcessItems | null;
  bound_to: string | null;
  recorded_at: Date;
  version: string;
}

/** The answers in force for a company: the latest row per key (per bound inputs for a close call), with its version. */
export async function getVerdictJudgements(ticker: string): Promise<VerdictJudgements> {
  const { rows } = await getPool().query<Row>(
    `SELECT judgement_key, answer, note, detail, bound_to, recorded_at, version
       FROM (
         SELECT *,
                ROW_NUMBER() OVER (PARTITION BY judgement_key, bound_to ORDER BY id) AS version,
                ROW_NUMBER() OVER (PARTITION BY judgement_key, bound_to ORDER BY id DESC) AS recency
           FROM analyzer_verdict_judgements
          WHERE ticker = $1
       ) ranked
      WHERE recency = 1
      ORDER BY judgement_key, bound_to`,
    [ticker]
  );
  if (rows.length === 0) return NO_VERDICT_JUDGEMENTS;

  const recorded = <T>(r: Row): Recorded<T> => ({
    answer: r.answer as T,
    note: r.note,
    recordedAt: new Date(r.recorded_at).toISOString(),
    version: Number(r.version),
  });
  const one = (key: VerdictJudgementKey) => rows.find((r) => r.judgement_key === key);

  const uncertainty = one("UNCERTAINTY LEVEL");
  const thesis = one("THESIS STATE");
  const management = one("MANAGEMENT RATING");
  const moat = one("MOAT MECHANISM");
  const process = one("PROCESS ITEMS");
  return {
    uncertainty: uncertainty === undefined ? null : recorded(uncertainty),
    closeCalls: rows
      .filter((r) => r.judgement_key === "CLOSE CALL" && r.bound_to !== null)
      .map((r) => ({ ...recorded<"BUY" | "HOLD" | "SELL">(r), boundTo: r.bound_to as string })),
    thesis: thesis === undefined ? null : recorded(thesis),
    management: management === undefined ? null : recorded(management),
    moatMechanism: moat === undefined ? null : recorded(moat),
    processItems: process === undefined ? null : { ...recorded<"adopted">(process), items: process.detail },
  };
}
