import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Decimal from "decimal.js";
import { acquireCompany } from "../../lib/analyzer/acquisition/provider";
import { draftAssumptionSheet } from "../../lib/analyzer/acquisition/aiProposedBundle";
import { historyFrom } from "../../lib/analyzer/sheets/research";
import { evaluateGate0 } from "../../lib/analyzer/gates";
import { sectorClassificationFromSic, industryClassificationFromSic } from "../../lib/analyzer/acquisition/gate0Inputs";
import { evaluateVerdictCheck, UNCERTAINTY_LEVELS, CHECK_RATES, type VerdictCheck } from "../../lib/analyzer/verdictSynthesisV1";
import { POLICY } from "../../lib/analyzer/policy";
import type { CompanyFactsDocument } from "../../lib/analyzer/acquisition/secClient";

// ---------------------------------------------------------------------------
// CF-METHODOLOGY-V3-CALIBRATION-01 (issue #495) — TEST / evidence only.
// A test-only parameterisation of Methodology v2.1 D2, run on frozen inputs
// (calibration-v3-freeze.ts; MSFT from docs/evidence/ar7-prototype). Nothing
// here is imported by the app and no live default changes: the engine's own
// constants are read, never edited.
//
//   G  year revenue growth reaches terminal growth
//   R  year the return on new capital reaches rate + S
//   S  terminal spread over the rate
//
// Both fade linearly from their year-5 values; the explicit period runs to
// max(G, R) and the terminal value is discounted from max(G, R) − 0.5. All
// else is D1/D2 as the engine does it: mid-year flows, valued at the price
// date (stub), TTM base, reinvestment_t = NOPAT_t × g_(t+1) ÷ RONIC_t, Gordon
// terminal FCF = NOPAT × (1 + g) × (1 − g ÷ (rate + S)). With G = R = 10 this
// is the engine exactly — checked below against every frozen run's own
// Bear/Base/Bull and Base at the three check rates.
//
// Scenario mapping (AI DEFAULT, test-only): Base takes the moat class's row;
// Bear takes the design's "none" row (D2's "bear +0" — no moat credit in any
// form); Bull takes the class's row with S + 1.5pp (D2's "bull = base +
// 1.5pp"). On CURRENT this is exactly the live rule.
//
// Run: npx tsx scripts/analyzer/calibration-v3.ts   (free, deterministic)
// ---------------------------------------------------------------------------

type MoatClass = "none" | "narrow" | "wide";
const CLASSES: MoatClass[] = ["none", "narrow", "wide"];
interface Row { G: number; R: number; S: Decimal }
interface Design { name: string; rows: Record<MoatClass, Row> }
const row = (G: number, R: number, Spp: number): Row => ({ G, R, S: new Decimal(Spp).div(100) });
const DESIGNS: Design[] = [
  { name: "CURRENT", rows: { none: row(10, 10, 0), narrow: row(10, 10, 1), wide: row(10, 10, 3) } },
  { name: "OPT1", rows: { none: row(10, 10, 0), narrow: row(10, 15, 0), wide: row(10, 20, 0) } },
  { name: "OPT2", rows: { none: row(10, 10, 0), narrow: row(10, 15, 0), wide: row(15, 20, 0) } },
  { name: "OPT3", rows: { none: row(7, 7, 0), narrow: row(15, 15, 0), wide: row(20, 20, 1) } },
];

const EVIDENCE = path.join("docs", "evidence", "methodology-v3-calibration");
const RUN_FILES: Record<string, string> = {
  MSFT: path.join("docs", "evidence", "ar7-prototype", "msft-run.json"),
  COST: path.join(EVIDENCE, "cost-run.json"),
  NVDA: path.join(EVIDENCE, "nvda-run.json"),
  NUE: path.join(EVIDENCE, "nue-run.json"),
  KO: path.join(EVIDENCE, "ko-run.json"),
  LLY: path.join(EVIDENCE, "lly-run.json"),
};
const CAPTURE_19_OCT = path.join("lib", "analyzer", "acquisition", "captures", "ar6-2026-10-19");
const D = (v: unknown) => new Decimal(String(v));
const TG = POLICY.terminalGrowth;

// --- the parameterised engine ---------------------------------------------

