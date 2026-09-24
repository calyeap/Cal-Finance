// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { createRef } from "react";
import { AnalyzerHomeContent } from "./AnalyzerEntry";

// ANALYZER-V2-PREREPORT-01 — Analyzer Home, restyled onto the V2 shell.
//
// AnalyzerHomeContent (not AnalyzerEntry itself) is what this file renders:
// AnalyzerEntry's only job is wiring useActionState's [state, formAction] to
// this presentational component's props, and useActionState is a React 19
// hook this repo's installed React (18.3.1, see package.json) does not
// export at runtime — Next's own app-router bundling substitutes a
// compatible React for the real app, which plain jsdom rendering here does
// not. AnalyzerHomeContent takes formAction as a prop instead of calling the
// hook itself, so every identity outcome below is exercised directly, with
// no server-action dispatch machinery in the way.

afterEach(cleanup);

function renderHome(props: Partial<React.ComponentProps<typeof AnalyzerHomeContent>> = {}) {
  return render(
    <AnalyzerHomeContent
      entered=""
      identity={null}
      formAction={vi.fn()}
      formRef={createRef<HTMLFormElement>()}
      {...props}
    />
  );
}

describe("Analyzer Home — one dominant entry action, no Step 1 step framing", () => {
  it("renders the ticker field as the primary act on first render, with no Step 1 / Human-step framing", () => {
    renderHome();
    expect(screen.getByLabelText("Ticker")).toBeInTheDocument();
    expect(screen.queryByText(/^Step 1/)).toBeNull();
    expect(screen.queryByText(/Human · one field/i)).toBeNull();
  });

  it("renders no report-tab, verdict-slot, scenario-tile or right-rail chrome", () => {
    const { container } = renderHome();
    expect(container.querySelector(".az-tabs")).toBeNull();
    expect(container.querySelector(".az-hero")).toBeNull();
    expect(container.querySelector(".az-rightrail")).toBeNull();
  });

  it("keeps the ticker field and its result action in one inline row (.az-home-entryrow), not a step container", () => {
    const { container } = renderHome();
    expect(container.querySelector(".az-home-entryrow")).not.toBeNull();
    expect(container.querySelector(".cb-steps")).toBeNull();
  });

  it("keeps the §17 comprehension content, collapsed behind a single top-level disclosure rather than deleted", () => {
    const { container } = renderHome();
    const learnMore = container.querySelector("details.az-home-learnmore") as HTMLDetailsElement;
    expect(learnMore).not.toBeNull();
    expect(learnMore.open).toBe(false);
    expect(learnMore.textContent).toContain("One field, one ticker.");
    expect(learnMore.textContent).toContain("Why it matters");
    // The nested disclosure ("no override") is still reachable inside it.
    expect(learnMore.querySelector("details.disclose")).not.toBeNull();
  });
});

describe("Analyzer Home — all five identity outcomes stay honest and reachable", () => {
  it("RESOLVED: shows the resolved company, its provenance, and Begin analysis", () => {
    renderHome({
      identity: {
        outcome: "RESOLVED",
        ticker: "MSFT",
        companyName: "Microsoft Corporation",
        resolvedAt: "2026-09-04T21:04:00.000Z",
      },
    });
    expect(screen.getByText("Microsoft Corporation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /begin analysis/i })).toBeInTheDocument();
    expect(screen.getByText(/no price appears on this screen/i)).toBeInTheDocument();
  });

  it("UNKNOWN: names the cause and disables Begin analysis with a reason, no Try again", () => {
    renderHome({ identity: { outcome: "UNKNOWN", ticker: "ZZZZ" } });
    expect(screen.getByText(/no provider evidence for ZZZZ/i)).toBeInTheDocument();
    expect(screen.getByText(/did not resolve to a listed instrument/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /begin analysis/i })).toBeNull();
  });

  it("UNSUPPORTED: names the instrument-class cause", () => {
    renderHome({
      identity: { outcome: "UNSUPPORTED", ticker: "SPY", instrumentDescription: "a fund or index" },
    });
    expect(screen.getByText(/unsupported — not an operating company/i)).toBeInTheDocument();
    expect(screen.getByText(/SPY is a fund or index/i)).toBeInTheDocument();
  });

  it("NO_FILING_HISTORY: names the zero-filings cause", () => {
    renderHome({ identity: { outcome: "NO_FILING_HISTORY", ticker: "NEWCO" } });
    expect(screen.getByText(/no filing history — zero annual filings on record/i)).toBeInTheDocument();
    expect(screen.getByText(/resolved, and refused: no annual filing history/i)).toBeInTheDocument();
  });

  it("UNAVAILABLE: offers Try again and keeps the entry open (OPEN, not SUPPRESSION)", () => {
    const { container } = renderHome({ identity: { outcome: "UNAVAILABLE", ticker: "MSFT" } });
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(container.querySelector(".open")).not.toBeNull();
    expect(container.querySelector(".state")).toBeNull();
    expect(screen.getByText(/the identity service could not be reached/i)).toBeInTheDocument();
  });

  it("unavailablefixture: names the missing fact set and creates no run", () => {
    renderHome({ fixtureMissing: "NVDA" });
    expect(screen.getByText(/unavailable — no fact set in this build/i)).toBeInTheDocument();
    expect(screen.getByText(/NVDA resolves as a listed operating company/i)).toBeInTheDocument();
    expect(screen.getByText(/no run was created/i)).toBeInTheDocument();
  });
});
