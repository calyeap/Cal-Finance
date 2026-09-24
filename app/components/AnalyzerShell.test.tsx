// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { AnalyzerShell } from "./AnalyzerShell";

// CF-DESIGN-AUTHORITY-CUTOVER-01 — Analyzer V2 ships dark-only, with no
// theme control (design authority doc, "Product foundation"). AnalyzerShell
// no longer reads ThemeContext, so this file no longer wraps it in a
// ThemeProvider — a real regression would be this component reaching for a
// context that is not there and throwing.

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe("AnalyzerShell", () => {
  it("renders the .cb-analyzer wrapper fixed to data-theme=dark", () => {
    const { container } = render(
      <AnalyzerShell>
        <p>content</p>
      </AnalyzerShell>
    );
    const wrapper = container.querySelector(".cb-analyzer")!;
    expect(wrapper).not.toBeNull();
    expect(wrapper.getAttribute("data-theme")).toBe("dark");
    expect(wrapper.textContent).toContain("content");
  });

  it("renders the Cal Finance wordmark as a link to /, not the legacy Calboard wordmark", () => {
    render(
      <AnalyzerShell>
        <p>content</p>
      </AnalyzerShell>
    );
    const brand = screen.getByRole("link", { name: /cal finance home/i });
    expect(brand).toHaveAttribute("href", "/");
    expect(brand.textContent).toContain("Cal Finance");
  });

  it("marks Stock Analyzer current (aria-current, .on) and links to Dashboard and Holdings, in one nav reused at every responsive width", () => {
    render(
      <AnalyzerShell>
        <p>content</p>
      </AnalyzerShell>
    );
    const current = screen.getByRole("link", { name: /stock analyzer/i });
    expect(current).toHaveClass("on");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^dashboard$/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /^holdings$/i })).toHaveAttribute("href", "/holdings");
  });
});
