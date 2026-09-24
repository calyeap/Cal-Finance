// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";

// ANALYZER-V2-PREREPORT-01 — this file used to render generic "Loading" /
// "Preparing this analysis run" text (M9-STATE-HANDLING-01). It is now the
// Analyzing pre-report state (design authority doc, "Pre-report states"):
// still the nearest Suspense fallback for the whole [runId] subtree, still
// rendered inside AnalyzerShell, but carrying real company identity and the
// four locked stages instead. AnalyzingState.test.tsx pins the stage
// contract itself; this file pins the wrapper's plumbing — reading the
// runId from the URL (loading.tsx receives no params from Next) and
// fetching identity from it.

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const usePathnameMock = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

const RUN_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  usePathnameMock.mockReturnValue(`/analyzer/${RUN_ID}`);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ticker: "MSFT", companyName: "Microsoft Corporation" }),
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const { default: AnalyzerRouteLoading } = await import("./loading");

describe("AnalyzerRouteLoading — the Analyzing state", () => {
  it("renders inside .cb-analyzer with the Calboard chrome above it", () => {
    const { container } = render(<AnalyzerRouteLoading />);
    const shell = container.querySelector(".cb-analyzer")!;
    expect(shell).not.toBeNull();
    expect(shell.querySelector(".az-topbar")).not.toBeNull();
  });

  it("fetches identity for the runId read from the URL, and renders it once resolved", async () => {
    render(<AnalyzerRouteLoading />);
    expect(fetch).toHaveBeenCalledWith(
      `/api/analyzer/runs/${RUN_ID}/identity`,
      expect.objectContaining({ cache: "no-store" })
    );
    expect(await screen.findByText(/Microsoft Corporation \(MSFT\)/)).toBeInTheDocument();
  });

  it("renders the four locked stages", async () => {
    const { container } = render(<AnalyzerRouteLoading />);
    await waitFor(() => expect(container.textContent).toContain("Microsoft Corporation"));
    const items = Array.from(container.querySelectorAll(".az-analyzing-stage")).map(
      (el) => el.textContent
    );
    expect(items).toEqual([
      "Gathering company information",
      "Checking financial data",
      "Running valuation",
      "Preparing analysis",
    ]);
  });

  it("claims no identity and marks no stage done while the fetch is still pending", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { container } = render(<AnalyzerRouteLoading />);
    expect(container.textContent).not.toMatch(/MSFT/);
    expect(
      Array.from(container.querySelectorAll(".az-analyzing-stage")).every(
        (el) => el.getAttribute("data-state") === "pending"
      )
    ).toBe(true);
  });

  it("contains no spinner, overlay, shimmer, skeleton or progressbar", () => {
    const { container } = render(<AnalyzerRouteLoading />);
    const content = container.querySelector(".az-analyzing")!;
    expect(content).not.toBeNull();
    expect(content.querySelectorAll('[class*="spinner" i]')).toHaveLength(0);
    expect(content.querySelectorAll('[class*="overlay" i]')).toHaveLength(0);
    expect(content.querySelectorAll('[class*="shimmer" i]')).toHaveLength(0);
    expect(content.querySelectorAll('[class*="skeleton" i]')).toHaveLength(0);
    expect(content.querySelectorAll("[role='progressbar']")).toHaveLength(0);
  });
});

describe("this file is the nearest loading boundary for both M9 routes", () => {
  it("neither report/ nor facts/ nor profile/ declares its own loading.tsx that would shadow this one", () => {
    for (const segment of ["report", "facts", "profile"]) {
      expect(() =>
        readFileSync(path.resolve(__dirname, `./${segment}/loading.tsx`), "utf-8")
      ).toThrow();
    }
  });
});
