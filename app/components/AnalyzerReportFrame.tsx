import type { ReactNode } from "react";
import Link from "next/link";
import type { AnalysisResult, TrustStatus } from "@/lib/analyzer/types";
import type { VerdictResult } from "@/lib/analyzer/verdict";
import { DominantVerdictSlot } from "./DominantVerdictSlot";
import { PriceChartPanel } from "./PriceChartPanel";
import { ScenarioRangeStrip } from "./ScenarioRangeStrip";
import { AnalyzerRightRail } from "./AnalyzerRightRail";
import { trustStatusLine, trustConsequenceLine, uncertaintyLevel } from "@/lib/analyzer/trustCopy";
import { createDeepSnapshotAction } from "@/app/actions/analyzer";
import { boundState, NOT_COMPUTED_BINDING } from "@/lib/analyzer/notComputed";

// CF-DESIGN-AUTHORITY-CUTOVER-01 — docs/design/analyzer-v2-design-authority.md
// "One shell, seven tabs" and "Compact report header". One frame, reused by
// every tab (the page passes `activeTab` and the tab's own body as
// `children`) — the shell invariants (identity row, hero, tab rail, right
// rail, body-start anchor) render identically regardless of which tab is
// selected; only `children` changes (design authority doc: "Only the
// selected tab body below the tabs may change. Do not duplicate the shell
// per report.").
//
// The hero below always renders the full verdict/price/Bear-Base-Bull-
// Uncertainty row — identical across every desktop tab (design authority
// doc, "Locked shell invariants ... identical across every desktop tab").
// At half-window/tablet/phone widths, only Overview keeps that full row;
// every other tab collapses to the compact header ("Compact report header":
// "half-window, tablet and mobile ... Overview may expand into the richer
// summary; other tabs use the compact form"). That narrowing is pure CSS,
// keyed off `data-tab` on `.az-hero` (globals.css) — not a second render
// path, so there is no way for the two to drift out of sync.

export const ANALYZER_TABS = [
  { slug: "overview", label: "Overview" },
  { slug: "business", label: "Business" },
  { slug: "financials", label: "Financials" },
  { slug: "valuation", label: "Valuation" },
  { slug: "risks", label: "Risks & Thesis" },
  { slug: "market", label: "Market Context" },
  { slug: "evidence", label: "Evidence" },
] as const;

export type AnalyzerTabSlug = (typeof ANALYZER_TABS)[number]["slug"];

export const DEFAULT_ANALYZER_TAB: AnalyzerTabSlug = "overview";

export function isAnalyzerTabSlug(value: string): value is AnalyzerTabSlug {
  return ANALYZER_TABS.some((t) => t.slug === value);
}

function UncertaintyBadge({ status }: { status: TrustStatus }) {
  const level = uncertaintyLevel(status);
  return (
    <span className="az-uncertainty" data-level={level}>
      {level} uncertainty
    </span>
  );
}

export function AnalyzerReportFrame({
  runId,
  result,
  verdict,
  profileNotConfirmed,
  activeTab,
  children,
}: {
  runId: string;
  result: AnalysisResult;
  verdict: VerdictResult;
  profileNotConfirmed: boolean;
  activeTab: AnalyzerTabSlug;
  children: ReactNode;
}) {
  const trust = result.trust;
  // CF-PRICE-DISPLAY-HONESTY-RECON-01 — CONTEXT item 5.
  const priceState = boundState(result.states, NOT_COMPUTED_BINDING.price);
  const positionSuppressedBy =
    trust.status === "UNUSABLE"
      ? `TRUST STATUS UNUSABLE · ${trust.determinedBy[0]?.detail ?? ""}`
      : profileNotConfirmed
        ? "PROFILE NOT CONFIRMED"
        : null;

  return (
    <div className="az-report">
      <div className="az-report-main">
        {/* Company identity row — same role and alignment on every tab
            (design authority doc, locked shell invariants). The Sources /
            Details link block (m9-analyzer-design-contract.md §2.3) already
            renders once, below the tab body (SourcesAndDetails) — it is not
            repeated here, since a second copy would be exactly the
            duplicate generic module the design authority doc's shell
            invariants forbid. */}
        <div className="az-identity">
          <div className="az-identity-name">
            <h1>{result.companyName}</h1>
            <span className="az-ticker">{result.ticker}</span>
          </div>
        </div>

        {/* Verdict / price / Bear-Base-Bull-Uncertainty hero. Canonical top
            slots per issue #264: "Bear / Base / Bull / Uncertainty."
            `Attractive Price Range` does not appear here or anywhere else
            in this codebase — it was only ever the superseded generated
            mock's own invention (never shipped by ScenarioRangeStrip). */}
        <div className="az-hero" data-tab={activeTab}>
          <div className="az-hero-verdict">
            <DominantVerdictSlot verdict={verdict} trustStatus={trust.status} />
            <UncertaintyBadge status={trust.status} />
          </div>
          <div className="az-hero-price">
            <PriceChartPanel price={result.price} priceState={priceState} />
          </div>
          <div className="az-hero-scenarios">
            <ScenarioRangeStrip result={result} profileNotConfirmed={profileNotConfirmed} />
          </div>
        </div>

        {(profileNotConfirmed || trust.status !== "CLEAN") && (
          <div className="az-trustnote">
            <div className="state">
              {profileNotConfirmed && (
                <span className="plain">
                  The recommended profile was used provisionally. Nobody confirmed that it describes this company.
                </span>
              )}
              <span className="name">{trustStatusLine(trust.status, profileNotConfirmed)}</span>
              <span className="cause">{trustConsequenceLine(trust.status)}</span>
            </div>
            {positionSuppressedBy !== null && (
              <div className="state" style={{ marginTop: 14 }}>
                <span className="name">Valuation position — suppressed</span>
                <span className="cause">{positionSuppressedBy}</span>
              </div>
            )}
          </div>
        )}

        {/* Seven-tab rail — same order, placement and selected-state
            treatment on every screen this run has (design authority doc,
            "One shell, seven tabs"). Plain links, not client tab state, so
            each tab is its own bookmarkable/shareable URL. Sits directly
            below verdict + uncertainty, per the compact header's required
            "…verdict + uncertainty → seven-tab rail" sequence — nothing may
            interrupt that clause. */}
        <nav className="az-tabs" aria-label="Report sections">
          {ANALYZER_TABS.map((tab) => (
            <Link
              key={tab.slug}
              href={tab.slug === DEFAULT_ANALYZER_TAB ? `/analyzer/${runId}` : `/analyzer/${runId}?tab=${tab.slug}`}
              className={activeTab === tab.slug ? "az-tab on" : "az-tab"}
              aria-current={activeTab === tab.slug ? "page" : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <form action={createDeepSnapshotAction} className="az-save">
          <input type="hidden" name="runId" value={runId} />
          <button className="act" type="submit">
            Save this version
          </button>
        </form>

        <div className="az-tabbody">{children}</div>
      </div>

      <AnalyzerRightRail result={result} />
    </div>
  );
}
