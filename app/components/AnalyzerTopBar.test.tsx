// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PrivacyProvider, usePrivacy } from "./PrivacyContext";
import { ThemeProvider } from "./ThemeContext";
import { AnalyzerTopBar } from "./AnalyzerTopBar";

// CF-DESIGN-AUTHORITY-CUTOVER-01 — the wordmark and Dashboard/Holdings/
// Stock Analyzer nav this bar used to render now live once, in
// AnalyzerShell's sidebar/icon-rail (see AnalyzerShell.test.tsx). This bar
// is left with the utility strip only: the privacy toggle, and — per the
// design authority doc's "no theme control in Analyzer V2" — no theme
// toggle at all, even though ThemeProvider stays mounted above it (the same
// root-mounted context Dashboard and Holdings still use elsewhere).

afterEach(cleanup);

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <PrivacyProvider>{children}</PrivacyProvider>
    </ThemeProvider>
  );
}

describe("AnalyzerTopBar", () => {
  it("renders the Stock Analyzer page context, not a brand wordmark or primary nav", () => {
    render(
      <Providers>
        <AnalyzerTopBar variant="overview" />
      </Providers>
    );
    expect(screen.getByText("Stock Analyzer")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /dashboard/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /holdings/i })).toBeNull();
  });

  it("renders no theme toggle — Analyzer V2 is dark-only", () => {
    render(
      <Providers>
        <AnalyzerTopBar variant="overview" />
      </Providers>
    );
    expect(screen.queryByRole("button", { name: /switch to (light|dark) mode/i })).toBeNull();
  });

  it("privacy toggle button shares state with usePrivacy() consumers", () => {
    function Probe() {
      const { hidden } = usePrivacy();
      return <span data-testid="hidden">{String(hidden)}</span>;
    }
    render(
      <Providers>
        <AnalyzerTopBar variant="overview" />
        <Probe />
      </Providers>
    );

    fireEvent.click(screen.getByRole("button", { name: /hide values/i }));
    expect(screen.getByTestId("hidden").textContent).toBe("true");
    expect(screen.getByRole("button", { name: /show values/i })).toBeInTheDocument();
  });

  it('variant="steps" adds the .steps modifier the entry/facts/profile width tracking reads; "overview" and "report" share the unified shell width', () => {
    const { container: steps } = render(
      <Providers>
        <AnalyzerTopBar variant="steps" />
      </Providers>
    );
    expect(steps.querySelector(".az-topbar.steps")).not.toBeNull();
    cleanup();

    const { container: overview } = render(
      <Providers>
        <AnalyzerTopBar variant="overview" />
      </Providers>
    );
    expect(overview.querySelector(".az-topbar.steps")).toBeNull();
    expect(overview.querySelector(".az-topbar")).not.toBeNull();
    cleanup();

    const { container: report } = render(
      <Providers>
        <AnalyzerTopBar variant="report" />
      </Providers>
    );
    expect(report.querySelector(".az-topbar.steps")).toBeNull();
    expect(report.querySelector(".az-topbar")).not.toBeNull();
  });
});