/** Linear fade from the year-5 value to `target`, reached in year Y; constant years 1–5. */
function fade(t: number, v5: Decimal, target: Decimal, Y: number): Decimal {
  if (Y <= 5) return t < Y ? v5 : target;
  if (t <= 5) return v5;
  if (t <= Y) return v5.minus(v5.minus(target).mul(t - 5).div(Y - 5));
  return target;
}

interface Company {
  ticker: string;
  price: Decimal;
  rate: Decimal;
  tax: Decimal;
  stub: Decimal;
  baseRevenue: Decimal;
  bridge: Decimal; // EV − market cap: debt + leases − cash − non-operating investments
  moat: MoatClass;
  drivers: Record<"bear" | "base" | "bull", { g: Decimal; m: Decimal; ronic: Decimal; shares: Decimal }>;
  engine: { bear: Decimal; base: Decimal; bull: Decimal; baseAt: Record<"lower" | "rate" | "upper", Decimal>; terminalShare: Decimal };
}

function valueEv(c: Company, d: { g: Decimal; m: Decimal; ronic: Decimal }, rate: Decimal, r: Row) {
  const N = Math.max(r.G, r.R);
  const terminalReturn = rate.plus(r.S);
  const after = new Decimal(1).minus(c.tax);
  const disc = new Decimal(1).plus(rate);
  const g = (t: number) => (t > N ? TG : fade(t, d.g, TG, r.G));
  let revenue = c.baseRevenue;
  let pv = new Decimal(0);
  for (let t = 1; t <= N; t++) {
    revenue = revenue.mul(new Decimal(1).plus(g(t)));
    const nopat = revenue.mul(d.m).mul(after);
    const reinvest = nopat.mul(g(t + 1)).div(fade(t, d.ronic, terminalReturn, r.R));
    pv = pv.plus(nopat.minus(reinvest).div(disc.pow(new Decimal(t).minus("0.5").minus(c.stub))));
  }
  const terminalFcf = revenue.mul(d.m).mul(after).mul(new Decimal(1).plus(TG)).mul(new Decimal(1).minus(TG.div(terminalReturn)));
  const tvPv = terminalFcf.div(rate.minus(TG)).div(disc.pow(new Decimal(N).minus("0.5").minus(c.stub)));
  return { ev: pv.plus(tvPv), tvPv };
}

const perShare = (c: Company, ev: Decimal, shares: Decimal) => ev.minus(c.bridge).div(shares);

function scenarioRow(design: Design, cls: MoatClass, scenario: "bear" | "base" | "bull"): Row {
  if (scenario === "bear") return { ...design.rows.none, S: new Decimal(0) };
  const r = design.rows[cls];
  return scenario === "bull" ? { ...r, S: r.S.plus(POLICY.bullMoatCreditUplift) } : r;
}

function valueDesign(c: Company, design: Design, cls: MoatClass) {
  const at = (s: "bear" | "base" | "bull", rate = c.rate) => {
    const r = scenarioRow(design, cls, s);
    const v = valueEv(c, c.drivers[s], rate, r);
    return { perShare: perShare(c, v.ev, c.drivers[s].shares), share: v.tvPv.div(v.ev) };
  };
  const bear = at("bear").perShare;
  const baseRun = at("base");
  const bull = at("bull").perShare;
  const off = POLICY.discountRate.verdictCheckOffset;
  const baseAt = { lower: at("base", c.rate.minus(off)).perShare, rate: baseRun.perShare, upper: at("base", c.rate.plus(off)).perShare };
  let check: VerdictCheck | null = null;
  let checkCause: string | null = null;
  try {
    check = evaluateVerdictCheck({ price: c.price, baseAt });
  } catch (e) {
    checkCause = e instanceof Error ? e.message : String(e);
  }
  const closeCalls = check === null ? null : UNCERTAINTY_LEVELS.filter((u) => new Set(CHECK_RATES.map((r) => check!.grid[r][u])).size > 1).length;
  return { bear, base: baseRun.perShare, bull, terminalShare: baseRun.share, priceOverBase: c.price.div(baseRun.perShare), baseAt, check, checkCause, closeCalls };
}

// --- step 5: implied runway -------------------------------------------------

