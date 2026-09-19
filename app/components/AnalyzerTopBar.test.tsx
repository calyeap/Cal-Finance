// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
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

  // M9-NONM9-CHROME-01 — the entry/facts/profile screens' bar tracks
  // `.cb-analyzer .cb-steps .wrap` instead of `.layout`/`.fa-shell`, via a
  // third modifier class rather than a route-specific variant of the same
  // markup, keeping this the one TopBarControls/ThemeContext/PrivacyContext
  // instance every route drives.
  it('variant="steps" adds the .steps modifier the entry/facts/profile width tracking reads, and neither .fa nor bare', () => {
    const { container } = render(
      <Providers>
        <AnalyzerTopBar variant="steps" />
      </Providers>
    );
    const bar = container.querySelector(".topbar")!;
    expect(bar).toHaveClass("steps");
    expect(bar).not.toHaveClass("fa");
  });

  it('variant="steps" still renders the full shared chrome — wordmark, primary nav with aria-current, and both utility controls', () => {
    render(
      <Providers>
        <AnalyzerTopBar variant="steps" />
      </Providers>
    );
    expect(screen.getByRole("link", { name: /calboard home/i })).toHaveAttribute("href", "/");
    const current = screen.getByRole("link", { name: /stock analyzer/i });
    expect(current).toHaveClass("on");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^dashboard$/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /^holdings$/i })).toHaveAttribute("href", "/holdings");
    expect(screen.getByRole("button", { name: /hide values/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /switch to dark mode/i })).toBeInTheDocument();
  });
});

// SCOPE item 9 / DONE WHEN's first bullet: "both M9 routes render the
// chrome … verified by test, not by inspection." The suite above tests
// AnalyzerTopBar in isolation — it would pass unchanged if the two-line
// page wiring below were deleted. Same source-assertion technique as
// app/globalsCss.test.ts and lib/analyzer/verificationStateVocabulary.test.ts:
// read each route's page file and assert it actually renders the chrome,
// as the first child inside AnalyzerShell, rather than trusting inspection.
describe("both M9 routes wire AnalyzerTopBar into AnalyzerShell", () => {
  it("app/analyzer/[runId]/page.tsx renders AnalyzerTopBar variant=\"overview\" as AnalyzerShell's first child", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../analyzer/[runId]/page.tsx"),
      "utf-8"
    );
    expect(source).toMatch(/<AnalyzerShell>\s*<AnalyzerTopBar variant="overview" \/>/);
  });

  it("app/analyzer/[runId]/report/page.tsx renders AnalyzerTopBar variant=\"report\" as AnalyzerShell's first child", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../analyzer/[runId]/report/page.tsx"),
      "utf-8"
    );
    expect(source).toMatch(/<AnalyzerShell>\s*<AnalyzerTopBar variant="report" \/>/);
  });
});

// M9-NONM9-CHROME-01, DONE WHEN: "all four screens render AnalyzerTopBar,
// pinned by colocated tests following the existing AnalyzerTopBar.test.tsx
// … pattern." Same source-assertion technique as above — proves the wiring
// exists on the page, not only that the component works in isolation.
describe("the four non-M9 Analyzer screens wire AnalyzerTopBar into AnalyzerShell", () => {
  it('app/analyzer/page.tsx (the entry screen) renders AnalyzerTopBar variant="steps" as AnalyzerShell\'s first child', () => {
    const source = readFileSync(path.resolve(__dirname, "../analyzer/page.tsx"), "utf-8");
    expect(source).toMatch(/<AnalyzerShell>\s*<AnalyzerTopBar variant="steps" \/>/);
  });

  it('app/analyzer/[runId]/facts/page.tsx renders AnalyzerTopBar variant="steps" as AnalyzerShell\'s first child', () => {
    const source = readFileSync(
      path.resolve(__dirname, "../analyzer/[runId]/facts/page.tsx"),
      "utf-8"
    );
    expect(source).toMatch(/<AnalyzerShell>\s*<AnalyzerTopBar variant="steps" \/>/);
  });

  it('app/analyzer/[runId]/profile/page.tsx renders AnalyzerTopBar variant="steps" as AnalyzerShell\'s first child', () => {
    const source = readFileSync(
      path.resolve(__dirname, "../analyzer/[runId]/profile/page.tsx"),
      "utf-8"
    );
    expect(source).toMatch(/<AnalyzerShell>\s*<AnalyzerTopBar variant="steps" \/>/);
  });

  it('app/analyzer/[runId]/snapshot/[version]/page.tsx renders AnalyzerTopBar variant="overview" as AnalyzerShell\'s first child, tracking the same .layout container AnalyzerReport itself renders into on this route', () => {
    const source = readFileSync(
      path.resolve(__dirname, "../analyzer/[runId]/snapshot/[version]/page.tsx"),
      "utf-8"
    );
    expect(source).toMatch(/<AnalyzerShell>\s*\{\/\*[\s\S]*?\*\/\}\s*<AnalyzerTopBar variant="overview" \/>/);
  });
});

// DONE WHEN: "a test proves the theme control on the four screens drives
// the same ThemeContext the M9 routes drive — one mechanism, not a second
// toggle." AnalyzerTopBar is one component with no per-variant state of its
// own, so mounting two instances at once and toggling one is a direct proof
// that every variant reads/writes the single root-mounted ThemeContext.
describe("the same ThemeContext drives every variant — one toggle, not a second one for the non-M9 screens", () => {
  it("toggling the theme control on a variant=\"steps\" bar is observed by a variant=\"overview\" bar mounted alongside it", () => {
    render(
      <Providers>
        <AnalyzerTopBar variant="steps" />
        <AnalyzerTopBar variant="overview" />
      </Providers>
    );
    const toggles = screen.getAllByRole("button", { name: /switch to dark mode/i });
    expect(toggles).toHaveLength(2);
    fireEvent.click(toggles[0]);
    expect(screen.getAllByRole("button", { name: /switch to light mode/i })).toHaveLength(2);
  });
});
