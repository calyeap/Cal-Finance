// scripts/evidence/config.ts

export const WIDTHS = [720, 1024, 1440] as const;

export const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

/** Frozen artefacts, byte-exact. A missing file is a STOP, never a hash. */
export const FROZEN_HASHES: Readonly<Record<string, string>> = {
  // Re-derived for amendment CF-VERDICT-1064-APPLY-01 (spec §10.6.4, 24
  // September 2026) — the action clause's dependence on the Step 7
  // achieved-versus-required comparator (§10.6.2) stated explicitly and
  // independently of §10.6.3's render conditions, under CALVIN RULING — A
  // (PR #277 comment 5810329157, 08:07:19Z). Previous value, as verified
  // byte-exact before this edit (itself the CF-VERDICT-1062-APPLY-01
  // amendment, spec §10.6.2, 24 September 2026):
  // ed9042ef953b80c9976c53cede3dc21d8cf02fca70f834a9e571b7b68c2a6e74.
  // No other entry in this table changes: this amendment touches one
  // frozen file.
  "calboard-stock-analyzer-v1-spec.md":
    "e40f990803c14cd8bbe0e18ce6c4afa31c6803c80d68978172e09a05a143e8e4",
  "calboard-stock-analyzer-v1-design.md":
    "7535c6b6551b0ebf27ba10417733e5780a1cdc4634f5a5b7e4b91f121425a774",
  "mock-screen1-entry.html":
    "700db080c61144007a6686b9a98906361db767d1868c348cf71b37c91cfb376e",
  "mock-human-steps.html":
    "2f9e741bb770c7ee2dca5c68315e1a64e5ed9b9c4287e1b5de422f1f55dd6f1c",
  "mock-report-msft.html":
    "4c7547cb23dfe6a6ef6d9eb53cab11180b81319b2fb681715ff11057118fb629",
  "mock-report-oklo.html":
    "8d02adac2b9e9a83a0af939ca9b89a4c153fbf4ac53e0a5cc35396400b438bf0",
  "calboard-valuation-methodology.md":
    "a4a39e33717993fe9558f263009cec3814555765ac69c69728d99354d4a5ec7c",
  "calfinance-methodology-v2.md":
    "0e07ec7454b1c12883603a3bfa816ac3c6102c210509ea558147470cb4388c07",
};

/** Proves the reachability gate got Screen 1 and not merely a 200. */
export const SCREEN1_MARKUP_MARKER = "Ticker entry and identity resolution";

/**
 * The marker each target must show for its state to count as reached.
 *
 * These strings are the application's own words — `stateNameFor` in
 * app/components/AnalyzerEntry.tsx and the Step 2 / Step 6 section heads — so a
 * page that loads without reaching the state fails rather than being captured
 * as though it had.
 */
export const STATE_MARKERS: Readonly<Record<string, string>> = {
  "s1-resolved": "Listed operating company",
  "s1-unknown": "Unknown — no provider evidence for ZXQY",
  "s1-unsupported": "Unsupported — not an operating company",
  // CF-ANALYZER-AUTORUN-01 — the two `-undecided` targets are gone. Calvin's
  // ruling of 22 September 2026 04:28:04Z means a run that exists has already
  // been answered by the software, so there is no undecided Screen 2 for the
  // runner to point a browser at. Not captured, rather than captured by
  // seeding the database behind the UI, which this runner does not do. See
  // drive.ts's note at the removed capture.
  "s2-facts-msft": "Fact acquisition and spot-check",
  "s3-profile-msft": "PROFILE CONFIRMATION",
  "s2-facts-oklo": "Fact acquisition and spot-check",
  "s3-profile-oklo": "PROFILE CONFIRMATION",
};

export const TARGETS: readonly string[] = Object.keys(STATE_MARKERS);

/**
 * The suffix marking a target as the undecided (pre-decision) Screen 2
 * capture, e.g. `s2-facts-msft-undecided`. Shared by `drive.ts` (which builds
 * the target name) and `run.ts` (which decides whether to run
 * `checkContinueGated` against it) so the two stay in lockstep — a drifted
 * copy in either place would silently skip the gate check with no error.
 */
export const UNDECIDED_SUFFIX = "-undecided";

/** Screen 1 tickers, matching the manual capture this runner replaces. */
export const TICKERS = { resolved: "MSFT", unknown: "ZXQY", unsupported: "SPY" } as const;

/**
 * Every check this runner is required to execute, by the step name the check
 * itself reports.
 *
 * Declared here rather than derived from the results, which is the whole
 * point: a required check that never ran produces no result to derive from,
 * so a list built from results can never notice its own absence. Comparing
 * this declaration against what actually ran is what turns a silently skipped
 * check into an explicit gap (§5.6).
 *
 * The step names are constant per check rather than per target — one target
 * failing `no console or page errors` names the same step as any other — so
 * this list stays the length of the check set, not the target set.
 */
export const REQUIRED_CHECK_STEPS: readonly string[] = [
  "frozen artefacts match their SHA-256",
  "app reachable and serving Screen 1",
  "analyzer run table present",
  "every requested target rendered at every width",
  "no document or card overflow",
  "expected font family declared on .cb-analyzer",
  "no console or page errors",
  "every requested state appeared",
  // CF-ANALYZER-AUTORUN-01 — "Continue to gates disabled with a reason on the
  // undecided capture" is removed with the capture it ran against. It could
  // only ever run on a `-undecided` target, and that state is no longer
  // reachable through the product (see STATE_MARKERS above). `checkContinueGated`
  // itself is untouched and is still proved in both directions by the
  // fixture-driven self-test, so the check is retired from this run's
  // inventory rather than deleted from the runner.
];