function impliedRunway(c: Company) {
  const points: { N: number; base: Decimal }[] = [];
  for (let N = 5; N <= 40; N++) {
    const r: Row = { G: Math.max(10, N - 5), R: N, S: new Decimal(0) };
    points.push({ N, base: perShare(c, valueEv(c, c.drivers.base, c.rate, r).ev, c.drivers.base.shares) });
  }
  const crossings: { from: number; to: number; N: number }[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].base.minus(c.price);
    const b = points[i].base.minus(c.price);
    if (a.isZero()) crossings.push({ from: points[i - 1].N, to: points[i - 1].N, N: points[i - 1].N });
    else if (a.isNegative() !== b.isNegative() && !b.isZero()) {
      crossings.push({ from: points[i - 1].N, to: points[i].N, N: points[i - 1].N + a.abs().div(a.abs().plus(b.abs())).toNumber() });
    }
  }
  const monotone = points.every((p, i) => i === 0 || p.base.greaterThanOrEqualTo(points[i - 1].base));
  const first = points[0];
  const last = points[points.length - 1];
  let state: string;
  if (crossings.length === 1) state = `N ≈ ${crossings[0].N.toFixed(1)} (Base crosses price between N=${crossings[0].from} and N=${crossings[0].to})`;
  else if (crossings.length > 1) state = `NON-UNIQUE — Base crosses price ${crossings.length} times (N ≈ ${crossings.map((x) => x.N.toFixed(1)).join(", ")})`;
  else if (first.base.greaterThan(c.price)) state = `NO SOLUTION in 5–40 — Base exceeds price already at N=5 ($${first.base.toFixed(0)} vs $${c.price.toFixed(2)})`;
  else state = `NO SOLUTION in 5–40 — Base stays below price through N=40 (max $${Decimal.max(...points.map((p) => p.base)).toFixed(0)} vs $${c.price.toFixed(2)})`;
  return { state, monotone, atN5: first.base, atN40: last.base, points };
}

// --- step 7: ROIC including goodwill, all filed years ------------------------

function roicHistory(doc: CompanyFactsDocument, tax: Decimal, rate: Decimal) {
  const { measures } = historyFrom(doc);
  const years = measures.years.map((y) => {
    const nopat = y.operatingIncome === null ? null : y.operatingIncome.mul(new Decimal(1).minus(tax));
    const ic = y.investedCapital;
    const roic = nopat !== null && ic !== null && ic.greaterThan(0) ? nopat.div(ic) : null;
    return { fiscalYear: y.fiscalYear, nopat, investedCapital: ic, roic, note: roic === null ? (ic !== null && !ic.greaterThan(0) ? "invested capital not positive" : "input missing") : null };
  });
  const measured = years.filter((y) => y.roic !== null);
  return {
    years,
    measured: measured.length,
    aboveRate: measured.filter((y) => y.roic!.greaterThan(rate)).length,
    aboveRatePlus3: measured.filter((y) => y.roic!.greaterThan(rate.plus("0.03"))).length,
  };
}

// --- loading the frozen runs -------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadCompany(ticker: string, file: string): { company: Company | null; cause: string | null; run: any } {
  const run = JSON.parse(readFileSync(file, "utf8"));
  const content = run.sheet.content;
  const result = run.result;
  if (content.cannotConclude) return { company: null, cause: `Can't conclude: ${content.cannotConclude}`, run };
  const evDiag = result.diagnostics.enterpriseValue;
  const values = result.scenarioOutputs?.values;
  const baseAt = result.verdictInputs?.baseAtCheckRates;
  if (evDiag.suppressed || values === undefined || baseAt == null || [values.bear, values.base, values.bull].some((v: unknown) => v === null || D(v).isNaN())) {
    return {
      company: null,
      cause: `engine values no Base: ${result.verdictInputs?.baseAtCheckRatesCause ?? (evDiag.suppressed ? `enterprise value ${evDiag.state} — ${evDiag.cause}` : "no scenario values")}; verdict ${run.verdict.state} — ${run.verdict.reason}`,
      run,
    };
  }
  const s = content.scenarios;
  const drv = (k: "bear" | "base" | "bull") => ({ g: D(s[k].revenueGrowthOrPath), m: D(s[k].operatingMargin), ronic: D(s[k].returnOnNewInvestment), shares: D(s[k].shareCount) });
  const company: Company = {
    ticker,
    price: D(run.capture.price.value),
    rate: D(result.valuationBasis.discountRate.rate),
    tax: D(content.configuredConstants.nopatTaxRate),
    stub: D(result.runIdentity.valuationTiming.stubYears),
    baseRevenue: D(run.engineInputs?.baseRevenue ?? content.basis.ttmRevenue),
    bridge: D(evDiag.value.enterpriseValue).minus(D(evDiag.value.marketCap)),
    moat: content.moatClass,
    drivers: { bear: drv("bear"), base: drv("base"), bull: drv("bull") },
    engine: {
      bear: D(values.bear),
      base: D(values.base),
      bull: D(values.bull),
      baseAt: { lower: D(baseAt.lower), rate: D(baseAt.rate), upper: D(baseAt.upper) },
      terminalShare: D(result.diagnostics.terminal.terminalShareOfValue),
    },
  };
  return { company, cause: null, run };
}

