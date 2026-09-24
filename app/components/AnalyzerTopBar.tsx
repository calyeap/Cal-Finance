"use client";

import { TopBarControls } from "./TopBarControls";

// CF-DESIGN-AUTHORITY-CUTOVER-01 — the brand wordmark and Dashboard/
// Holdings/Stock Analyzer nav this bar used to render now live once, in
// AnalyzerShell's sidebar/icon-rail (one shell, not a nav per route). What
// stays route-scoped here is the utility strip: the privacy toggle every
// Calboard bar shares (TopBarControls, unchanged mechanism) — with
// `showThemeToggle={false}`, since Analyzer V2 ships dark-only and drops
// the theme control entirely (design authority doc, "Product foundation").
//
// `variant="steps"` keeps its own narrower max-width (the entry/facts/
// profile screens' flat 1100px container, globals.css); "overview" and
// "report" now track the same unified shell width, so both map to the same
// class.
export function AnalyzerTopBar({ variant }: { variant: "overview" | "report" | "steps" }) {
  const variantClass = variant === "steps" ? " steps" : "";
  return (
    <header className={`az-topbar${variantClass}`}>
      <span className="az-topbar-context">Stock Analyzer</span>
      <div className="az-topbar-controls">
        <TopBarControls showThemeToggle={false} />
      </div>
    </header>
  );
}
