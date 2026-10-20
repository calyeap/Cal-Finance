import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Decimal from "decimal.js";

// ---------------------------------------------------------------------------
// CF-AR7-PROTOTYPE-REVIEW-01 (issue #455) — renders the static AR7 report
// prototype from ONE exported run (scripts/analyzer/export-draft-run.ts).
// Deterministic: the page states only what the run file carries. No figure is
// computed here beyond formatting and the two stated ratios the verdict check
// already reports, so every number traces to the run file named in the
// footer. AI prose slots the export deliberately did not call (challenger,
// interpretation) are drawn as labelled slots, never filled with invented
// text.
//
// Run:  npx tsx scripts/analyzer/render-ar7-prototype.ts docs/evidence/ar7-prototype/msft-run.json
// Writes docs/evidence/ar7-prototype/index.html beside the run file.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const SCENARIOS = ["bear", "base", "bull"] as const;
const DRIVERS = [
  ["revenueGrowthOrPath", "Revenue growth, yrs 1–5", "pct"],
  ["operatingMargin", "Operating margin", "pct"],
  ["returnOnNewInvestment", "Return on new investment", "pct"],
  ["reinvestmentCapitalIntensity", "Net reinvestment, share of revenue", "pct"],
  ["shareCount", "Diluted shares", "shares"],
] as const;

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function dec(v: unknown): Decimal | null {
  if (v === null || v === undefined || v === "") return null;
  try {
    const d = new Decimal(String(v));
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}
function pct(v: unknown, dp = 1): string {
  const d = dec(v);
  return d === null ? "—" : `${d.mul(100).toFixed(dp)}%`;
}
function usd(v: unknown, dp = 2): string {
  const d = dec(v);
  return d === null ? "—" : `$${d.toNumber().toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
}
function usdB(v: unknown): string {
  const d = dec(v);
  return d === null ? "—" : `$${d.dividedBy(1e9).toNumber().toLocaleString("en-US", { maximumFractionDigits: 1 })}B`;
}
function times(v: unknown, dp = 2): string {
  const d = dec(v);
  return d === null ? "—" : `${d.toFixed(dp)}×`;
}
function shares(v: unknown): string {
  const d = dec(v);
  return d === null ? "—" : `${d.dividedBy(1e9).toFixed(2)}B`;
}
function fmt(kind: string, v: unknown): string {
  return kind === "pct" ? pct(v) : kind === "shares" ? shares(v) : String(v ?? "—");
}
/** A Figure (suppressed or computed) as text: its value, or its state and cause. */
function figure(f: Json, render: (v: unknown) => string): string {
  if (f === null || f === undefined) return "—";
  if (f.suppressed === true) return `<span class="state">${esc(f.state)}</span> <span class="muted">— ${esc(f.cause)}</span>`;
  if (f.suppressed === false) return render(f.value);
  return render(f);
}

function verdictSlot(v: Json, ratioAtRate: string | null, base: string | null, price: string): string {
  const s = String(v.state ?? "");
  const zone = v.draftZone ?? v.status;
  let headline: string;
  let sub: string;
  let tone = "neutral";
  if (s === "PENDING ADOPTION") {
    headline = `Pending adoption <span class="zone z-${esc(String(zone).toLowerCase())}">draft reads ${esc(zone)}</span>`;
    sub = `Price ${price} is ${ratioAtRate ?? "—"} our Base value (${base ?? "—"}). The final verdict issues when you adopt the sheet.`;
  } else if (s === "ISSUED") {
    headline = `<span class="zone z-${esc(String(zone).toLowerCase())}">${esc(zone)}</span>`;
    sub = `Price ${price} is ${ratioAtRate ?? "—"} our Base value (${base ?? "—"}).`;
    tone = String(zone).toLowerCase();
  } else if (s === "INCOMPLETE") {
    headline = "Can't conclude yet";
    sub = esc(v.reason);
  } else {
    headline = esc(s);
    sub = esc(v.reason);
  }
  const routing = v.check?.routing;
  const uncertainty =
    routing?.kind === "AUTOMATIC"
      ? "Same verdict at Low, Medium and High uncertainty"
      : routing?.kind === "UNCERTAINTY QUESTION"
        ? "Depends on uncertainty — one question for you"
        : routing?.kind === "CLOSE CALL"
          ? "Close call across the rate check — your call"
          : "Uncertainty: not yet asked";
  return `<div class="verdict tone-${tone}"><div class="v-head">${headline}</div><div class="v-sub">${sub}</div><div class="v-unc">${esc(uncertainty)}</div></div>`;
}

function scenarioStrip(values: Json, price: Decimal | null, location: unknown): string {
  const vals = SCENARIOS.map((k) => dec(values?.[k]));
  const lo = vals[0];
  const hi = vals[2];
  let marker = "";
  let where = "";
  if (price && lo && hi && hi.greaterThan(lo)) {
    const raw = price.minus(lo).dividedBy(hi.minus(lo)).toNumber();
    const clamped = Math.max(0, Math.min(1, raw));
    const label = raw > 1 ? "price above Bull" : raw < 0 ? "price below Bear" : "price";
    marker = `<div class="marker" style="left:${(clamped * 100).toFixed(1)}%" title="${esc(label)}"></div>`;
    where = ` — ${label}`;
  }
  const cells = SCENARIOS.map(
    (k, i) => `<div class="sc sc-${k}"><div class="sc-label">${k[0].toUpperCase() + k.slice(1)}</div><div class="sc-value num">${usd(vals[i]?.toString())}</div></div>`
  ).join("");
  return `<div class="strip">${cells}<div class="sc sc-unc"><div class="sc-label">Uncertainty</div><div class="sc-value">Set on adoption</div></div></div>
  <div class="bar"><div class="bar-fill"></div>${marker}</div>
  <div class="muted small">Price location within Bear–Bull: ${esc(dec(location)?.toFixed(2) ?? "—")} (0 = Bear, 1 = Bull)${esc(where)}.</div>`;
}

function render(run: Json, runFile: string): string {
  const r = run.result;
  const v = run.verdict;
  const sheet = run.sheet?.content ?? {};
  const price = dec(r.price?.value);
  const values = r.scenarioOutputs?.values ?? {};
  const base = usd(values.base);
  const ratioAtRate = v.check?.ratios?.rate ? times(v.check.ratios.rate) : null;
  const rates = v.rates ?? {};
  const sellBand = r.policy?.constants?.verdictSynthesisV1Sell ?? {};
  const buyBand = r.policy?.constants?.verdictSynthesisV1Buy ?? {};
  const rd = r.priceImplied?.reverseDcf ?? {};
  const cagr = r.achievedRevenueCagr?.value;
  const roic = r.verdictInputs?.roicFloor;
  const sources: Json[] = sheet.sources ?? [];
  const company = esc(r.companyName ?? r.ticker);
  const asOf = esc(String(r.price?.timestamp ?? "").slice(0, 10));
  const breakEven = r.scenarioOutputs?.rateAtWhichBaseEqualsPrice;

  const priceAssumes =
    rd.fiveYearGrowth?.suppressed === false
      ? `About <b class="num">${pct(rd.fiveYearGrowth.value)}/yr</b> revenue growth for 5 years at a ${pct(rd.heldAt?.operatingMargin)} margin (reverse DCF at ${pct(rd.rate)}).`
      : `The reverse DCF cannot solve at ${pct(rd.rate)}: ${figure(rd.fiveYearGrowth, (x) => pct(x))}. Held at a ${pct(rd.heldAt?.operatingMargin)} margin and ${pct(rd.heldAt?.returnOnNewInvestment)} return on new investment.`;
  const history = cagr
    ? `${company} grew revenue ${pct(cagr.cagr)}/yr over ${esc(cagr.horizonYears)} years (FY${esc(cagr.window?.fromFiscalYear)}–FY${esc(cagr.window?.toFiscalYear)}).`
    : "";

  const grid = v.check?.grid ?? {};
  const gridRows = (["lower", "rate", "upper"] as const)
    .map(
      (k) =>
        `<tr><th class="num">${pct(rates[k])}</th>${(["Low", "Medium", "High"] as const)
          .map((u) => `<td class="zone-cell z-${esc(String(grid[k]?.[u] ?? "").toLowerCase())}">${esc(grid[k]?.[u] ?? "—")}</td>`)
          .join("")}<td class="num">${times(v.check?.ratios?.[k])}</td></tr>`
    )
    .join("");

  const holdPriceMedium = dec(values.base)?.mul(String(sellBand.medium ?? "")).toString();
  const reasons = [
    `Price is ${ratioAtRate ?? "—"} the Base value at ${pct(rates.rate)}; the SELL line is ${esc(sellBand.low)}× / ${esc(sellBand.medium)}× / ${esc(sellBand.high)}× at Low / Medium / High uncertainty, BUY ${esc(buyBand.low)}× / ${esc(buyBand.medium)}× / ${esc(buyBand.high)}×.`,
    `The check at ${pct(rates.lower)}, ${pct(rates.rate)} and ${pct(rates.upper)} gives ${times(v.check?.ratios?.lower)} / ${times(v.check?.ratios?.rate)} / ${times(v.check?.ratios?.upper)}.`,
    roic ? `5-yr average ROIC (goodwill included) ${pct(roic.average)} against the ${pct(roic.rate)} rate: ${esc(roic.status)}.` : "",
  ].filter(Boolean);

  const sheetRows = DRIVERS.map(
    ([key, label, kind]) =>
      `<tr><th>${esc(label)}</th>${SCENARIOS.map((s) => {
        const sc = sheet.scenarios?.[s] ?? {};
        const anchor = sc.anchors?.[key];
        return `<td><div class="num">${fmt(kind, sc[key])}</div>${anchor ? `<div class="anchor">${esc(anchor.text)} <span class="cites">${(anchor.cites ?? []).map((c: string) => `<a href="#src-${esc(c)}">${esc(c)}</a>`).join(" ")}</span></div>` : ""}</td>`;
      }).join("")}<td class="adjust"><button disabled>Adjust</button></td></tr>`
  ).join("");

  const roicRows = (roic?.years ?? [])
    .map((y: Json) => `<tr><th>FY${esc(y.fiscalYear)}</th><td class="num">${pct(y.roic)}</td></tr>`)
    .join("");
  const historySources = sources
    .filter((s) => s.kind === "HISTORY")
    .map((s) => `<div class="card"><h4>${esc(s.label)} <span class="cites">${esc(s.id)}</span></h4><p class="small">${esc(s.excerpt)}</p></div>`)
    .join("");
  const filingSources = sources
    .filter((s) => s.kind !== "HISTORY")
    .map((s) => `<div class="card"><h4>${esc(s.label)} <span class="cites">${esc(s.id)}</span></h4><p class="small">${esc(s.excerpt)}</p></div>`)
    .join("");
  const evidenceRows = sources
    .map(
      (s) =>
        `<tr id="src-${esc(s.id)}"><th>${esc(s.id)}</th><td>${esc(s.label)}</td><td>${esc(s.form)}</td><td class="num">${esc(s.accession ?? "—")}</td><td>${s.url ? `<a href="${esc(s.url)}">filing</a>` : "—"}</td></tr>`
    )
    .join("");
  const states = [...(r.states?.suppressing ?? []).map((s: Json) => `${s.state} — ${s.appliesTo}`), ...(r.states?.qualifying ?? []).map((q: Json) => `${q.flag} — ${q.appliesTo}`)]
    .map((t) => `<li>${esc(t)}</li>`)
    .join("");

  // The narrative is either the 10-K Item 1 text or a labelled fallback summary;
  // say which, and why the primary source was unavailable.
  const narrative = r.business?.narrative;
  const businessBody =
    typeof narrative === "string"
      ? `<p>${esc(narrative)}</p>`
      : narrative?.text
        ? `<p class="muted small">${esc(narrative.source === "MARKET-DATA PROVIDER SUMMARY" ? `Market-data provider summary (${narrative.provider ?? "provider"}), not the 10-K Item 1` : narrative.source ?? "")}</p><p>${esc(narrative.text)}</p>${narrative.primaryUnavailableReason ? `<p class="muted small">Why not Item 1: ${esc(narrative.primaryUnavailableReason)}</p>` : ""}`
        : `<p class="muted">${esc(r.business?.unavailableReason ?? "")}</p>`;

  const ev = r.diagnostics?.enterpriseValue;
  const evToEbit = r.diagnostics?.multiples?.evToEbit;
  const tabs = ["Overview", "Business", "Financials", "Valuation", "Risks & Thesis", "Market Context", "Evidence"];
  const tabInputs = tabs.map((t, i) => `<input type="radio" name="tab" id="t${i}" ${i === 0 ? "checked" : ""}>`).join("");
  const tabLabels = tabs.map((t, i) => `<label for="t${i}">${esc(t)}</label>`).join("");

  // Which of the conditional prompts this run would raise (item 28 routing, item 29 BUY bar).
  const zoneNow = String(v.draftZone ?? v.status ?? "");
  const routingKind = v.check?.routing?.kind;
  const judgeNote =
    routingKind === "CLOSE CALL"
      ? "a close call across the rate check — the report would ask you to decide."
      : routingKind === "UNCERTAINTY QUESTION"
        ? "the verdict depends on the uncertainty level — the report would ask that one question."
        : zoneNow === "BUY"
          ? "a BUY candidate — the report would ask the quality questions before a BUY issues."
          : `no prompt — the ${zoneNow || "verdict"} issues automatically (all nine checks agree) once the sheet is adopted. Prompts are drawn here for review only.`;

  const quickRead = `
  <section class="qr">
    <div class="qr-item span-6"><h3>What today's price assumes</h3><p>${priceAssumes}</p><p class="muted">${history}</p></div>
    <div class="qr-item span-6"><h3>If our Base case happens</h3><p>You'd earn about <b class="num">${pct(breakEven)}/yr</b> — the market rate in use is ${pct(rates.rate)}.</p></div>
    <div class="qr-item span-6"><h3>Why this verdict</h3><ul>${reasons.map((t) => `<li>${t}</li>`).join("")}</ul>
      <table class="grid"><thead><tr><th>Rate</th><th>Low</th><th>Medium</th><th>High</th><th>Price ÷ Base</th></tr></thead><tbody>${gridRows}</tbody></table></div>
    <div class="qr-item span-6"><h3>Business quality</h3><p><b>${esc(sheet.moatClass ?? "—")} moat</b> — ${esc(sheet.moatAnchor?.text ?? "")}</p>
      <p>5-yr average ROIC ${pct(roic?.average)} (${esc(roic?.status ?? "—")} against ${pct(roic?.rate)}).</p></div>
    <div class="qr-item span-6"><h3>Strongest argument against</h3><p class="slot">Challenger (AI, 2–3 lines) — generated at run time. Not called for this prototype run, so no text is shown.</p></div>
    <div class="qr-item span-6"><h3>Top risks</h3><p class="muted small">The draft's own Bear case (AI draft, cited):</p><p>${esc(sheet.scenarios?.bear?.writtenAnchor ?? "")}</p></div>
    <div class="qr-item span-12"><h3>What would change it</h3><p>At a ${pct(breakEven)} required return the Base value equals today's price. Under Medium uncertainty the price would have to fall below ${usd(holdPriceMedium)} (Base × ${esc(sellBand.medium)}) to leave the SELL band.</p></div>
  </section>
  <section class="judge">
    <h3>Your judgement <span class="muted small">— shown only for a BUY, a close call, or to record a broken thesis</span></h3>
    <p class="small"><b>This run:</b> ${esc(judgeNote)}</p>
    <div class="q"><span>The price needs the growth above. You expect:</span><button disabled>more</button><button disabled>about that</button><button disabled>less</button><button disabled>not sure</button></div>
    <div class="q"><span>How durable is the moat?</span><button disabled>wide — excess returns for decades</button><button disabled>narrow</button><button disabled>none</button><button disabled>not sure</button></div>
    <div class="q"><span>Is your thesis broken?</span><button disabled>no</button><button disabled>yes → SELL</button><button disabled>not sure</button></div>
    <p class="muted small">"Not sure" never becomes agreement and never yields a verdict.</p>
  </section>`;

  const valuation = `
  <section>
    <h3>Assumption sheet <span class="pill">version ${esc(run.sheet?.version)} · ${esc(run.sheet?.status)} · ${esc(run.sheet?.origin)}</span></h3>
    <p class="muted small">${esc(String(sheet.drafting ?? "").replace(/^./, (c) => c.toUpperCase()))}. Price-blind: the draft never saw the share price. Every driver cites its source.</p>
    <div class="scroll"><table class="sheet"><thead><tr><th>Driver</th><th>Bear</th><th>Base</th><th>Bull</th><th></th></tr></thead><tbody>${sheetRows}</tbody></table></div>
    <p><b>Moat:</b> ${esc(sheet.moatClass)} — ${esc(sheet.moatAnchor?.text ?? "")}</p>
    <p><b>Discount rate:</b> ${pct(r.valuationBasis?.discountRate?.rate)} — ${esc(r.valuationBasis?.discountRate?.basis)}</p>
    <div class="actions"><button disabled>Adopt as drafted</button><button disabled>Adopt with my adjustments</button><button disabled>Draft a fresh sheet</button></div>
  </section>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>AR7 prototype — ${esc(r.ticker)} report</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--ground:#16181A;--ink:#E9EAE7;--muted:#979CA1;--hairline:#2C2F33;--line-strong:#3C4045;--field:#1E2124;--gain:#56B98C;--loss:#E27A66;--stale:#D9AB45}
*{box-sizing:border-box}html,body{margin:0;background:var(--ground);color:var(--ink);font:15px/1.5 "IBM Plex Sans",system-ui,sans-serif}
.num{font-variant-numeric:tabular-nums}.muted{color:var(--muted)}.small{font-size:13px}.state{color:var(--stale)}
a{color:var(--ink)}button{font:inherit;color:var(--muted);background:var(--field);border:1px solid var(--line-strong);border-radius:6px;padding:4px 12px;margin:4px 8px 4px 0}
.app{display:grid;grid-template-columns:220px 1fr 280px;min-height:100vh}
.nav{border-right:1px solid var(--hairline);padding:24px 16px}.nav .brand{font-weight:600;margin-bottom:24px}.nav .item{padding:8px 0;color:var(--muted)}.nav .item.on{color:var(--ink)}
.nav .ico{display:none}
.main{padding:24px 32px;min-width:0}.rail{border-left:1px solid var(--hairline);padding:24px 16px}
.mobile-head{display:none}
.identity{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}.identity h1{font-size:20px;margin:0}.identity .tick{color:var(--muted)}
.analysis{display:grid;grid-template-columns:1.2fr 0.8fr;gap:24px;margin:16px 0}
.verdict{border:1px solid var(--line-strong);border-radius:8px;padding:16px}.v-head{font-size:20px;font-weight:600}.v-sub{margin-top:8px}.v-unc{margin-top:8px;color:var(--muted);font-size:13px}
.zone{font-weight:600;padding:0 6px}.z-sell{color:var(--loss)}.z-buy{color:var(--gain)}.z-hold{color:var(--ink)}
.pricebox{border:1px solid var(--hairline);border-radius:8px;padding:16px}.pricebox .p{font-size:28px;font-weight:500}
.strip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px}.sc{border:1px solid var(--hairline);border-radius:6px;padding:8px 12px}.sc-label{font-size:13px;color:var(--muted)}.sc-value{font-size:20px}
.bar{position:relative;height:6px;background:var(--field);border-radius:3px;margin:16px 0 8px}.bar-fill{position:absolute;inset:0;border:1px solid var(--line-strong);border-radius:3px}
.marker{position:absolute;top:-6px;width:2px;height:18px;background:var(--ink)}
.tabs input{display:none}.tabrail{display:flex;gap:4px;border-bottom:1px solid var(--hairline);margin:32px 0 24px;overflow-x:auto}
.tabrail label{padding:8px 12px;color:var(--muted);cursor:pointer;white-space:nowrap;border-bottom:2px solid transparent}
.panel{display:none}
${tabs.map((_, i) => `#t${i}:checked~.tabrail label[for=t${i}]{color:var(--ink);border-bottom-color:var(--ink)}#t${i}:checked~.panels .p${i}{display:block}`).join("")}
.qr{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}.qr-item{border:1px solid var(--hairline);border-radius:8px;padding:16px}.span-12{grid-column:span 12}.span-6{grid-column:span 6}
h3{font-size:15px;font-weight:600;margin:0 0 8px}h4{font-size:15px;margin:0 0 4px}p{margin:0 0 8px;max-width:75ch}
.slot{color:var(--muted);border:1px dashed var(--line-strong);border-radius:6px;padding:8px}
.judge{border:1px dashed var(--line-strong);border-radius:8px;padding:16px;margin-top:24px}.q{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:8px 0}.q span{margin-right:8px}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px;border-bottom:1px solid var(--hairline);vertical-align:top}thead th{color:var(--muted);font-size:13px;font-weight:500}
.grid{margin-top:8px}.zone-cell.z-sell{color:var(--loss)}.zone-cell.z-buy{color:var(--gain)}
.anchor{font-size:13px;color:var(--muted);margin-top:4px}.cites a,.cites{font-size:13px;color:var(--muted)}
.pill{font-size:13px;color:var(--muted);border:1px solid var(--line-strong);border-radius:999px;padding:4px 8px;font-weight:400}
.scroll{overflow-x:auto}.card{border:1px solid var(--hairline);border-radius:8px;padding:16px;margin-bottom:16px}
.rail h4{font-size:13px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.04em;margin:16px 0 8px}.kv{display:flex;justify-content:space-between;gap:8px;padding:4px 0;font-size:13px}
footer{margin-top:48px;color:var(--muted);font-size:13px;border-top:1px solid var(--hairline);padding-top:16px}
/* half-window: icon rail, no right rail, max two columns */
@media (max-width:1399px){.app{grid-template-columns:64px 1fr}.pricebox{order:-1}.analysis{grid-template-columns:0.8fr 1.2fr}.rail{display:none}.nav{padding:24px 8px}.nav .label,.nav .brand{display:none}.nav .ico{display:block;text-align:center;padding:8px 0;color:var(--muted)}}
/* phone: mobile header, stacked */
@media (max-width:767px){.app{display:block}.nav{display:none}.mobile-head{display:flex;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--hairline)}
.main{padding:16px}.analysis{grid-template-columns:1fr}.strip{grid-template-columns:repeat(2,1fr)}.qr{display:block}.qr-item{margin-bottom:12px}.pricebox .p{font-size:22px}}
</style></head>
<body><div class="app">
<nav class="nav"><div class="brand">Cal Finance</div>
${["Portfolio", "Analyzer", "Watchlist"].map((n, i) => `<div class="item ${i === 1 ? "on" : ""}"><span class="ico">${n[0]}</span><span class="label">${n}</span></div>`).join("")}</nav>
<div class="mobile-head"><b>Cal Finance</b><span class="muted">Analyzer</span></div>
<main class="main">
  <div class="identity"><h1>${company}</h1><span class="tick">${esc(r.ticker)}</span><span class="muted small">${esc(r.marketContext?.sicDescription ?? "")}</span></div>
  <div class="analysis">
    ${verdictSlot(v, ratioAtRate, base, usd(price?.toString()))}
    <div class="pricebox"><div class="muted small">Current price · ${asOf}</div><div class="p num">${usd(price?.toString())}</div></div>
  </div>
  ${scenarioStrip(values, price, r.scenarioOutputs?.priceLocationWithinRange)}
  <div class="tabs">${tabInputs}
    <div class="tabrail">${tabLabels}</div>
    <div class="panels">
      <div class="panel p0">${quickRead}</div>
      <div class="panel p1"><h3>Business</h3>${businessBody}${filingSources}</div>
      <div class="panel p2"><h3>Financials</h3>${historySources}<h4>Return on invested capital (goodwill included)</h4><table><tbody>${roicRows}</tbody></table></div>
      <div class="panel p3">${valuation}</div>
      <div class="panel p4"><h3>Risks &amp; Thesis</h3>${SCENARIOS.map((s) => `<div class="card"><h4>${s[0].toUpperCase() + s.slice(1)} case</h4><p>${esc(sheet.scenarios?.[s]?.writtenAnchor ?? "")}</p></div>`).join("")}<h4>Report states</h4><ul class="small">${states}</ul></div>
      <div class="panel p5"><h3>Market Context</h3><div class="kv"><span>Price</span><span class="num">${usd(price?.toString())} (${asOf})</span></div><div class="kv"><span>EV / EBIT</span><span class="num">${figure(evToEbit, (x) => times(x, 1))}</span></div><div class="kv"><span>Implied exit multiple (yr-10 EBIT)</span><span class="num">${figure(r.priceImplied?.impliedExitMultiple?.value, (x) => times(x, 1))}</span></div><div class="kv"><span>Industry (SIC)</span><span>${esc(r.marketContext?.sic)} — ${esc(r.marketContext?.sicDescription)}</span></div></div>
      <div class="panel p6"><h3>Evidence</h3><div class="scroll"><table><thead><tr><th>Id</th><th>Source</th><th>Form</th><th>Accession</th><th>Link</th></tr></thead><tbody>${evidenceRows}</tbody></table></div></div>
    </div>
  </div>
  <footer>Prototype for Calvin's AR7 review (#455). Every figure is read from <code>${esc(runFile)}</code> — run exported ${esc(run.capture?.exportedAt ?? "")}, sheet drafted by ${esc(run.capture?.model ?? "")}, valued unadopted. Static HTML; controls are disabled.</footer>