/** CURRENT at the recorded class must be the engine, to the cent and beyond. */
function reproduce(c: Company) {
  const v = valueDesign(c, DESIGNS[0], c.moat);
  const pairs: [string, Decimal, Decimal][] = [
    ["bear", v.bear, c.engine.bear],
    ["base", v.base, c.engine.base],
    ["bull", v.bull, c.engine.bull],
    ["base@lower", v.baseAt.lower, c.engine.baseAt.lower],
    ["base@upper", v.baseAt.upper, c.engine.baseAt.upper],
    ["terminal share", v.terminalShare, c.engine.terminalShare],
  ];
  const worst = Decimal.max(...pairs.map(([, a, b]) => a.minus(b).abs().div(b.abs())));
  return { ok: worst.lessThan("1e-12"), worst, pairs };
}

// --- report -----------------------------------------------------------------

const money = (v: Decimal) => `$${v.toFixed(0)}`;
const pct = (v: Decimal, dp = 1) => `${v.mul(100).toFixed(dp)}%`;
const x = (v: Decimal) => `${v.toFixed(2)}×`;
const gridCell = (chk: VerdictCheck | null) =>
  chk === null ? "—" : CHECK_RATES.map((r) => UNCERTAINTY_LEVELS.map((u) => chk.grid[r][u][0]).join("")).join(" / ");
const routing = (chk: VerdictCheck | null) =>
  chk === null ? "—" : chk.routing.kind === "AUTOMATIC" ? `AUTO ${chk.routing.zone}` : chk.routing.kind === "UNCERTAINTY QUESTION" ? "UNCERTAINTY Q" : `CLOSE CALL (${chk.routing.zones.join("/")})`;

