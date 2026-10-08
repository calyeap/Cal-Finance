// @vitest-environment jsdom
import { describe, it, expect, afterEach, afterAll, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { getPool } from "@/lib/db";
import { createRun, recordFactDecision } from "@/lib/analyzer/runStore";
import { loadGateState } from "@/lib/analyzer/gate";
import { INTERPRETATION_RESPONSIBILITY_KEYS } from "@/lib/analyzer/types";
import type { AnalystCall, AnalystCallRequest } from "@/lib/analyzer/ai/analystCall";

// ---------------------------------------------------------------------------
// CF-ANALYZER-USABLE-REPORT-REPAIR-01 correction (REVIEW on PR #421) — the
// defect the first attempt missed: Overview is DEFAULT_ANALYZER_TAB, so a
// run's very first view (nothing stored yet) reached analysisForReport's own
// blocking `await generateOnce(...)`, which is the ~171s model round trip
// #418 cites. This is the measured before/after that proves the correction:
// a stubbed slow call stands in for the model (no ANTHROPIC_API_KEY is
// configured in this sandbox, so the live call cannot be timed here either —
// same disclosed residual as the original PR), and the render is timed
// against the stub's own delay.
//
// Kept in its own file for the same reason analyzerTabAiLayerCost.test.tsx
// is: mocking lib/analyzer/ai/anthropicCall here must not leak into any
// other file's real-call-path (call === null) assertions.
// ---------------------------------------------------------------------------

// Large relative to this sandbox's own per-request baseline (DB round trips
// through advanceRunAutomatically/computeAnalysisForRun plus the React
// render), so that baseline cannot itself explain the timing assertion below.
const DELAY_MS = 2000;
let slowCall: { calls: number };

vi.mock("@/lib/analyzer/ai/anthropicCall", async () => {
  const actual = await vi.importActual<typeof import("@/lib/analyzer/ai/anthropicCall")>(
    "@/lib/analyzer/ai/anthropicCall"
  );
  return {
    ...actual,
    analystCallIfConfigured: (): AnalystCall =>
      async (request: AnalystCallRequest) => {
        slowCall.calls += 1;
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        return request.label === "interpretation"
          ? {
              statements: Object.fromEntries(
                INTERPRETATION_RESPONSIBILITY_KEYS.map((key) => [key, "Nothing further on this responsibility."])
              ),
              pageOne: {
                mainFinding: "The price rests on growth this company has not yet delivered.",
                whatSupportsTheCase: "B.",
                whatWorriesCalboard: "C.",
                biggestUncertainty: "D.",
              },
            }
          : { findings: [] };
      },
  };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`UNEXPECTED REDIRECT to ${url}`);
  },
  notFound: () => {
    throw new Error("UNEXPECTED notFound()");
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const { default: AnalyzerPage } = await import("./[runId]/page");

type TabbedPage = (props: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) => Promise<React.JSX.Element>;

async function renderOverview(runId: string) {
  return render(
    await (AnalyzerPage as unknown as TabbedPage)({
      params: Promise.resolve({ runId }),
      searchParams: Promise.resolve({}),
    })
  );
}

async function decidedRun(): Promise<string> {
  const runId = await createRun("MSFT", "Microsoft Corporation");
  const state = await loadGateState(runId);
  for (const factId of state.outstandingFactIds) {
    await recordFactDecision(runId, factId, "CONFIRMED", null);
  }
  return runId;
}

describe("CF-ANALYZER-USABLE-REPORT-REPAIR-01 correction — Overview's first render no longer waits on the model", () => {
  afterEach(() => {
    cleanup();
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("renders in a small fraction of the stubbed call's own delay, with the deterministic report intact", async () => {
    slowCall = { calls: 0 };
    const runId = await decidedRun();

    const startedAt = Date.now();
    const { container } = await renderOverview(runId);
    const elapsedMs = Date.now() - startedAt;

    // The regression #418 cited: this used to be at least DELAY_MS (two
    // sequential calls' worth, in fact) because the page awaited the model.
    expect(elapsedMs).toBeLessThan(DELAY_MS * 0.6);
    // Says generation is under way rather than pretending it already ran.
    expect(container.textContent).toMatch(/Interpretation pending|being generated now/);
    // The deterministic report is the real MSFT analysis regardless — it
    // never depended on the call that's still pending.
    expect(container.textContent).toContain("MICROSOFT CORPORATION");

    // Let the background generation this render started finish, so it
    // doesn't leak into the next test as an unhandled rejection/timer.
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS + 300));
  });

  it("a reload after the background generation finishes shows the written interpretation", async () => {
    slowCall = { calls: 0 };
    const runId = await decidedRun();

    await renderOverview(runId); // first view — starts the background generation
    cleanup();
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS + 300)); // generation finishes and is stored

    const { container } = await renderOverview(runId); // reload

    expect(container.textContent).toContain("growth this company has not yet delivered");
    expect(slowCall.calls).toBe(2); // one interpretation, one challenger — the reload did not call the model again
  });
});
