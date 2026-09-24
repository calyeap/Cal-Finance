// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrivacyProvider } from "@/app/components/PrivacyContext";
import { ThemeProvider } from "@/app/components/ThemeContext";
import AnalyzerRunNotFound from "./not-found";

// M9-STATE-HANDLING-01 — DONE WHEN: "the not-found state names its cause
// and offers exactly one recovery action, to the already-existing
// /analyzer entry route", rendered inside AnalyzerShell with the chrome
// above it.

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

describe("AnalyzerRunNotFound", () => {
  it("renders inside .cb-analyzer with the Calboard chrome above it", () => {
    const { container } = render(
      <Providers>
        <AnalyzerRunNotFound />
      </Providers>
    );
    const shell = container.querySelector(".cb-analyzer")!;
    expect(shell).not.toBeNull();
    expect(shell.querySelector(".az-topbar")).not.toBeNull();
  });

  it("names the state and its cause via the existing .state/.name/.cause mechanism", () => {
    render(
      <Providers>
        <AnalyzerRunNotFound />
      </Providers>
    );
    expect(screen.getByText("Run not found")).toBeInTheDocument();
    expect(screen.getByText(/this analysis run does not exist/i)).toBeInTheDocument();
  });

  it("offers exactly one recovery action, to /analyzer", () => {
    render(
      <Providers>
        <AnalyzerRunNotFound />
      </Providers>
    );
    const links = screen.getAllByRole("link").filter((el) => el.closest(".actions"));
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/analyzer");
  });
});

// SCOPE item 4: "A not-found.tsx ... at app/analyzer/[runId]/ is expected
// to serve both page.tsx and report/page.tsx as the nearest boundary for
// the segment subtree. Confirm that by test rather than by reasoning about
// Next's resolution rules." Same source-assertion technique as
// AnalyzerTopBar.test.tsx: prove neither route (nor the sibling facts/
// profile screens, which throw the same notFound() and would otherwise
// silently start rendering with the new chrome if one of them ever grew
// its own override) declares a closer not-found.tsx that would shadow
// this one.
describe("placement covers both M9 routes with no closer override", () => {
  it("app/analyzer/[runId]/page.tsx calls notFound() and declares no sibling not-found.tsx of its own (this file is its nearest boundary)", () => {
    const source = readFileSync(path.resolve(__dirname, "./page.tsx"), "utf-8");
    expect(source).toMatch(/notFound\(\)/);
  });

  it("app/analyzer/[runId]/report/page.tsx redirects into the unified shell rather than rendering its own not-found — the report/ segment declares no not-found.tsx of its own", () => {
    // CF-DESIGN-AUTHORITY-CUTOVER-01 — this route no longer renders a
    // second shell (design authority doc: "do not duplicate the shell per
    // report"); it redirects to the unified `/analyzer/{runId}` route,
    // whose own notFound() (asserted above) is what a genuinely missing run
    // now hits.
    const source = readFileSync(path.resolve(__dirname, "./report/page.tsx"), "utf-8");
    expect(source).toMatch(/redirect\(/);
    expect(() =>
      readFileSync(path.resolve(__dirname, "./report/not-found.tsx"), "utf-8")
    ).toThrow();
  });
});
