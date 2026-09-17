# Fable routine simplification

Applied from the 17 Sep 2026 read-only routine audit.

Critical-path target:

`issue -> BUILD -> PR -> REVIEW -> ACCEPT/CORRECT/CALVIN REQUIRED`

Changes:

- BUILD no longer hard-gates on Notion procedures, tooling inventory, claim branches, or broad target discovery.
- BUILD must always post a terminal result.
- REVIEW judges the exact PR head against the linked GitHub task contract without hard Notion procedure gates.
- OWNER is parked outside the critical path.
- `cc-auto-fire.yml` only fires BUILD and REVIEW labels.
- the independent workflow verifier is removed from normal Cal Finance execution.
- CHIEF-OF-STAFF-WATCH is projection-only in its Notion procedure; it no longer dispatches or recovers work.

Acceptance proof: rerun `CF-V2-PROOF-01` and require a visible BUILD terminal result; if a PR is produced, run one fresh REVIEW cycle against the exact head.
