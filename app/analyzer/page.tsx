import { AnalyzerShell } from "@/app/components/AnalyzerShell";
import { AnalyzerTopBar } from "@/app/components/AnalyzerTopBar";
import { AnalyzerEntry } from "@/app/components/AnalyzerEntry";

// Analyzer Home (§2 Step 1's entry point) — ANALYZER-V2-PREREPORT-01.
//
// This route holds no [runId] because no run exists yet: the run is created
// when the analyst confirms the resolved company, which is what makes this
// screen a step rather than a form field (design:121).
//
// variant="overview", not "steps": the design authority doc's pre-report
// states use "the same responsive shell modes" as the report, not the
// legacy flat-1100px steps container Screens 2/3 (facts/profile) still use
// unchanged below.
export default async function AnalyzerEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ unavailablefixture?: string }>;
}) {
  const { unavailablefixture } = await searchParams;

  return (
    <AnalyzerShell>
      <AnalyzerTopBar variant="overview" />
      <AnalyzerEntry fixtureMissing={unavailablefixture} />
    </AnalyzerShell>
  );
}
