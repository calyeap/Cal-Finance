"use client";

import Link from "next/link";
import { TopBarControls } from "./TopBarControls";

// Dashboard-only nav — replaces <NavBar/> on `/`. /holdings has since moved
// to its own HoldingsTopBar too; /accounts/new (the setup wizard) suppresses
// nav entirely rather than rendering NavBar. NavBar.tsx is now unreferenced
// by any route. Privacy and theme controls (TopBarControls) read/write the
// same root-mounted contexts HoldingsTopBar and the Analyzer's AnalyzerTopBar
// use, so state stays in sync across routes.
export function DashboardTopBar() {
  return (
    <div className="topbar">
      <div className="brand">Calboard</div>
      <div className="nav">
        <Link href="/" className="on">
          Dashboard
        </Link>
        <Link href="/holdings">Holdings</Link>
        <TopBarControls privacyClassName="ctl icononly" />
      </div>
    </div>
  );
}
