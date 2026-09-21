import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import Decimal from "decimal.js";
import { secClientFromEnv, cikForTicker, type SecClient } from "./secClient";
import type { CompanyFactsDocument, SubmissionsDocument } from "./secClient";
import { acquire, type AcquisitionResult, type PriceQuote } from "./acquire";
import { runCrossChecks, assertEveryInputReported, type CrossCheckReport } from "../crosschecks/run";
import { extractItem1 } from "./item1Extraction";
import type { BusinessSectionContent } from "../types";

// ---------------------------------------------------------------------------
// Where a run's facts come from.
//
// One function, so there is exactly one answer to "what did this run acquire
// and from where". The result carries its own provenance note, which is
// rendered to the analyst rather than kept in a log — a run must never be
// ambiguous about whether it touched the network.
//
// FAIL-CLOSED on configuration: with no SEC_USER_AGENT this raises rather than
// quietly reading the committed capture. A silent fall back to captured data
// would make a stale fact set indistinguishable from a fresh one, which is the
// §3.4 staleness question answered wrongly by default.
// ---------------------------------------------------------------------------

export interface AcquiredCompany {
  acquisition: AcquisitionResult;
  companyFacts: CompanyFactsDocument;
  crossChecks: CrossCheckReport;
  /** Fact ids a cross-check failed on — forced into the queue (§3.8.2). */
  crossCheckFailedFactIds: Set<string>;
  /**
   * The SEC-assigned SIC CODE, e.g. "7372". §6.1's sector and industry tests
   * are looked up from this, not from the description beside it: no
   * sicDescription is ever "Financials" or "Mining", so matching the
   * description against the gate's vocabulary never fires.
   */
  sic: string | null;
  sicDescription: string | null;
  /**
   * M9-ITEM5-CONTENT-01 — the Business section's sourced content: the
   * filer's own 10-K Item 1, via `SecClient.filingDocument` and the fixed
   * extraction rule in item1Extraction.ts. Never fetched a second time or
   * substituted between LIVE and CAPTURE the same way every other fact
   * here isn't — see fromEdgar/fromCapture below.
   */
  business: BusinessSectionContent;
  provenanceNote: string;
}

export type AcquisitionSource = "EDGAR" | "CAPTURE";

interface CacheEntry {
  at: number;
  value: AcquiredCompany;
}

// A run's facts are fetched once and reused for the life of the process. EDGAR
// publishes a rate ceiling and a report page re-rendering on every navigation
// would spend the budget on figures that cannot have changed.
const TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

/** Test seam and cache reset. Never called by application code. */
export function __resetAcquisitionCache(): void {
  cache.clear();
}

export function captureFor(ticker: string): CompanyFactsDocument | null {
  const path = join(
    process.cwd(),
    "lib",
    "analyzer",
    "acquisition",
    "captures",
    `${ticker.toLowerCase()}-companyfacts.json`
  );
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as CompanyFactsDocument;
}

export interface AcquireOptions {
  price: PriceQuote | null;
  /**
   * CAPTURE reads the committed capture instead of calling EDGAR. Explicit and
   * never a fallback: the caller asks for it, and the provenance note says so.
   */
  source?: AcquisitionSource;
  acquiredAt?: string;
}

export async function acquireCompany(
  ticker: string,
  options: AcquireOptions
): Promise<AcquiredCompany> {
  const key = `${ticker.toUpperCase()}|${options.source ?? "EDGAR"}|${options.price?.timestamp ?? "no-price"}`;
  const hit = cache.get(key);
  if (hit !== undefined && Date.now() - hit.at < TTL_MS) return hit.value;

  const value =
    options.source === "CAPTURE"
      ? fromCapture(ticker, options)
      : await fromEdgar(ticker, options);

  cache.set(key, { at: Date.now(), value });
  return value;
}

function assemble(
  ticker: string,
  cik: string,
  companyName: string,
  companyFacts: CompanyFactsDocument,
  // Both halves travel together so neither path can carry one without the
  // other: the code is what §6.1 looks up, the description is what the analyst
  // reads, and a run showing one with the other missing would be telling the
  // screen and the gate different things.
  classification: { sic: string | null; sicDescription: string | null },
  business: BusinessSectionContent,
  provenanceNote: string,
  options: AcquireOptions
): AcquiredCompany {
  const acquisition = acquire({
    ticker: ticker.toUpperCase(),
    cik,
    companyName,
    companyFacts,
    price: options.price,
    acquiredAt: options.acquiredAt,
  });

  const crossChecks = runCrossChecks(acquisition.ticker, acquisition.crossCheckFacts, {
    ranAt: acquisition.acquiredAt,
  });
  // Raises rather than returning a partial report. §3.8.2 wants an outcome for
  // every input; a suite that skipped one has a defect, not a finding.
  assertEveryInputReported(crossChecks);

  return {
    acquisition,
    companyFacts,
    crossChecks,
    crossCheckFailedFactIds: new Set(crossChecks.failedFactIds),
    sic: classification.sic,
    sicDescription: classification.sicDescription,
    business,
    provenanceNote,
  };
}

const CAPTURE_BUSINESS_CONTENT: BusinessSectionContent = {
  narrative: null,
  unavailableReason:
    "10-K Item 1 excerpts are not part of the committed SEC capture — this run reads captured XBRL facts " +
    "only, and the extraction rule requires a live EDGAR filing-document fetch. Chosen as the honest empty " +
    "state for CAPTURE runs rather than extending the capture shape (M9-ITEM5-CONTENT-01 SCOPE item 3).",
};

