import { secClientFromEnv, cikForTicker } from "./acquisition/secClient";
import type { CompanyTickerDirectory, SubmissionsDocument } from "./acquisition/secClient";

// ---------------------------------------------------------------------------
// §2 rule 1a / acceptance criterion A28 — the Step 1 filing-history check.
//
// Deliberately NOT the M8 acquisition pipeline (acquisition/provider.ts). That
// pipeline pulls the full companyfacts XBRL payload, which this must not do:
// Step 1 has to answer before any fact is acquired, and cheaply enough to run
// on every resolution. This reads EDGAR's submissions index only — the list
// of filings a registrant has made — never the tagged facts inside them.
//
// Every filer's registrant relationship is fixed by CIK; Calboard does not
// follow a company's history to a predecessor registrant after a
// reorganisation (spec §2 rule 1a), so a ticker absent from the SEC's own
// ticker directory is treated the same as one present with no annual filing:
// there is nothing under this registrant to take apart.
// ---------------------------------------------------------------------------

export type FilingHistoryCheck = "PRESENT" | "ABSENT" | "UNAVAILABLE";

const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "20-F", "40-F"]);

// The refusal exists to avoid burning a full acquisition on a registrant with
// no filings; it must not itself add a network round trip to every analysis.
// Step 1 re-resolves on both blur and Begin analysis (analyzer.ts), so the
// same ticker is checked twice in the ordinary path.
const TTL_MS = 15 * 60 * 1000;

interface CacheEntry {
  at: number;
  value: FilingHistoryCheck;
}

const cache = new Map<string, CacheEntry>();

/** Test seam and cache reset. Never called by application code. */
export function __resetFilingHistoryCache(): void {
  cache.clear();
}

/**
 * The two EDGAR reads this check needs, factored out so tests can inject a
 * stub directly rather than mocking `fetch` or `SEC_USER_AGENT` — the same
 * reason `SecClient` itself takes an injectable `fetchImpl`.
 */
export interface FilingHistoryDeps {
  companyTickers: () => Promise<CompanyTickerDirectory>;
  submissions: (cik: string) => Promise<SubmissionsDocument>;
}

function defaultDeps(): FilingHistoryDeps {
  const client = secClientFromEnv();
  return {
    companyTickers: () => client.companyTickers(),
    submissions: (cik) => client.submissions(cik),
  };
}

/**
 * Whether a ticker's registrant has ever filed an annual report.
 *
 * UNAVAILABLE on anything that stops the lookup completing — a missing
 * SEC_USER_AGENT, a network failure, a rate limit, an unrecognisable
 * response. Never asserted as ABSENT: "EDGAR says no annual filings" and
 * "EDGAR could not be reached" are different outcomes, and collapsing them
 * would render a transient failure as a permanent refusal (§2 rule 1a
 * authorisation, 14 Sep 2026). Fail closed — if filing history cannot be
 * established, its absence is never asserted.
 */
export async function checkAnnualFilingHistory(
  ticker: string,
  deps?: FilingHistoryDeps
): Promise<FilingHistoryCheck> {
  const key = ticker.trim().toUpperCase();
  const hit = cache.get(key);
  if (hit !== undefined && Date.now() - hit.at < TTL_MS) return hit.value;

  const value = await lookup(key, deps);
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function lookup(ticker: string, deps?: FilingHistoryDeps): Promise<FilingHistoryCheck> {
  try {
    // Constructed here, inside the try, so a missing SEC_USER_AGENT — which
    // secClientFromEnv throws on synchronously — fails closed like every
    // other lookup failure rather than escaping uncaught.
    const { companyTickers, submissions } = deps ?? defaultDeps();

    const directory = await companyTickers();
    const found = cikForTicker(directory, ticker);
    if (found === null) return "ABSENT";

    const doc = await submissions(found.cik);
    const forms = doc.filings?.recent?.form;
    // An unrecognisable submissions document answers nothing about filing
    // history; treated as UNAVAILABLE rather than read as an empty list.
    if (forms === undefined) return "UNAVAILABLE";

    return forms.some((form) => ANNUAL_FORMS.has(form)) ? "PRESENT" : "ABSENT";
  } catch {
    return "UNAVAILABLE";
  }
}
