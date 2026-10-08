import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import Decimal from "decimal.js";
import { secClientFromEnv, cikForTicker, type SecClient } from "./secClient";
import type { CompanyFactsDocument, CompanyTickerDirectory, SubmissionsDocument } from "./secClient";
import { acquire, type AcquisitionResult, type PriceQuote } from "./acquire";
import { runCrossChecks, assertEveryInputReported, type CrossCheckReport } from "../crosschecks/run";
import { extractItem1 } from "./item1Extraction";
import type { BusinessSectionContent, LatestFiling } from "../types";
import { isMaterialFilingForm } from "../materialFilings";
import { activeProvider } from "../../marketdata";

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
  /** CF-ANALYZER-V1-SETTLE-01 — see `LatestFiling`'s own doc comment. */
  latestFiling: LatestFiling | null;
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

// CF-ANALYZER-USABLE-REPORT-REPAIR-01 — the ticker->CIK directory is the
// SAME multi-MB document for every company and ticker, so it does not
// belong keyed per-ticker the way `cache` above is. It was being re-fetched
// in full on every acquisition-cache miss (a fresh process, a 15-minute TTL
// expiry, or a different price timestamp — see acquireCompany's cache key)
// even when nothing about the directory itself could have changed in that
// time. Same TTL, same one-entry-per-process reasoning as `cache`, just one
// shared key instead of one per ticker.
let tickerDirectoryCache: { at: number; value: CompanyTickerDirectory } | null = null;

async function cachedCompanyTickers(client: SecClient): Promise<CompanyTickerDirectory> {
  if (tickerDirectoryCache !== null && Date.now() - tickerDirectoryCache.at < TTL_MS) {
    return tickerDirectoryCache.value;
  }
  const value = await client.companyTickers();
  tickerDirectoryCache = { at: Date.now(), value };
  return value;
}

/** Test seam and cache reset. Never called by application code. */
export function __resetAcquisitionCache(): void {
  tickerDirectoryCache = null;
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
  latestFiling: LatestFiling | null,
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
    latestFiling,
    provenanceNote,
  };
}

/**
 * CF-ANALYZER-V1-SETTLE-01 — the most recent MATERIAL filing (a periodic or
 * current report, lib/analyzer/materialFilings.ts) from `submissions()`'s
 * "recent" arrays. EDGAR returns that list most-recent-first across every
 * form mixed together (the same ordering `latestFormFiling` relies on), so
 * the first well-formed material entry is the latest one. The 7 Oct 2026
 * live proof (run 37566908890) showed why "any form" was wrong: MSFT's
 * latest filing was a Form 4 insider transaction, which the Overview then
 * presented as the company's latest development. Null where none of the
 * recent filings is material.
 */
export function latestMaterialFiling(submissions: SubmissionsDocument): LatestFiling | null {
  const recent = submissions.filings?.recent;
  if (!recent?.form || !recent.filingDate || recent.form.length === 0) return null;

  for (let i = 0; i < recent.form.length; i++) {
    const form = recent.form[i];
    const filingDate = recent.filingDate[i];
    if (form && filingDate && isMaterialFilingForm(form)) return { form, filingDate };
  }
  return null;
}

/** Fetches the market-data provider's company summary; null on any failure. */
export type BusinessSummaryFetcher = (ticker: string) => Promise<{ text: string; provider: string } | null>;

const providerBusinessSummary: BusinessSummaryFetcher = async (ticker) => {
  const provider = activeProvider();
  const summary = await provider.fetchBusinessSummary?.(ticker);
  return summary == null ? null : { text: summary.text, provider: provider.sourceName };
};

/**
 * CF-ANALYZER-V1-SETTLE-01 — CALVIN RULING (PR #399, comment 5952716764),
 * SOURCE / FALLBACK RULE: "business / risk description → filing / company
 * IR; provider summary fallback if needed".
 *
 * The filer's own 10-K Item 1 excerpt stays the primary source and is
 * returned untouched whenever it exists. Only where it could not be
 * produced is the market-data provider's company summary used instead —
 * labelled as such, and carrying the primary path's own recorded reason
 * verbatim, so the report and the live proof always say which source was
 * used and why the filing was not. Live acquisition only; a CAPTURE run
 * never reaches this. Never throws: a provider failure leaves the honest
 * unavailable reason, extended to say the fallback failed too.
 */