function fromCapture(ticker: string, options: AcquireOptions): AcquiredCompany {
  const doc = captureFor(ticker);
  if (doc === null) throw new Error(`No committed capture for ${ticker}`);
  const meta = (
    doc as CompanyFactsDocument & {
      __capture?: {
        cik?: string;
        capturedAt?: string;
        sic?: string | null;
        sicDescription?: string | null;
      };
    }
  ).__capture;

  return assemble(
    ticker,
    meta?.cik ?? String(doc.cik).padStart(10, "0"),
    doc.entityName,
    doc,
    // The classification the capture recorded, from the same submissions
    // endpoint the live path reads. This used to be a hard-coded null, which
    // meant the whole test suite ran against a Gate 0 that had failed closed
    // and could not have caught any defect in the populated path.
    { sic: meta?.sic ?? null, sicDescription: meta?.sicDescription ?? null },
    CAPTURE_BUSINESS_CONTENT,
    `Committed SEC capture, taken ${meta?.capturedAt ?? "at an unrecorded time"}. ` +
      `Real filing data, not live — figures are as at the capture, not as at now.`,
    options
  );
}

/**
 * The latest filing of a given form from `submissions()`'s "recent" arrays,
 * which EDGAR returns most-recent-first — the first match in a forward scan
 * is therefore the latest. Returns null where the shape is missing or the
 * form does not appear, rather than guessing at a different one.
 */
function latestFormFiling(
  submissions: SubmissionsDocument,
  form: string
): { accessionNumber: string; filingDate: string; primaryDocument: string; form: string } | null {
  const recent = submissions.filings?.recent;
  if (!recent?.form || !recent.accessionNumber || !recent.filingDate || !recent.primaryDocument) return null;

  for (let i = 0; i < recent.form.length; i++) {
    if (recent.form[i] !== form) continue;
    const accessionNumber = recent.accessionNumber[i];
    const filingDate = recent.filingDate[i];
    const primaryDocument = recent.primaryDocument[i];
    if (accessionNumber && filingDate && primaryDocument) {
      return { accessionNumber, filingDate, primaryDocument, form };
    }
  }
  return null;
}

/**
 * The Business section's sourced content, live only — SCOPE item 1: the
 * filer's own latest 10-K Item 1, through the existing EDGAR client's
 * filing-document surface, under item1Extraction.ts's fixed rule.
 *
 * Never throws: a failure here (no 10-K found, document fetch failed, the
 * extraction rule refused) is recorded as an honest unavailable reason, the
 * same way a failed classification lookup leaves sic/sicDescription null
 * rather than failing the whole acquisition — Business is presentational,
 * not a REQUIRED input any gate or module depends on.
 */
async function businessNarrativeFrom(
  client: SecClient,
  cik: string,
  submissions: SubmissionsDocument
): Promise<BusinessSectionContent> {
  const latest10K = latestFormFiling(submissions, "10-K");
  if (latest10K === null) {
    return {
      narrative: null,
      unavailableReason: "No 10-K filing appears in this company's recent SEC submissions.",
    };
  }

  try {
    const filingHtml = await client.filingDocument(cik, latest10K.accessionNumber, latest10K.primaryDocument);
    const extracted = extractItem1(filingHtml);
    if (!extracted.ok) {
      return {
        narrative: null,
        unavailableReason:
          `The Item 1 extraction rule (${extracted.ruleVersion}) could not locate the section in the ` +
          `filing: ${extracted.reason}.`,
      };
    }
    return {
      narrative: {
        text: extracted.text,
        ruleVersion: extracted.ruleVersion,
        filingForm: latest10K.form,
        filingDate: latest10K.filingDate,
        accessionNumber: latest10K.accessionNumber,
      },
      unavailableReason: null,
    };
  } catch (err) {
    return {
      narrative: null,
      unavailableReason: `The 10-K filing document could not be fetched (${err instanceof Error ? err.message : String(err)}).`,
    };
  }
}

async function fromEdgar(ticker: string, options: AcquireOptions): Promise<AcquiredCompany> {
  const client = secClientFromEnv();
  const directory = await client.companyTickers();
  const found = cikForTicker(directory, ticker);
  if (found === null) {
    throw new Error(`${ticker} is not in the SEC ticker directory`);
  }

  const companyFacts = await client.companyFacts(found.cik);

  let classification: { sic: string | null; sicDescription: string | null } = {
    sic: null,
    sicDescription: null,
  };
  let business: BusinessSectionContent = {
    narrative: null,
    unavailableReason:
      "The SEC submissions lookup that names the company's filings did not complete, so no 10-K could be located.",
  };
  try {
    const submissions: SubmissionsDocument = await client.submissions(found.cik);
    classification = {
      sic: submissions.sic ?? null,
      sicDescription: submissions.sicDescription ?? null,
    };
    // A failure inside businessNarrativeFrom resolves to an unavailable
    // reason rather than throwing, so it cannot fall into this catch and
    // wrongly null out a classification that DID succeed.
    business = await businessNarrativeFrom(client, found.cik, submissions);
  } catch {
    // Gate 0 fails closed on a missing classification (§5.3, §6.1). A failed
    // lookup leaves both null; neither may default to something classifiable.
    classification = { sic: null, sicDescription: null };
  }

  return assemble(
    ticker,
    found.cik,
    found.title,
    companyFacts,
    classification,
    business,
    `Live SEC EDGAR, fetched ${new Date().toISOString()}`,
    options
  );
}

/** A price quote in the shape acquisition wants. */
export function priceQuote(value: Decimal, timestamp: string, source: string): PriceQuote {
  return { value, timestamp, source };
}
