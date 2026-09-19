// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PrivacyProvider } from "@/app/components/PrivacyContext";
import { ThemeProvider } from "@/app/components/ThemeContext";
import RootNotFound from "./not-found";

// M9-NONM9-CHROME-01 — the global fallback not-found boundary. Before this
// outcome, `app/` had no not-found.tsx at all, so a notFound() call or an
// unmatched route anywhere outside app/analyzer/[runId]/** fell through to
// Next's built-in default 404, carrying none of this product's chrome.

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

describe("RootNotFound", () => {
  it("renders inside .cb-dash with DashboardTopBar above it — the route family's own chrome, not the Analyzer's", () => {
    const { container } = render(
      <Providers>
        <RootNotFound />
      </Providers>
    );
    const shell = container.querySelector(".cb-dash")!;
    expect(shell).not.toBeNull();
    expect(shell.querySelector(".topbar")).not.toBeNull();
    expect(container.querySelector(".cb-analyzer")).toBeNull();
  });

  it("names the state and offers exactly one recovery action, to Dashboard", () => {
    const { container } = render(
      <Providers>
        <RootNotFound />
      </Providers>
    );
    expect(screen.getByText(/this page does not exist/i)).toBeInTheDocument();
    // Scoped to the content section, not DashboardTopBar's own Dashboard/
    // Holdings nav links.
    const section = container.querySelector(".dashboard-section")!;
    const links = section.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/");
  });
});
