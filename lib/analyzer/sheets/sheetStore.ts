import { getPool } from "../../db";
import type { AssumptionSheet, SheetContent, SheetOrigin, SheetStatus } from "./sheet";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — the append-only assumption-sheet store
// (migration 014). Every write is an INSERT of the next version; the table's
// trigger refuses UPDATE and DELETE, so no version is ever rewritten.
//
// The sheet IN FORCE for a ticker is its latest ADOPTED version, or, where
// none has been adopted, its latest DRAFT. A draft written after an adoption
// waits beside it until Calvin adopts it; the adopted sheet stays in force.
// ---------------------------------------------------------------------------

interface Row {
  id: string;
  ticker: string;
  version: number;
  status: SheetStatus;
  origin: SheetOrigin;
  content: SheetContent;
  adopted_from: string | null;
  model: string | null;
  recorded_at: Date;
}

function fromRow(r: Row): AssumptionSheet {
  return {
    id: Number(r.id),
    ticker: r.ticker,
    version: r.version,
    status: r.status,
    origin: r.origin,
    content: r.content,
    adoptedFrom: r.adopted_from === null ? null : Number(r.adopted_from),
    model: r.model,
    recordedAt: new Date(r.recorded_at).toISOString(),
  };
}

export function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase();
}

const COLUMNS = "id, ticker, version, status, origin, content, adopted_from, model, recorded_at";

/** Every version for a ticker, oldest first. */
export async function sheetHistory(ticker: string): Promise<AssumptionSheet[]> {
  const { rows } = await getPool().query<Row>(
    `SELECT ${COLUMNS} FROM analyzer_assumption_sheets WHERE ticker = $1 ORDER BY version`,
    [normalizeTicker(ticker)]
  );
  return rows.map(fromRow);
}

/** The latest ADOPTED version, else the latest DRAFT; null where the ticker has no sheet. */
export async function sheetInForce(ticker: string): Promise<AssumptionSheet | null> {
  const { rows } = await getPool().query<Row>(
    `SELECT ${COLUMNS} FROM analyzer_assumption_sheets
      WHERE ticker = $1
      ORDER BY (status = 'ADOPTED') DESC, version DESC
      LIMIT 1`,
    [normalizeTicker(ticker)]
  );
  return rows.length === 0 ? null : fromRow(rows[0]);
}

/** The latest DRAFT version, adopted or not since; null where none exists. */
export async function latestDraft(ticker: string): Promise<AssumptionSheet | null> {
  const { rows } = await getPool().query<Row>(
    `SELECT ${COLUMNS} FROM analyzer_assumption_sheets
      WHERE ticker = $1 AND status = 'DRAFT'
      ORDER BY version DESC
      LIMIT 1`,
    [normalizeTicker(ticker)]
  );
  return rows.length === 0 ? null : fromRow(rows[0]);
}

export async function getSheet(id: number): Promise<AssumptionSheet | null> {
  const { rows } = await getPool().query<Row>(`SELECT ${COLUMNS} FROM analyzer_assumption_sheets WHERE id = $1`, [id]);
  return rows.length === 0 ? null : fromRow(rows[0]);
}

export interface NewSheet {
  ticker: string;
  status: SheetStatus;
  origin: SheetOrigin;
  content: SheetContent;
  adoptedFrom?: number | null;
  model?: string | null;
}

/**
 * Appends the ticker's next version and returns it. Two writers racing for
 * the same version collide on UNIQUE (ticker, version); the loser retries on
 * the next number, so neither write is lost.
 */
export async function appendSheet(sheet: NewSheet): Promise<AssumptionSheet> {
  const ticker = normalizeTicker(sheet.ticker);
  if (ticker === "") throw new Error("A ticker is required");
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { rows } = await getPool().query<Row>(
        `INSERT INTO analyzer_assumption_sheets (ticker, version, status, origin, content, adopted_from, model)
         SELECT $1, COALESCE(MAX(version), 0) + 1, $2, $3, $4, $5, $6
           FROM analyzer_assumption_sheets WHERE ticker = $1
         RETURNING ${COLUMNS}`,
        [ticker, sheet.status, sheet.origin, JSON.stringify(sheet.content), sheet.adoptedFrom ?? null, sheet.model ?? null]
      );
      return fromRow(rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code !== "23505") throw err;
    }
  }
  throw new Error(`could not append an assumption sheet for ${ticker}: the version kept colliding`);
}
