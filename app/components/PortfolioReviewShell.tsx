"use client";

import type { ReactNode } from "react";
import { useTheme } from "./ThemeContext";

// PORTFOLIO REVIEW's own design contract is open (issue #352 SCOPE 7;
// docs/portfolio-review-workflow-mode-reconciliation.md §3). `AI DEFAULT`:
// reuse the existing .cb-dash token system (DashboardShell.tsx) rather than
// author a new design system for this surface — the smallest reversible
// choice, consistent with SCOPE 7's "reuse existing shared primitives, tokens
// and patterns" instruction. Rationale: .cb-dash already covers both themes
// for every control this page needs (sections, tables, status colours), and
// nothing here reads or writes DashboardShell.tsx, so Dashboard is unaffected.
// Reversal: swap this class for a purpose-built one later, in one file, once
// this surface's own visual contract is actually approved.
export function PortfolioReviewShell({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <div className="cb-dash" data-theme={theme}>
      {children}
    </div>
  );
}
