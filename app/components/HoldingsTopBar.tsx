"use client";

import Link from "next/link";
import { TopBarControls } from "./TopBarControls";

// Holdings-only nav — replaces <NavBar/> on /holdings, mirroring
// DashboardTopBar exactly. /accounts/new (SetupWizard) suppresses nav
// entirely rather than rendering NavBar (see app/accounts/new/page.tsx) —
// with this route's move off it, NavBar.tsx is now unreferenced by any
// route; kept only because deleting it wasn't asked for this milestone.
// Privacy and theme controls (TopBarControls) read/write the same
// root-mounted contexts DashboardTopBar and the Analyzer's AnalyzerTopBar
// use, so state stays in sync across routes.
export function HoldingsTopBar() {
  return (
    <div className="topbar">
      <div className="brand">Calboard</div>
      <div className="nav">
        <Link href="/">Dashboard</Link>
        <Link href="/holdings" className="on">
          Holdings
        </Link>
        <TopBarControls privacyClassName="iconbtn" />
      </div>
    </div>
  );
}
