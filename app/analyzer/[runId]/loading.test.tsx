// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrivacyProvider } from "@/app/components/PrivacyContext";
import { ThemeProvider } from "@/app/components/ThemeContext";
import AnalyzerRouteLoading from "./loading";

// M9-STATE-HANDLING-01 — DONE WHEN: "the loading state is in-place text
// with no spinner, overlay or skeleton shimmer, per DESIGN.md's own
// words", rendered inside AnalyzerShell with the chrome above it.

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

describe("AnalyzerRouteLoading", () => {
  it("renders inside .cb-analyzer with the Calboard chrome above it", () => {
    const { container } = render(
      <Providers>
        <AnalyzerRouteLoading />
      </Providers>
    );
    const shell = container.querySelector(".cb-analyzer")!;
    expect(shell).not.toBeNull();
    expect(shell.querySelector(".topbar")).not.toBeNull();
  });

  it("names what is happening as in-place text", () => {
    render(
      <Providers>
        <AnalyzerRouteLoading />
      </Providers>
    );
    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(screen.getByText(/preparing this analysis run/i)).toBeInTheDocument();
  });

  it("contains no spinner, overlay or shimmer element in the loading content itself (the topbar's own pre-existing privacy/theme icons are unrelated chrome, not a loading indicator)", () => {
    const { container } = render(
      <Providers>
        <AnalyzerRouteLoading />
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

describe("this file is the nearest loading boundary for both M9 routes", () => {
  it("neither report/ nor facts/ nor profile/ declares its own loading.tsx that would shadow this one", () => {
    for (const segment of ["report", "facts", "profile"]) {
      expect(() =>
        readFileSync(path.resolve(__dirname, `./${segment}/loading.tsx`), "utf-8")
      ).toThrow();
    }
  });
});
