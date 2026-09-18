"use client";

import { useEffect, useRef, useState } from "react";

// M9-DESKTOP-SHELL-01 — the FullAnalysisNav rail, per docs/design/m9-
// analyzer-design-contract.md §2.2, §3.
//
// One persistent rail over Full Analysis's six themed sections plus the
// link back to Overview. "Overview" is a link back to the Overview route,
// not a seventh scrollable section (§2.2) — it is rendered outside the
// tracked-section list below rather than as one more entry inside it.
//
// URL-anchored: each link is a plain in-page `<a href="#id">`, so the
// browser itself puts the anchor in the URL and restores scroll position
// on return (design.md §17.9's "Requirement for BUILD") — no client-side
// scroll-restoration code is needed or added.
//
// Scroll-tracking: IntersectionObserver watches each section's own theme
// marker (the small heading element the anchor id lives on, not the full
// content beneath it — a common, lightweight scrollspy technique) and
// marks the current one. Carries no counts, badges or completion
// indicators (design.md:503, :918) — only which section is current.

const SECTIONS: { id: string; label: string }[] = [
  { id: "business", label: "Business" },
  { id: "financials", label: "Financials" },
  { id: "valuation", label: "Valuation" },
  { id: "risks-thesis", label: "Risks & Thesis" },
  { id: "market-context", label: "Market Context" },
  { id: "evidence", label: "Evidence" },
];

export function FullAnalysisNav({ overviewHref }: { overviewHref: string }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const elements = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-10% 0px -80% 0px" }
    );
    elements.forEach((el) => observer.observe(el));
    observerRef.current = observer;

    return () => observer.disconnect();
  }, []);

  return (
    <nav className="fanav" aria-label="Full Analysis sections">
      <a className="fanav-overview" href={overviewHref}>
        ← Overview
      </a>
      <ul>
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} aria-current={activeId === s.id ? "true" : undefined} className={activeId === s.id ? "active" : undefined}>
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