async function main(): Promise<void> {
  const lines: string[] = [];
  const json: Record<string, unknown> = {};
  const companies: Company[] = [];
  const notValued: { ticker: string; cause: string }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runs: Record<string, any> = {};

  for (const [ticker, file] of Object.entries(RUN_FILES)) {
    const refused = path.join(EVIDENCE, `${ticker.toLowerCase()}-refused.json`);
    if (!existsSync(file)) {
      notValued.push({ ticker, cause: existsSync(refused) ? `draft refused — ${JSON.parse(readFileSync(refused, "utf8")).cause}` : "no frozen run file" });
      continue;
    }
    const { company, cause, run } = loadCompany(ticker, file);
    runs[ticker] = run;
    if (company === null) notValued.push({ ticker, cause: cause! });
    else companies.push(company);
  }

  // OKLO: no 19 Oct capture is committed; the newest committed one (24 Sep) is
  // read through the production drafting path with no model — it settles a
  // company that cannot be drafted from history without a call.
  const oklo = await acquireCompany("OKLO", { price: null, source: "CAPTURE" });
  const okloOutcome = await draftAssumptionSheet("OKLO", oklo, null, null, "2026-10-19");
  notValued.push({
    ticker: "OKLO",
    cause:
      okloOutcome.kind === "CANNOT CONCLUDE"
        ? `Can't conclude: ${okloOutcome.content.cannotConclude} (production drafting path on the newest committed OKLO capture, 24 Sep 2026 — no 19 Oct OKLO capture exists)`
        : `${okloOutcome.kind}: ${"cause" in okloOutcome ? okloOutcome.cause : ""}`,
  });
  // The bank (JPM, SIC 6021 per lib/analyzer/golden/jpm.json): Gate 0 on its SIC alone.
  const jpm = JSON.parse(readFileSync(path.join("lib", "analyzer", "golden", "jpm.json"), "utf8"));
  const gate0 = evaluateGate0({
    sectorClassification: sectorClassificationFromSic(jpm.sic, jpm.sicDescription),
    industryClassification: industryClassificationFromSic(jpm.sic, jpm.sicDescription),
    interestIncomeOverRevenue: null,
    hasInsurancePremiumOrReserveLineItems: null,
    override: null,
  });
  notValued.push({
    ticker: "JPM (the bank)",
    cause: `Gate 0: ${gate0.result} — SIC ${jpm.sic} (${jpm.sicDescription}) classifies as ${sectorClassificationFromSic(jpm.sic, jpm.sicDescription)}, an asset-based sector; refused before any valuation (no capture needed or committed)`,
  });

  lines.push("# Methodology v3 calibration — results (TEST only, #495)", "");
  lines.push(`Generated by \`scripts/analyzer/calibration-v3.ts\` from frozen inputs. Terminal growth ${pct(TG)} (POLICY.terminalGrowth). Bear = design's "none" row at S=0; Bull = class row with S + ${pct(POLICY.bullMoatCreditUplift)}.`, "");

  lines.push("## Engine reproduction (CURRENT at recorded class = live engine)", "");
  lines.push("| Company | worst relative error vs the frozen run (Bear, Base, Bull, Base at rate ± 0.5pp, terminal share) | |", "|---|---|---|");
  const repro: Record<string, unknown> = {};
  for (const c of companies) {
    const r = reproduce(c);
    repro[c.ticker] = { ok: r.ok, worst: r.worst.toExponential(2) };
    lines.push(`| ${c.ticker} | ${r.worst.toExponential(2)} | ${r.ok ? "MATCH" : "**MISMATCH**"} |`);
    if (!r.ok) process.exitCode = 1;
  }
  json.reproduction = repro;
  lines.push("");

  lines.push("## Frozen inputs", "");
  lines.push("| Company | Price 19 Oct | D1 rate | Moat (draft) | Base g yrs 1–5 | Base margin | Base RONIC | Tax | Stub yrs | Bridge (EV − mkt cap) |", "|---|---|---|---|---|---|---|---|---|---|");
  for (const c of companies) {
    const b = c.drivers.base;
    lines.push(`| ${c.ticker} | $${c.price.toFixed(2)} | ${pct(c.rate)} | ${c.moat} | ${pct(b.g)} | ${pct(b.m)} | ${pct(b.ronic)} | ${pct(c.tax)} | ${c.stub.toFixed(3)} | $${c.bridge.div(1e9).toFixed(1)}bn |`);
  }
  lines.push("");

  const results: unknown[] = [];
  lines.push("## Results — every design × every moat class (★ = the draft's recorded class)", "");
  lines.push("Grid = verdict zones at rate −0.5pp / rate / +0.5pp, each as Low·Med·High (B/H/S). Close calls = uncertainty levels (of 3) where the three rates disagree.", "");
  lines.push("| Company | Design | Class | G/R/S | Bear | Base | Bull | Price/Base | Terminal share | D3 grid | Routing | Close calls |", "|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const c of companies) {
    for (const design of DESIGNS) {
      for (const cls of CLASSES) {
        const v = valueDesign(c, design, cls);
        const r = design.rows[cls];
        const star = cls === c.moat ? " ★" : "";
        lines.push(
          `| ${c.ticker} | ${design.name} | ${cls}${star} | ${r.G}/${r.R}/+${r.S.mul(100).toFixed(0)} | ${money(v.bear)} | ${money(v.base)} | ${money(v.bull)} | ${x(v.priceOverBase)} | ${pct(v.terminalShare, 0)} | ${gridCell(v.check)} | ${routing(v.check)} | ${v.closeCalls ?? v.checkCause} |`
        );
        results.push({ ticker: c.ticker, design: design.name, moatClass: cls, recorded: cls === c.moat, G: r.G, R: r.R, S: r.S.toString(), bear: v.bear.toString(), base: v.base.toString(), bull: v.bull.toString(), priceOverBase: v.priceOverBase.toString(), terminalShare: v.terminalShare.toString(), baseAt: Object.fromEntries(Object.entries(v.baseAt).map(([k, d]) => [k, d.toString()])), grid: v.check?.grid ?? null, routing: v.check?.routing ?? null, closeCalls: v.closeCalls });
      }
    }
  }
  json.results = results;
  lines.push("");

  lines.push("## Not valued", "", "| Company | Cause |", "|---|---|");
  for (const n of notValued) lines.push(`| ${n.ticker} | ${n.cause.replace(/\|/g, "\\|")} |`);
  json.notValued = notValued;
  lines.push("");

  lines.push("## Implied runway (Base = price; R = N, G = max(10, N − 5), S = 0; base drivers, D1 rate)", "");
  lines.push("| Company | Price | Base at N=5 | Base at N=40 | Base rises with N throughout | Result |", "|---|---|---|---|---|---|");
  const runway: Record<string, unknown> = {};
  for (const c of companies) {
    const r = impliedRunway(c);
    runway[c.ticker] = { state: r.state, monotone: r.monotone, points: r.points.map((p) => ({ N: p.N, base: p.base.toFixed(2) })) };
    lines.push(`| ${c.ticker} | $${c.price.toFixed(2)} | ${money(r.atN5)} | ${money(r.atN40)} | ${r.monotone ? "yes" : "no"} | ${r.state} |`);
  }
  json.impliedRunway = runway;
  lines.push("");

  lines.push("## Moat-floor data — ROIC including goodwill, every filed year in the 19 Oct capture (NOPAT at the sheet's tax rate ÷ year-end invested capital)", "");
  const roics: Record<string, unknown> = {};
  for (const c of companies) {
    const doc = JSON.parse(readFileSync(path.join(CAPTURE_19_OCT, `${c.ticker.toLowerCase()}-companyfacts.json`), "utf8")) as CompanyFactsDocument;
    const h = roicHistory(doc, c.tax, c.rate);
    // The engine's own five-year floor on the frozen run, for a cross-check.
    const floor = runs[c.ticker].result.verdictInputs.roicFloor;
    const engineYears: Record<number, string> = Object.fromEntries((floor.years ?? []).map((y: { fiscalYear: number; roic: string }) => [y.fiscalYear, y.roic]));
    const mismatches = h.years.filter((y) => engineYears[y.fiscalYear] !== undefined && y.roic !== null && D(engineYears[y.fiscalYear]).minus(y.roic).abs().greaterThan("1e-9"));
    roics[c.ticker] = { ...h, engineFloor: floor, crossCheck: mismatches.length === 0 ? "matches the engine's five-year floor" : `differs from the engine's floor in FY${mismatches.map((m) => m.fiscalYear).join(", FY")}` };
    lines.push(
      `**${c.ticker}** (rate ${pct(c.rate)}): ` +
        h.years.map((y) => `FY${y.fiscalYear} ${y.roic === null ? `n/a (${y.note})` : pct(y.roic)}`).join(" · ") +
        ` — **${h.aboveRate} of ${h.measured}** years > rate; **${h.aboveRatePlus3} of ${h.measured}** > rate + 3pp. Engine 5-yr floor: ${floor.status}${floor.average ? ` (${pct(D(floor.average))})` : ""}; ${(roics[c.ticker] as { crossCheck: string }).crossCheck}.`,
      ""
    );
  }
  json.roic = roics;

  // --- step 6: MSFT input dump vs Morningstar ------------------------------
  const msft = companies.find((c) => c.ticker === "MSFT");
  if (msft !== undefined) {
    const run = runs.MSFT;
    const fact = (id: string) => D(run.result.facts.find((f: { id: string }) => f.id === id).value);
    const b = msft.drivers.base;
    const r = DESIGNS[0].rows[msft.moat];
    const path10 = Array.from({ length: 10 }, (_, i) => fade(i + 1, b.g, TG, 10));
    const ronic10 = Array.from({ length: 10 }, (_, i) => fade(i + 1, b.ronic, msft.rate.plus(r.S), 10));
    const ttmOperatingIncome = fact("operating-income");
    const doc = JSON.parse(readFileSync(path.join(CAPTURE_19_OCT, "msft-companyfacts.json"), "utf8")) as CompanyFactsDocument;
    const historyYears = historyFrom(doc).measures.years;
    const latest = historyYears.at(-1)!;
    const margins = historyYears
      .filter((y) => y.revenue !== null && y.operatingIncome !== null)
      .map((y) => y.operatingIncome!.div(y.revenue!))
      .sort((a, b2) => a.comparedTo(b2));
    const medianMargin = margins.length % 2 === 1 ? margins[(margins.length - 1) / 2] : margins[margins.length / 2 - 1].plus(margins[margins.length / 2]).div(2);
    const ev = run.result.diagnostics.enterpriseValue.value;
    const dilutedShares = fact("shares-outstanding").plus(fact("treasury-method-dilution"));
    const y5Revenue = msft.baseRevenue.mul(new Decimal(1).plus(b.g).pow(5));
    const rows: [string, string, string][] = [
      ["Revenue growth yrs 1–5", `${pct(b.g)} each year (5-yr CAGR ${pct(b.g)}); then ${path10.slice(5).map((g) => pct(g)).join(", ")} in yrs 6–10; ${pct(TG)} after`, "13.8% 5-yr CAGR"],
      ["Operating margin path", `${pct(b.m)} flat, every year (TTM ${pct(ttmOperatingIncome.div(msft.baseRevenue))}; filed 10-yr median ${pct(medianMargin)})`, "rising to 47.6%"],
      ["Discount rate", `${pct(msft.rate)} (D1 stable band); Base at 8.5% = ${money(msft.engine.baseAt.lower)}`, "WACC 8.5%"],
      ["Tax rate (NOPAT)", `${pct(msft.tax)} — statutory; the draft cites no company tax disclosure`, "—"],
      ["TTM base revenue", `$${msft.baseRevenue.div(1e9).toFixed(1)}bn (FY2026, period end ${run.result.runIdentity.valuationTiming.basePeriodEnd}); yr-5 revenue $${y5Revenue.div(1e9).toFixed(0)}bn`, "—"],
      ["TTM NOPAT", `$${ttmOperatingIncome.mul(new Decimal(1).minus(msft.tax)).div(1e9).toFixed(1)}bn (operating income $${ttmOperatingIncome.div(1e9).toFixed(1)}bn × (1 − ${pct(msft.tax)}))`, "—"],
      ["Invested capital (FY2026 year-end, goodwill incl.)", `$${latest.investedCapital!.div(1e9).toFixed(1)}bn → ROIC ${pct(ttmOperatingIncome.mul(new Decimal(1).minus(msft.tax)).div(latest.investedCapital!))}`, "—"],
      ["Return on new capital yrs 1–5", `${pct(b.ronic)}; fades ${ronic10.slice(5).map((v) => pct(v)).join(", ")} in yrs 6–10; terminal ${pct(msft.rate.plus(r.S))} (rate + ${pct(r.S)} wide moat)`, "—"],
      ["Share count", `Base ${b.shares.div(1e6).toFixed(0)}m (${b.shares.div(dilutedShares).toFixed(2)}× today's diluted ${dilutedShares.div(1e6).toFixed(0)}m)`, "—"],
      ["Net cash in the bridge", `$${msft.bridge.neg().div(1e9).toFixed(1)}bn = cash & securities $${D(ev.cashAndMarketableDebtSecurities).div(1e9).toFixed(1)}bn + non-operating investments $${D(ev.nonOperatingEquityInvestmentsAtBook).div(1e9).toFixed(1)}bn − debt $${D(ev.totalDebt).div(1e9).toFixed(1)}bn − finance leases $${D(ev.financeLeaseLiabilities).div(1e9).toFixed(1)}bn`, "—"],
      ["Terminal growth", `${pct(TG)} (POLICY.terminalGrowth), reached in yr 10`, "—"],
    ];
    lines.push("## MSFT input dump vs Morningstar", "", "| Input | Engine (frozen MSFT run) | Morningstar |", "|---|---|---|");
    for (const [k, v, m] of rows) lines.push(`| ${k} | ${v} | ${m} |`);
    lines.push("");
    json.msftInputs = rows;
  }

  writeFileSync(path.join(EVIDENCE, "results.md"), lines.join("\n") + "\n");
  writeFileSync(path.join(EVIDENCE, "results.json"), JSON.stringify(json, (_k, v) => (v instanceof Decimal ? v.toString() : v), 2) + "\n");
  console.log(lines.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
