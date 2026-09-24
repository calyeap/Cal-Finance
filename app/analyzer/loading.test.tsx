// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrivacyProvider } from "@/app/components/PrivacyContext";
import { ThemeProvider } from "@/app/components/ThemeContext";
import AnalyzerEntryLoading from "./loading";

// M9-NONM9-CHROME-01 — `/analyzer` is a sibling segment of `[runId]`, not a
// child of it, so it inherited no loading boundary from
// app/analyzer/[runId]/loading.tsx (PR #171). Same DONE WHEN wording as
// that file: in-place text, no spinner/overlay/shimmer, rendered inside
// AnalyzerShell with the chrome above it.

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

describe("AnalyzerEntryLoading", () => {
  it("renders inside .cb-analyzer with the Calboard chrome above it", () => {
    const { container } = render(
      <Providers>
        <AnalyzerEntryLoading />
      </Providers>
    );
    const shell = container.querySelector(".cb-analyzer")!;
    expect(shell).not.toBeNull();
    expect(shell.querySelector(".az-topbar")).not.toBeNull();
  });

  it("names what is happening as in-place text", () => {
    render(
      <Providers>
        <AnalyzerEntryLoading />
      </Providers>
    );
    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(screen.getByText(/preparing stock analyzer/i)).toBeInTheDocument();
  });

  it("contains no spinner, overlay or shimmer element in the loading content itself", () => {
    const { container } = render(
      <Providers>
        <AnalyzerEntryLoading />
      </Providers>
    );
    const content = container.querySelector(".routestate")!;
    expect(content).not.toBeNull();
    expect(content.querySelector("svg")).toBeNull();
    expect(content.querySelectorAll('[class*="spinner" i]')).toHaveLength(0);
    expect(content.querySelectorAll('[class*="overlay" i]')).toHaveLength(0);
    expect(content.querySelectorAll('[class*="shimmer" i]')).toHaveLength(0);
    expect(content.querySelectorAll('[class*="skeleton" i]')).toHaveLength(0);
    expect(content.querySelectorAll("[role='progressbar']")).toHaveLength(0);
  });
});

describe("this file is the nearest loading boundary for /analyzer, and the [runId] boundary is unshadowed for its own subtree", () => {
  it("app/analyzer/page.tsx (the entry screen) declares no loading.tsx of its own beyond this file", () => {
    // This file IS app/analyzer/loading.tsx — the assertion that matters is
    // that app/analyzer/[runId]/loading.tsx (a different, deeper segment)
    // still exists and is therefore still the nearer boundary for [runId]
    // and its descendants, unaffected by this sibling file's addition.
    const nested = readFileSync(
      path.resolve(__dirname, "./[runId]/loading.tsx"),
      "utf-8"
    );
    expect(nested).toMatch(/AnalyzerRouteLoading/);
  });
});
