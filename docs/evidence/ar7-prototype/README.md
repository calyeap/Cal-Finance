# AR7 static prototype — MSFT (issue #455)

Evidence for Calvin's AR7 prototype review. Static HTML only: no application
code, no finance or verdict change, nothing here ships as product behaviour.

| File | What it is |
|---|---|
| `index.html` | The prototype. Open it in a browser; tabs work, controls are disabled. |
| `msft-run.json` | The one real run every figure on the page is read from. |
| `screenshots/` | Overview and Valuation at 32-inch desktop (2560 px), half-window (1280 px) and iPhone (390 px). |

## The run

- One median-of-three, price-blind DRAFT sheet for MSFT, drafted through the
  production drafting path by `claude-opus-5` and valued **unadopted** through
  the production engine — so the verdict reads *Pending adoption, draft reads
  SELL*, exactly what a new ticker shows before Calvin adopts.
- Price: Yahoo latest close $533.52 (19 Oct 2026). Non-operating balance: Calvin's
  recorded #188 decision (`us-gaap:LongTermInvestments`).
- Read-only: nothing was written to any database. No challenger or
  interpretation call was made, so the "Strongest argument against" slot is a
  labelled empty slot rather than invented text.
- Spend: 3 calls, 31,971 input + 13,690 output tokens, **$0.50** against a $1
  hard cap (recorded in `capture.usage`).

## Reproduce

```
ANTHROPIC_API_KEY=… npx tsx scripts/analyzer/export-draft-run.ts MSFT     # paid; writes msft-run.json
npx tsx scripts/analyzer/render-ar7-prototype.ts docs/evidence/ar7-prototype/msft-run.json
npx tsx scripts/analyzer/trace-ar7-prototype.ts                           # every number traces to the run
node scripts/analyzer/shoot-ar7-prototype.mjs "$PWD/docs/evidence/ar7-prototype/index.html" docs/evidence/ar7-prototype/screenshots
```

Rendering, the trace check and screenshots are free and deterministic; only
the export calls the model.
