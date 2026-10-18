OUTCOME-ID: `CF-LEG2-PREAR4-REPORT-CRASH-01`
TIER: NORMAL

## Authority
Calvin's GO (18 Oct 2026) for KAIZEN Proof Leg 2. The defect was found by the Leg-1 independent replay and re-verified present on master (`a2e9ae2`/`f7498c4`). Reproduce first (RED), then fix (GREEN). If it does not reproduce on current master, stop with the evidence; that is a valid outcome.

## OUTCOME
A run output stored before AR4 renders without crashing.

## Evidence
- `app/components/AnalyzerReport.tsx:767` renders `r={pct(c.rate)}`. AR4 changed `RonicLadderCell.rate` to `Decimal`.
- `fromStorable` (`lib/analyzer/storable.ts`) revives only values tagged `__decimal__`. An output stored before AR4 therefore brings back `rate: 0.08` as a plain number.
- `pct` then throws `TypeError: value.mul is not a function`.
- Two paths read outputs exactly as stored, never recomputed, and both crash for an output stored before AR4:
  - every saved version (`app/analyzer/[runId]/snapshot/[version]/page.tsx`);
  - the stored output of any existing run (`reportAnalysis.ts` `storedRunOutput`, the Financials tab).
- The independent replay reproduced the crash with an old-shape MSFT result rendered through `AnalyzerReport`. `AnalyzerOverview`, `QuickRead` and `deriveVerdict` passed on the same input.

## DO
1. Add a RED test that renders a pre-AR4-shaped stored result (JSON passed through `fromStorable`) through `AnalyzerReport`. It must fail today with this TypeError.
2. Make the smallest fix so that shape renders correctly.
3. Check every other surface that reads stored outputs against the same old shape: `AnalyzerOverview`, `QuickRead`, `deriveVerdict`, `ai/slots.ts`, `briefAcceptance.ts`.
   - Fix only a crash or a wrong render.
   - List any degraded but honest state in the PR.

## VERIFY
- The RED test turns GREEN for the reported reason.
- The same old-shape fixture passes through every surface in DO 3.
- `npx tsc --noEmit` is clean.
- `npm test` is green on the exact head.

## DO NOT
- Do not change valuation outputs, AR4 rules, the storage format of new outputs, or migrations.
- Do not touch PR #466 or #454.

## DONE WHEN
- One PR is open with CI green on the exact head.
- A fresh independent REVIEW returns ACCEPT.
- The existing workflow merges it.

**Recovery:** revert.

## ESCALATE ONLY IF
Fixing it requires changing what an existing stored output means.
