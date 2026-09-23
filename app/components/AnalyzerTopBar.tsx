"use client";

import Link from "next/link";
import { TopBarControls } from "./TopBarControls";

// M9-THEME-COMPLETION-01 — the shared Calboard chrome for the two M9 routes
// (design.md:961, contract §5), so the theme (and privacy) can be switched
// from the Analyzer itself instead of only from Dashboard or Holdings.
// Markup and ARIA follow docs/frozen/mock-report-msft.html:325-336 verbatim
// (wordmark link, primary nav, Stock Analyzer current, then the privacy and
// theme icon buttons). The buttons are TopBarControls — the same
// ThemeContext/PrivacyContext mechanism Dashboard and Holdings use, not a
// third hand-written toggle.
//
// `variant` selects which container this route's bar tracks at Standard/Wide
// (design.md:1021 — "the top bar's max-width and padding track the layout at
// every mode"): "overview" tracks `.cb-analyzer .layout` (the Overview
// route's only container, at every width — also the snapshot reopen route's
// container, since AnalyzerReport itself renders `.layout` there with no
// `.fa-shell` rail around it). "report" also tracks `.cb-analyzer .fa-shell`
// — the container carrying the section rail — at Standard/Wide, where
// fa-shell's own cap (1400px/1600px) diverges from .layout's (1160px/1360px).
// Below 1024px `.fa-shell` itself carries no max-width (only its nested
// `.layout` does), so both variants share the same Compact rule.
//
// M9-NONM9-CHROME-01 — "steps" tracks `.cb-analyzer .cb-steps .wrap`, the
// container the entry, facts and profile screens render into. That
// container's max-width is a flat 1100px at every viewport (only its
// horizontal padding changes at the project's 720px phone breakpoint), so
// the additive rule beside `.topbar`/`.topbar.fa` in globals.css is a single
// unconditional override rather than a third set of Standard/Wide values —
// it already matches its container "at every width mode" without inventing
// a new breakpoint.
export function AnalyzerTopBar({ variant }: { variant: "overview" | "report" | "steps" }) {
  const variantClass = variant === "report" ? " fa" : variant === "steps" ? " steps" : "";
  return (
    <header className={`topbar${variantClass}`}>
      <Link href="/" className="brand" aria-label="Calboard home">
        Calboard
      </Link>
      <nav className="nav" aria-label="Primary">
        <Link href="/">Dashboard</Link>
        <Link href="/holdings">Holdings</Link>
        <Link href="/analyzer" className="on" aria-current="page">
          Stock Analyzer
        </Link>
        <TopBarControls />
      </nav>
    </header>
  );
}
