# Cal Finance

**Cal Finance is my personal investing and financial-analysis workspace.**

It started as a portfolio tracker and has grown into a broader system for understanding what I own, analysing companies, testing investment ideas, and keeping the reasoning behind decisions in one place.

> **Cal Finance does not place trades.** Your broker remains the source of truth for buying and selling. Cal Finance is a read-only intelligence layer on top.

Local-only, single-user, and not financial advice.

---

## What it does

### Portfolio

- tracks holdings, value, cost basis and unrealised gain/loss
- shows allocation and price freshness
- keeps portfolio accounting in USD
- uses an append-only transaction ledger

### Stock Analyzer

- pulls and reconciles company data
- runs deterministic financial calculations
- supports valuation and scenario analysis
- adds an AI interpretation layer without letting AI alter the underlying calculations
- runs a separate blind-challenger pass to question the analysis

### Research + decision support

Cal Finance is being built toward a simple flow:

**Stock Analyzer → Research Memory → What Changed? → Portfolio decision logic → human decision**

The system is designed to help surface evidence and reasoning, not make investment decisions on its own.

---

## Screenshots

![Cal Finance dashboard showing portfolio value, allocation, and holdings summary](docs/images/dashboard.png)

*Portfolio dashboard — demonstration data, not real holdings.*

![Cal Finance holdings editor showing a form for adding and editing a position](docs/images/holdings-editor.png)

*Holdings editor — demonstration data, not real holdings.*

---

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Docker](https://www.docker.com/)
- npm

### 1. Install dependencies

```bash
npm install
npx playwright install chromium
```

Playwright is needed by the evidence runner and its self-test. Without the Chromium install, both `npm test` and `npm run evidence` can fail on a fresh clone.

### 2. Start Postgres

```bash
docker compose up -d
```

This starts Postgres 16 on `127.0.0.1:5432` using the existing local development database and credentials defined in `docker-compose.yml`.

The internal database identifiers still use the historical `calboard` name. They are stable technical identifiers and are not being renamed just for branding.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Local development database. |
| `TEST_DATABASE_URL` | Yes, for tests | Must point to a database whose name ends in `_test`. |
| `MARKET_DATA_PROVIDER` | No | `YAHOO` by default, or `EODHD`. |
| `EODHD_API_KEY` | Only for EODHD | Yahoo Finance needs no API key. |
| `SEC_USER_AGENT` | Yes, for analyzer acquisition | EDGAR requires an identifying User-Agent. |
| `ANALYZER_OFFLINE` | No | Set to `1` to use committed SEC captures and recorded quotes only. |
| `ANTHROPIC_API_KEY` | Only for AI prose | Runs interpretation + blind challenger. Calculated values do not depend on it. |
| `ALPACA_API_KEY_ID`, `ALPACA_API_SECRET_KEY`, `RENDER_API_KEY` | No | Reserved for future milestones. |

### 4. Create the test database

```bash
docker exec -i $(docker compose ps -q postgres) psql -U calboard -d calboard -c "CREATE DATABASE calboard_test;"
```

### 5. Run migrations

Development database:

```bash
npm run migrate
```

Test database — macOS/Linux:

```bash
export DATABASE_URL=$(grep '^TEST_DATABASE_URL=' .env.local | cut -d '=' -f2-)
npm run migrate
```

PowerShell:

```powershell
$env:DATABASE_URL = (Get-Content .env.local | Select-String '^TEST_DATABASE_URL=').Line.Split('=',2)[1]
npm run migrate
```

### 6. Run the app

```bash
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

### 7. Run one analyzer from the CLI

```bash
npm run ai-run -- MSFT
```

This drives one company through the same analyzer path used by the app and prints the interpretation, report copy and challenger findings.

---

## Testing

```bash
npm test
```

Tests use a real Postgres test database and truncate tables between runs.

`vitest.setup.ts` refuses to run unless the database name ends in `_test`, preventing a normal test run from wiping the development portfolio database.

---

## Architecture

**Current shape: modular monolith.**

A single Next.js application contains the UI, server actions and data access, backed by PostgreSQL.

```text
app/          Next.js App Router, UI and server actions
lib/          domain logic, portfolio, market data and analyzer code
migrations/   ordered handwritten SQL migrations
docs/         technical/design documentation and evidence
```

### Market data

All equity/ETF market data goes through a `MarketDataProvider` abstraction rather than being coupled directly to a vendor.

Current adapters:

- Yahoo Finance — default
- EODHD — optional

Cryptocurrency identity uses a separate verified symbol registry rather than trusting a bare ticker.

### Accounting model

- USD is the accounting source of truth.
- Transactions are append-only.
- Corrections use explicit reversal transactions rather than editing history.
- Average cost is recalculated from the transaction history.

---

## Analyzer trust boundary

The analyzer deliberately separates **calculation** from **AI interpretation**.

```text
source data
→ deterministic calculations
→ structured analysis result
→ AI interpretation
→ blind challenger
```

The AI layer can explain or challenge the result, but it cannot change the calculated values underneath it.

This separation is one of the core design principles of Cal Finance.

---

## Design evidence runner

```bash
npm run evidence
```

The evidence runner captures the analyzer UI for isolated design review so a reviewer does not need direct access to the local app.

It:

- checks frozen design/spec artefacts
- verifies the app and analyzer database are reachable
- drives the reachable analyzer states
- captures screenshots at multiple widths
- records computed-style evidence
- runs mechanical preflight checks
- produces a manifest + ZIP under `.evidence/`

Possible results:

- **PASS** — every measurable check passed
- **FAIL** — something measurable failed
- **UNKNOWN** — a check could not be completed safely

`UNKNOWN` is intentionally different from `FAIL`.

At present, Screen 1's UNAVAILABLE state has no safe runtime seam, so an evidence run can still end `UNKNOWN` even when everything it could verify passed.

Self-test:

```bash
npm run evidence -- --self-test
```

The runner reports problems; it does not silently fix application code or change runs it creates.

---

## Important engineering notes

### Instrument identity is separate from price availability

A valid ticker is not inferred from whether a price request happened to succeed.

The provider classifies instruments as:

- `resolved`
- `unknown`
- `unsupported`
- `unavailable`

That prevents network/provider failures from being mistaken for invalid symbols, and prevents unknown symbols from being added just because the user overrides a price warning.

Crypto identity is similarly resolved through a verified registry. This was introduced after an earlier BTC ticker collision exposed why identity and price lookup must stay separate.

---

## Naming

The current product/project name is **Cal Finance**.

Some older technical identifiers still use the previous **Calboard** name, including database names and existing `CB-*` / `CALBOARD-*` workflow identifiers. Those remain stable compatibility identifiers unless there is a real technical reason to migrate them.

In short:

```text
Cal Finance      current product/project name
Cal-Finance      GitHub repository
calboard         legacy internal database identifier
CB-*             legacy/stable outcome identifiers
CALBOARD-*       legacy/stable workflow/routine identifiers
```

---

## Status

Cal Finance is actively being developed as a local, single-user personal investing tool.

It does not execute trades and does not provide financial advice. The final investment decision remains human.