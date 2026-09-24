// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrivacyProvider } from "@/app/components/PrivacyContext";
import { ThemeProvider } from "@/app/components/ThemeContext";
import AnalyzerEntryNotFound from "./not-found";

// M9-NONM9-CHROME-01 — `/analyzer` is a sibling segment of `[runId]`, not a
// child of it, so it inherited no not-found boundary from
// app/analyzer/[runId]/not-found.tsx (PR #171).

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

describe("AnalyzerEntryNotFound", () => {
  it("renders inside .cb-analyzer with the Calboard chrome above it", () => {
    const { container } = render(
      <Providers>
        <AnalyzerEntryNotFound />
      </Providers>
    );
    const shell = container.querySelector(".cb-analyzer")!;
    expect(shell).not.toBeNull();
    expect(shell.querySelector(".az-topbar")).not.toBeNull();
  });

  it("names the state and its cause via the existing .state/.name/.cause mechanism", () => {
    render(
      <Providers>
        <AnalyzerEntryNotFound />
      </Providers>
    );
    expect(screen.getByText("Page not found")).toBeInTheDocument();
    expect(screen.getByText(/this page does not exist/i)).toBeInTheDocument();
  });

  it("offers exactly one recovery action, to Dashboard rather than back to /analyzer", () => {
    render(
      <Providers>
        <AnalyzerEntryNotFound />
      </Providers>
    );
    const links = screen.getAllByRole("link").filter((el) => el.closest(".actions"));
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/");
  });

  // ANALYZER-V2-PREREPORT-01 — True Failure renders no report-only chrome
  // (design authority doc, "Pre-report states").
  it("renders no report-tab, verdict-slot, scenario-tile or right-rail chrome", () => {
    const { container } = render(
      <Providers>
        <AnalyzerEntryNotFound />
      </Providers>
    );
    expect(container.querySelector(".az-tabs")).toBeNull();
    expect(container.querySelector(".az-hero")).toBeNull();
    expect(container.querySelector(".az-rightrail")).toBeNull();
  });
});

describe("this is the nearest not-found boundary for /analyzer, and the [runId] boundary is unshadowed for its own subtree", () => {
  it("app/analyzer/[runId]/not-found.tsx still exists and still declares its own boundary", () => {
    const nested = readFileSync(
      path.resolve(__dirname, "./[runId]/not-found.tsx"),
      "utf-8"
    );
    expect(nested).toMatch(/AnalyzerRunNotFound/);
  });
});
