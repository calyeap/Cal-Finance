// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrivacyProvider } from "@/app/components/PrivacyContext";
import { ThemeProvider } from "@/app/components/ThemeContext";
import AnalyzerEntryError from "./error";

// M9-NONM9-CHROME-01 — `/analyzer` is a sibling segment of `[runId]`, not a
// child of it, so it inherited no error boundary from
// app/analyzer/[runId]/error.tsx (PR #171).

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

const SECRET_MESSAGE = "column resolvedAt does not exist";

describe("AnalyzerEntryError", () => {
  it("renders inside .cb-analyzer with the Calboard chrome above it", () => {
    const error = Object.assign(new Error(SECRET_MESSAGE), { digest: undefined });
    const { container } = render(
      <Providers>
        <AnalyzerEntryError error={error} reset={vi.fn()} />
      </Providers>
    );
    const shell = container.querySelector(".cb-analyzer")!;
    expect(shell).not.toBeNull();
    expect(shell.querySelector(".az-topbar")).not.toBeNull();
  });

  it('carries role="alert" and names the problem at the level the boundary knows it', () => {
    const error = Object.assign(new Error(SECRET_MESSAGE), { digest: undefined });
    render(
      <Providers>
        <AnalyzerEntryError error={error} reset={vi.fn()} />
      </Providers>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Stock Analyzer could not be loaded")).toBeInTheDocument();
  });

  it("never renders error.message or a stack", () => {
    const error = Object.assign(new Error(SECRET_MESSAGE), { stack: "at boom (secret.ts:1:1)" });
    render(
      <Providers>
        <AnalyzerEntryError error={error} reset={vi.fn()} />
      </Providers>
    );
    expect(screen.queryByText(SECRET_MESSAGE, { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText(/secret\.ts/, { exact: false })).not.toBeInTheDocument();
  });

  it("shows error.digest as an opaque reference when present", () => {
    const error = Object.assign(new Error(SECRET_MESSAGE), { digest: "abc123" });
    render(
      <Providers>
        <AnalyzerEntryError error={error} reset={vi.fn()} />
      </Providers>
    );
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });

  it("calls reset() from its retry control, and links to Dashboard rather than back to /analyzer", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error(SECRET_MESSAGE), { digest: undefined });
    render(
      <Providers>
        <AnalyzerEntryError error={error} reset={reset} />
      </Providers>
    );
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: /return to dashboard/i })).toHaveAttribute("href", "/");
  });
});

describe("this file is a Client Component and the nearest error boundary for /analyzer", () => {
  it('opens with "use client", which Next requires for error.tsx', () => {
    const source = readFileSync(path.resolve(__dirname, "./error.tsx"), "utf-8");
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
  });

  it("the [runId] segment still declares its own error.tsx, unshadowed by this sibling file", () => {
    const nested = readFileSync(path.resolve(__dirname, "./[runId]/error.tsx"), "utf-8");
    expect(nested).toMatch(/AnalyzerRouteError/);
  });
});
