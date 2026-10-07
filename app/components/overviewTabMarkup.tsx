import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnalyzerReportFrame } from "./AnalyzerReportFrame";
import { AnalyzerOverview } from "./AnalyzerOverview";
import { deriveVerdict } from "@/lib/analyzer/verdict";
import { profileNotConfirmedFor } from "@/lib/analyzer/trust";
import type { ReportAnalysis } from "@/lib/analyzer/reportAnalysis";

// ---------------------------------------------------------------------------
// CF-ANALYZER-V1-SETTLE-01 — the normal Overview exactly as the report page
// renders it (app/analyzer/[runId]/page.tsx, tab "overview": the shared frame
// — identity, hero, tab rail, Key Stats rail — around the Overview tab body),
// as static markup. The live proof (scripts/analyzer/acceptance-run.ts) and
// its CI fixture tests check the words the reader is actually shown, not a
// second reading of the data that could drift from the page.
//
// Outside Next, the live probe runs under tsx, which reads the repo tsconfig
// ("jsx": "preserve", as Next requires) and so compiles every component's JSX
// to the classic React.createElement runtime — which needs React in scope.
// Supplying it here lets the probe run with the plain command, however it is
// invoked. Under Next and vitest (automatic runtime) this is unused.
// ---------------------------------------------------------------------------

(globalThis as { React?: typeof React }).React ??= React;

export function renderOverviewTabMarkup(runId: string, report: ReportAnalysis): string {
  const element = (
    <AnalyzerReportFrame
      runId={runId}
      result={report.result}
      verdict={deriveVerdict(report.result)}
      profileNotConfirmed={profileNotConfirmedFor(report.result)}
      activeTab="overview"
    >
      <AnalyzerOverview result={report.result} aiLayer={report.aiLayer} />
    </AnalyzerReportFrame>
  );

  // The frame's two <form>s take server actions; static markup has no
  // string form of a function, and React says so once per render (as a
  // format string, "Invalid value for prop %s", with "`action`" as an
  // argument). That one expected warning is not a defect of the page —
  // everything else still reaches the console.
  const consoleError = console.error;
  console.error = (...args: unknown[]) => {
    const text = args.filter((a): a is string => typeof a === "string").join(" ");
    if (text.includes("Invalid value for prop") && text.includes("`action`")) return;
    consoleError(...args);
  };
  try {
    return renderToStaticMarkup(element);
  } finally {
    console.error = consoleError;
  }
}

/** The visible text of static markup: one line per text run, entities decoded. */
export function visibleText(markup: string): string {
  return markup
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

export function overviewTabText(runId: string, report: ReportAnalysis): string {
  return visibleText(renderOverviewTabMarkup(runId, report));
}
