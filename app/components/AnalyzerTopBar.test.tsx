// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PrivacyProvider, usePrivacy } from "./PrivacyContext";
import { ThemeProvider, useTheme } from "./ThemeContext";
import { AnalyzerTopBar } from "./AnalyzerTopBar";

// M9-THEME-COMPLETION-01 — same pattern as DashboardTopBar.test.tsx and
// HoldingsTopBar.test.tsx (contract §5, SCOPE item 9): the theme can now be
// switched from the Analyzer itself, driving the same root-mounted
// ThemeContext those two bars drive — verified by test, not by inspection.

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <PrivacyProvider>{children}</PrivacyProvider>
    </ThemeProvider>
  );
}

describe("AnalyzerTopBar", () => {
  it("marks Stock Analyzer current (aria-current, .on) and links to Dashboard and Holdings", () => {
    render(
      <Providers>
        <AnalyzerTopBar variant="overview" />
      </Providers>
    );
    const current = screen.getByRole("link", { name: /stock analyzer/i });
    expect(current).toHaveClass("on");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^dashboard$/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /^holdings$/i })).toHaveAttribute("href", "/holdings");
  });

  it("renders the Calboard wordmark as a link to /", () => {
    render(
      <Providers>
        <AnalyzerTopBar variant="overview" />
      </Providers>
    );
    expect(screen.getByRole("link", { name: /calboard home/i })).toHaveAttribute("href", "/");
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

  it("theme toggle button shares state with useTheme() consumers — the same ThemeContext Dashboard and Holdings drive, no second mechanism", () => {
    function Probe() {
      const { theme } = useTheme();
      return <span data-testid="theme">{theme}</span>;
    }
    render(
      <Providers>
        <AnalyzerTopBar variant="report" />
        <Probe />
      </Providers>
    );

    fireEvent.click(screen.getByRole("button", { name: /switch to dark mode/i }));
    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(screen.getByRole("button", { name: /switch to light mode/i })).toBeInTheDocument();
  });

  it('variant="report" adds the .fa modifier the Full Analysis width tracking (design.md:1021) reads; variant="overview" does not', () => {
    const { container: overviewContainer } = render(
      <Providers>
        <AnalyzerTopBar variant="overview" />
      </Providers>
    );
    expect(overviewContainer.querySelector(".topbar")).not.toHaveClass("fa");
    cleanup();

    const { container: reportContainer } = render(
      <Providers>
        <AnalyzerTopBar variant="report" />
      </Providers>
    );
    expect(reportContainer.querySelector(".topbar")).toHaveClass("fa");
  });
});