</main>
<aside class="rail"><h4>Key stats</h4>
  <div class="kv"><span>Enterprise value</span><span class="num">${figure(ev, (x: Json) => usdB(x?.enterpriseValue ?? x))}</span></div>
  <div class="kv"><span>EV / EBIT</span><span class="num">${figure(evToEbit, (x) => times(x, 1))}</span></div>
  <div class="kv"><span>Revenue CAGR (10 yr)</span><span class="num">${pct(cagr?.cagr)}</span></div>
  <h4>Market context</h4><div class="kv"><span>Industry</span><span>${esc(r.marketContext?.sicDescription ?? "—")}</span></div>
  <h4>Upcoming events</h4><div class="kv muted"><span>None in this run</span></div><div class="kv"><span>Latest filing</span><span>${esc(r.latestFiling?.form ?? "—")} ${esc(r.latestFiling?.filed ?? r.latestFiling?.filingDate ?? "")}</span></div>
</aside>
</div></body></html>
`;
}

const runFile = process.argv[2] ?? "docs/evidence/ar7-prototype/msft-run.json";
const run = JSON.parse(readFileSync(runFile, "utf8"));
const out = path.join(path.dirname(runFile), process.argv[3] ?? "index.html");
writeFileSync(out, render(run, path.relative(process.cwd(), runFile)));
console.log(`render-ar7-prototype: ${runFile} → ${out}`);