export async function withProviderBusinessSummary(
  ticker: string,
  primary: BusinessSectionContent,
  fetchSummary: BusinessSummaryFetcher = providerBusinessSummary,
  now: () => Date = () => new Date()
): Promise<BusinessSectionContent> {
  if (primary.narrative !== null) return primary;
  const primaryUnavailableReason =
    primary.unavailableReason ?? "The filer's 10-K Item 1 excerpt could not be produced.";

  let summary: { text: string; provider: string } | null = null;
  try {
    summary = await fetchSummary(ticker);
  } catch {
    summary = null;
  }
  if (summary === null || summary.text.trim() === "") {
    return {
      narrative: null,
      unavailableReason: `${primaryUnavailableReason} The market-data provider's company summary was not available either.`,
    };
  }
  return {
    narrative: {
      source: "MARKET-DATA PROVIDER SUMMARY",
      text: summary.text.trim(),
      provider: summary.provider,
      retrievedAt: now().toISOString(),
      primaryUnavailableReason,
    },
    unavailableReason: null,
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
    // No submissions/filings index is part of the committed capture (only
    // XBRL company facts) — honestly null, same reasoning as
    // CAPTURE_BUSINESS_CONTENT above, not a new capture shape.
    null,
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
  const directory = await cachedCompanyTickers(client);
  const found = cikForTicker(directory, ticker);
  if (found === null) {
    throw new Error(`${ticker} is not in the SEC ticker directory`);
  }

  // companyFacts and submissions each depend only on `found.cik`, never on
  // each other's result, so there is no reason the second must wait for the
  // first's full round trip — that ordering cost every acquisition one
  // request's full latency for nothing. A companyFacts failure still
  // propagates exactly as before (Promise.all rejects with it); a
  // submissions failure is still the one caught below, not a second place
  // this function can throw from.
  const [companyFacts, submissionsOutcome] = await Promise.all([
    client.companyFacts(found.cik),
    client.submissions(found.cik).then(
      (submissions): { ok: true; submissions: SubmissionsDocument } => ({ ok: true, submissions }),
      (err: unknown): { ok: false; err: unknown } => ({ ok: false, err })
    ),
  ]);

  let classification: { sic: string | null; sicDescription: string | null } = {
    sic: null,
    sicDescription: null,
  };
  let business: BusinessSectionContent = {
    narrative: null,
    unavailableReason:
      "The SEC submissions lookup that names the company's filings did not complete, so no 10-K could be located.",
  };
  let latestFiling: LatestFiling | null = null;
  if (submissionsOutcome.ok) {
    try {
      const submissions = submissionsOutcome.submissions;
      classification = {
        sic: submissions.sic ?? null,
        sicDescription: submissions.sicDescription ?? null,
      };
      // A failure inside businessNarrativeFrom resolves to an unavailable
      // reason rather than throwing, so it cannot fall into this catch and
      // wrongly null out a classification that DID succeed.
      business = await businessNarrativeFrom(client, found.cik, submissions);
      latestFiling = latestMaterialFiling(submissions);
    } catch {
      // Gate 0 fails closed on a missing classification (§5.3, §6.1). A failed
      // lookup leaves both null; neither may default to something classifiable.
      classification = { sic: null, sicDescription: null };
    }
  }

  // The approved fallback, applied once here so every consumer of this
  // acquisition (the report and the AI scenario proposal alike) reads the
  // same business content, cached with the rest of the acquisition.
  business = await withProviderBusinessSummary(ticker, business);

  return assemble(
    ticker,
    found.cik,
    found.title,
    companyFacts,
    classification,
    business,
    latestFiling,
    `Live SEC EDGAR, fetched ${new Date().toISOString()}`,
    options
  );
}

/** A price quote in the shape acquisition wants. */
export function priceQuote(value: Decimal, timestamp: string, source: string): PriceQuote {
  return { value, timestamp, source };
}
