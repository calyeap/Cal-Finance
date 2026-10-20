import type { RecentRun } from "@/lib/analyzer/runStore";

// CF-AR7-REPORT-CONTENT-01 — Analyzer Home's recent analyses: a compact list,
// not a dashboard grid (docs/design/analyzer-v2-design-authority.md,
// "Pre-report states"; product-decisions item 31 / D6). Each row opens its
// run; where Calvin saved a version, the row names that dated record.

function day(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const STATE_WORDS: Record<string, string> = {
  "PENDING ADOPTION": "pending adoption",
  "UNCERTAINTY QUESTION": "waiting on your uncertainty answer",
  "CLOSE CALL": "waiting on your close call",
  "BUY CANDIDATE": "BUY candidate",
  "CANNOT BOUND VALUE": "no verdict",
};

function savedLine(save: NonNullable<RecentRun["latestSave"]>): string {
  const outcome =
    save.verdictStatus === "INCOMPLETE" ? (STATE_WORDS[save.verdictState ?? ""] ?? "no verdict") : save.verdictStatus;
  return `Saved version ${save.version}, ${day(save.savedAt)} — ${outcome}`;
}

export function RecentAnalyses({ runs }: { runs: RecentRun[] }) {
  if (runs.length === 0) return null;
  return (
    <section className="az-recent" aria-label="Recent analyses">
      <h2>Recent analyses</h2>
      <ul>
        {runs.map((run) => (
          <li key={run.runId}>
            <a href={`/analyzer/${run.runId}`}>
              <span className="az-recent-name">{run.companyName}</span> <span className="az-recent-ticker">{run.ticker}</span>
            </a>
            <span className="az-recent-meta">
              Started {day(run.createdAt)}
              {run.latestSave !== null && <> · {savedLine(run.latestSave)}</>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
