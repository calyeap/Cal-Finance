"use client";

import Link from "next/link";
import { TopBarControls } from "./TopBarControls";

// This route's own nav, mirroring DashboardTopBar and HoldingsTopBar exactly
// — but, per issue #352 SCOPE 8 and its DECISION HORIZON ("navigation entry
// for the new route" -> `AI DEFAULT`: leave it out, record the question as
// open), neither of those two existing top bars is edited to link here.
// PORTFOLIO REVIEW is URL-reachable only for this first bounded outcome;
// where it belongs in the app's own navigation stays an open question for a
// later outcome to decide.
export function PortfolioReviewTopBar() {
  return (
    <div className="topbar">
      <div className="brand">Cal Finance</div>
      <div className="nav">
        <Link href="/">Dashboard</Link>
        <Link href="/holdings">Holdings</Link>
        <Link href="/portfolio-review" className="on">
          Portfolio review
        </Link>
        <TopBarControls privacyClassName="ctl icononly" />
      </div>
    </div>
  );
}
