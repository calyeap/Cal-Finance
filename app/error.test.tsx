// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrivacyProvider } from "@/app/components/PrivacyContext";
import { ThemeProvider } from "@/app/components/ThemeContext";
import RootError from "./error";

// M9-NONM9-CHROME-01 — the global fallback error boundary. Before this
// outcome, `app/` had no error.tsx at all, so an unhandled error anywhere
// outside app/analyzer/[runId]/** fell through to Next's built-in default
// error page, carrying none of this product's chrome.

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

describe("RootError", () => {
  it("renders inside .cb-dash with DashboardTopBar above it — the route family's own chrome, not the Analyzer's", () => {
    const error = Object.assign(new Error(SECRET_MESSAGE), { digest: undefined });
    const { container } = render(
      <Providers>
        <RootError error={error} reset={vi.fn()} />
      </Providers>
    );
    const shell = container.querySelector(".cb-dash")!;
    expect(shell).not.toBeNull();
    expect(shell.querySelector(".topbar")).not.toBeNull();
    expect(container.querySelector(".cb-analyzer")).toBeNull();
  });

  it('carries role="alert" and names the problem', () => {
    const error = Object.assign(new Error(SECRET_MESSAGE), { digest: undefined });
    render(
      <Providers>
        <RootError error={error} reset={vi.fn()} />
      </Providers>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/this page could not be loaded/i)).toBeInTheDocument();
  });

  it("never renders error.message or a stack", () => {
    const error = Object.assign(new Error(SECRET_MESSAGE), { stack: "at boom (secret.ts:1:1)" });
    render(
      <Providers>
        <RootError error={error} reset={vi.fn()} />
      </Providers>
    );
    expect(screen.queryByText(SECRET_MESSAGE, { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText(/secret\.ts/, { exact: false })).not.toBeInTheDocument();
  });

  it("shows error.digest as an opaque reference when present", () => {
    const error = Object.assign(new Error(SECRET_MESSAGE), { digest: "abc123" });
    render(
      <Providers>
        <RootError error={error} reset={vi.fn()} />
      </Providers>
    );
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });

  it("calls reset() from its retry control, and links to Dashboard", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error(SECRET_MESSAGE), { digest: undefined });
    render(
      <Providers>
        <RootError error={error} reset={reset} />
      </Providers>
    );
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: /return to dashboard/i })).toHaveAttribute("href", "/");
  });
});

describe('this file is a Client Component, as Next requires for error.tsx', () => {
  it('opens with "use client"', () => {
    const source = readFileSync(path.resolve(__dirname, "./error.tsx"), "utf-8");
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
  });
});
