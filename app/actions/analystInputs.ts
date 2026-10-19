"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adoptSheet, AdoptionRefusedError, validationContextFor, type SheetAdjustments } from "@/lib/analyzer/sheets/adopt";
import { getSheet } from "@/lib/analyzer/sheets/sheetStore";
import { draftNewSheet } from "@/lib/analyzer/acquisition/analystInputs";
import { DRIVER_KEYS, SCENARIO_KEYS } from "@/lib/analyzer/sheets/sheet";
import type { MoatClass } from "@/lib/analyzer/types";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — the write side of the assumption-sheet page
// (app/analyzer/inputs/[ticker]): adopt (as drafted or adjusted) and redraft.
// Both append a new version (migration 014); neither edits one.
// ---------------------------------------------------------------------------

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function back(ticker: string, runId: string, query: string): string {
  return `/analyzer/inputs/${encodeURIComponent(ticker)}?${query}${runId === "" ? "" : `&run=${encodeURIComponent(runId)}`}`;
}

const MOAT_CLASSES: readonly MoatClass[] = ["none", "narrow", "wide"];

export async function adoptSheetAction(formData: FormData): Promise<void> {
  const ticker = field(formData, "ticker").toUpperCase();
  const runId = field(formData, "runId");
  const sheetId = Number(field(formData, "sheetId"));
  if (ticker === "" || !Number.isInteger(sheetId)) throw new Error("A ticker and a sheet are required");

  const moat = field(formData, "moatClass");
  const adjustments: SheetAdjustments = {
    scenarios: Object.fromEntries(
      SCENARIO_KEYS.map((key) => [key, Object.fromEntries(DRIVER_KEYS.map((d) => [d, field(formData, `${key}.${d}`)]).filter(([, v]) => v !== ""))])
    ),
    moatClass: MOAT_CLASSES.includes(moat as MoatClass) ? (moat as MoatClass) : null,
    nopatTaxRate: field(formData, "nopatTaxRate"),
    stressMarginLevel: field(formData, "stressMarginLevel"),
    note: field(formData, "note") || null,
  };

  const source = await getSheet(sheetId);
  if (source === null) throw new Error(`No assumption sheet ${sheetId}`);
  let adopted;
  try {
    adopted = await adoptSheet(ticker, sheetId, adjustments, await validationContextFor(ticker, source.content));
  } catch (err) {
    if (err instanceof AdoptionRefusedError) redirect(back(ticker, runId, `refused=${encodeURIComponent(err.message)}`));
    throw err;
  }
  if (runId !== "") revalidatePath(`/analyzer/${runId}`);
  redirect(back(ticker, runId, `adopted=${adopted.sheet.version}`));
}

export async function redraftSheetAction(formData: FormData): Promise<void> {
  const ticker = field(formData, "ticker").toUpperCase();
  const runId = field(formData, "runId");
  if (ticker === "") throw new Error("A ticker is required");
  const { sheet, cause } = await draftNewSheet(ticker);
  if (sheet === null) redirect(back(ticker, runId, `refused=${encodeURIComponent(`no new draft: ${cause ?? "no cause recorded"}`)}`));
  redirect(back(ticker, runId, `drafted=${sheet!.version}`));
}
