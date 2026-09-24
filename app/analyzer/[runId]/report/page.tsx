import { redirect } from "next/navigation";

// CF-DESIGN-AUTHORITY-CUTOVER-01 — Analyzer V2 collapses the old separate
// Full Analysis route into the unified `/analyzer/{runId}` shell's tab rail
// (design authority doc: "one shell, seven tabs"; "do not duplicate the
// shell per report"). This route's own second `AnalyzerShell`/`fa-shell`
// rail is retired; existing links to it still land on a real report tab
// rather than a dead URL. "Business" is the first of the six themes the old
// Full Analysis route covered, in the same fixed order this shell still
// uses (AnalyzerReportFrame's `ANALYZER_TABS`).
export default async function LegacyReportRedirect({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  redirect(`/analyzer/${runId}?tab=business`);
}
