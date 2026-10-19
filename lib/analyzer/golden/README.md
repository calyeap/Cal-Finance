# Golden facts — shape reference

Not consumed by code; a human-readable companion to the JSON files in this
directory, written because the JSON itself carries no comments. See
`goldenFacts.test.ts` for the actual schema assertions.

Each `<ticker>.json` file has:

```
{
  "ticker": string,
  "cik": string,                // zero-padded 10-digit CIK, as SEC uses it
  "entityName": string,         // from the real companyfacts capture
  "sic": string,
  "sicDescription": string,
  "classification": {
    "cyclicality": "cyclical" | "stable" | "unclassified",
    "preRevenue": boolean,
    "refused": boolean,
    "reason": string            // why, in plain language
  },
  "provenance": {
    "source": string,           // which data.sec.gov endpoint, fetched how
    "capturedAt": string,       // ISO date this harness ran, not SEC's own date
    "pageCitationNote": string  // the honest page-number substitution (see CLAUDE.md escalation)
  },
  "facts": {
    "<factKey>": {
      "conceptLabel": string,      // XBRL element's official label
      "xbrlConcept": string,       // e.g. "us-gaap:NetIncomeLoss"
      "value": number | null,
      "unit": string,
      "periodStart": string | null,
      "periodEnd": string,
      "accessionNumber": string,
      "form": string,
      "fiscalYear": number,
      "note": string | null        // any caveat specific to this fact (tag drift, composition, absence)
    } | null                       // null when genuinely unavailable, with a sibling "...Note" field saying why
  },
  "price": { "value": number, "date": string, "source": string } | null,
  "priceNote": string | null,
  "notes": string[]                // company-level narrative notes (tag drift, structural refusal, etc.)
}
```

## Running the harness

```
TEST_DATABASE_URL=postgres://localhost:5432/calfinance_test npx vitest run lib/analyzer/golden
```

The golden tests are pure and never touch the database, but `vitest.setup.ts`
refuses to start any test run unless `TEST_DATABASE_URL` names a `*_test`
database. The URL only has to parse with a `_test` database name; for these
tests the database does not need to exist. CI sets it already, so `npm test`
there runs the harness unchanged.

## Total debt

CF-LEG2-KO-GOLDEN-DEBT-01 (issue #485). Every golden `facts.totalDebt` uses
one definition:

```
total debt = short-term borrowings          (commercial paper, loans and notes payable, other short-term borrowings)
           + current maturities of long-term debt
           + long-term debt                 (excluding current maturities)
           + finance leases presented as debt
```

"Finance leases presented as debt" means lease obligations the filer reports
inside its debt lines (the lease-inclusive `LongTermDebtAndCapitalLeaseObligations`
elements NUE and KO use) or as a separate debt line. A
`FinanceLeaseLiability` reported outside the debt lines is not part of total
debt: the engine carries it as the separate `finance-lease-liabilities` input
to the EV bridge (`lib/analyzer/acquisition/tagMap.ts`).

Each non-null `totalDebt` lists the lines it adds up:

```
"presentedLines": [
  { "covers": ["shortTermBorrowings" | "currentMaturities" | "longTermDebt" | "financeLeases", ...],
    "conceptLabel": string, "xbrlConcept": "us-gaap:...", "value": number }
],
"notPresented": { "<term>": string }   // why a term has no line
```

`debtDefinition.test.ts` asserts that the value equals the sum of the lines,
that every term has either a line or a reason, and that no short-term
borrowing tagged at the same instant and accession in the pinned AR6 capture
(`lib/analyzer/acquisition/captures/ar6-2026-10-18`) is missing.
