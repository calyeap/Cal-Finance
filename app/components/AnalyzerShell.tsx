import type { ReactNode } from "react";
import Link from "next/link";

// CF-DESIGN-AUTHORITY-CUTOVER-01 — docs/design/analyzer-v2-design-authority.md
// ("Wide desktop": labelled sidebar; "Half-window"/"Tablet": compact icon
// rail; "Phone": mobile header instead of sidebar/icon rail). One nav
// element, reflowed by CSS alone (column -> row, label hidden below the
// icon-rail breakpoint) rather than three separate hand-built navs, so wide
// desktop, half-window/tablet and phone all read the same five DOM nodes at
// every width the acceptance targets require.
//
// Analyzer V2 is dark-only (design authority doc, "Product foundation":
// "Analyzer V2 ships dark-only, but the implementation stays token-based for
// future theme work") — this component no longer reads ThemeContext or
// renders a theme toggle; `data-theme="dark"` is fixed so `.cb-analyzer`'s
// existing dark token block (globals.css) applies unconditionally. The
// scoping class (`.cb-analyzer`) itself is unchanged, so the pre-report
// (`cb-steps`) and Full Analysis (`.layout`/tables/states) styling this
// wrapper's existing consumers already depend on continues to apply
// unmodified.

const NAV_ITEMS: { href: string; label: string; current?: boolean; icon: ReactNode }[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12 12 4l8 8" />
        <path d="M6 10v9h12v-9" />
      </svg>
    ),
  },
  {
    href: "/holdings",
    label: "Holdings",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="7" height="7" rx="1" />
        <rect x="13" y="4" width="7" height="7" rx="1" />
        <rect x="4" y="13" width="7" height="7" rx="1" />
        <rect x="13" y="13" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/analyzer",
    label: "Stock Analyzer",
    current: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 19V9M11 19V4M18 19v-6" />
      </svg>
    ),
  },
];

export function AnalyzerShell({ children }: { children: ReactNode }) {
  return (
    <div className="cb-analyzer az-shell" data-theme="dark">
      <aside className="az-nav">
        <Link href="/" className="az-brand" aria-label="Cal Finance home">
          <span className="az-brand-mark" aria-hidden="true">
            CF
          </span>
          <span className="az-brand-word">Cal Finance</span>
        </Link>
        <nav className="az-navlinks" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={item.current ? "az-navitem on" : "az-navitem"}
              aria-current={item.current ? "page" : undefined}
            >
              {item.icon}
              <span className="az-navlabel">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <div className="az-main">{children}</div>
    </div>
  );
}
