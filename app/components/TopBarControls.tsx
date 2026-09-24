"use client";

import { usePrivacy } from "./PrivacyContext";
import { useTheme } from "./ThemeContext";

// M9-THEME-COMPLETION-01 — the privacy and theme icon buttons every Calboard
// top bar renders (Dashboard, Holdings, and now the Analyzer), extracted so
// all three render one implementation of the buttons and their
// ThemeContext/PrivacyContext wiring rather than a third hand-written copy
// (contract §5: "does not invent a third toggle implementation"). The
// className props preserve each existing bar's own visual class so this
// extraction changes no rendered styling on Dashboard or Holdings.
export function TopBarControls({
  privacyClassName = "iconbare",
  themeClassName = "iconbare",
  showThemeToggle = true,
}: {
  privacyClassName?: string;
  themeClassName?: string;
  // CF-DESIGN-AUTHORITY-CUTOVER-01 — Analyzer V2 is dark-only and ships with
  // no theme control at all (design authority doc: "no theme control in
  // Analyzer V2"; "Remove the theme toggle entirely from the shipped V2
  // UI"). false only for the Analyzer's own bar; Dashboard and Holdings keep
  // the toggle by leaving this at its default.
  showThemeToggle?: boolean;
}) {
  const { hidden, toggle: togglePrivacy } = usePrivacy();
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <>
      <button
        type="button"
        className={privacyClassName}
        aria-pressed={hidden}
        aria-label={hidden ? "Show values" : "Hide values"}
        title={hidden ? "Show values" : "Hide values"}
        onClick={togglePrivacy}
      >
        {hidden ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10.6 6.7A9.9 9.9 0 0 1 12 6.6c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.2 3.9M6.3 7.8A17 17 0 0 0 2 13.1s3.6 6.5 10 6.5a9.6 9.6 0 0 0 4.3-1M3 3l18 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
      {showThemeToggle && (
        <button
          type="button"
          className={themeClassName}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
        >
          {theme === "dark" ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
            </svg>
          )}
        </button>
      )}
    </>
  );
}
