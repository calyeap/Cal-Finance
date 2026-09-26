// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PrivacyProvider } from "./PrivacyContext";
import { ThemeProvider } from "./ThemeContext";
import { PortfolioReviewTopBar } from "./PortfolioReviewTopBar";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
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

describe("PortfolioReviewTopBar", () => {
  it("marks Portfolio review as the active link and links back to Dashboard and Holdings", () => {
    render(
      <Providers>
        <PortfolioReviewTopBar />
      </Providers>
    );
    expect(screen.getByRole("link", { name: /portfolio review/i })).toHaveClass("on");
    expect(screen.getByRole("link", { name: /^dashboard$/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /^holdings$/i })).toHaveAttribute("href", "/holdings");
  });
});
