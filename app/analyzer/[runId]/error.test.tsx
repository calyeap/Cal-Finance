// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrivacyProvider } from "@/app/components/PrivacyContext";
import { ThemeProvider } from "@/app/components/ThemeContext";
import AnalyzerRouteError from "./error";

// M9-STATE-HANDLING-01 — DONE WHEN: "the error state carries role="alert",
// names the problem at the level the boundary actually knows it, offers
// reset() and /analyzer, and renders no error.message and no stack."

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

describe("AnalyzerRouteError", () => {
  it("renders inside .cb-analyzer with the Calboard chrome above it", () => {
    const error = Object.assign(new Error(SECRET_MESSAGE), { digest: undefined });
    const { container } = render(
      <Providers>
        <AnalyzerRouteError error={error} reset={vi.fn()} />
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
        <AnalyzerRouteError error={error} reset={vi.fn()} />
      </Providers>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Analysis could not be completed")).toBeInTheDocument();
  });

  it("never renders error.message or a stack", () => {
    const error = Object.assign(new Error(SECRET_MESSAGE), { stack: "at boom (secret.ts:1:1)" });
    render(
      <Providers>
        <AnalyzerRouteError error={error} reset={vi.fn()} />
      </Providers>
    );
    expect(screen.queryByText(SECRET_MESSAGE, { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText(/secret\.ts/, { exact: false })).not.toBeInTheDocument();
  });

  it("shows error.digest as an opaque reference when present", () => {
    const error = Object.assign(new Error(SECRET_MESSAGE), { digest: "abc123" });
    render(
      <Providers>
        <AnalyzerRouteError error={error} reset={vi.fn()} />
      </Providers>
    );
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });

  it("calls reset() from its retry control, and links back to /analyzer", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error(SECRET_MESSAGE), { digest: undefined });
    render(
      <Providers>
        <AnalyzerRouteError error={error} reset={reset} />
      </Providers>
    );
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: /return to stock analyzer/i })).toHaveAttribute(
      "href",
      "/analyzer"
    );
  });
});

describe("this file is a Client Component and the nearest error boundary for both M9 routes", () => {
  it('opens with "use client", which Next requires for error.tsx', () => {
    const source = readFileSync(path.resolve(__dirname, "./error.tsx"), "utf-8");
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
  });

  it("neither report/ nor facts/ nor profile/ declares its own error.tsx that would shadow this one", () => {
    for (const segment of ["report", "facts", "profile"]) {
      expect(() =>
        readFileSync(path.resolve(__dirname, `./${segment}/error.tsx`), "utf-8")
      ).toThrow();
    }
  });
});
