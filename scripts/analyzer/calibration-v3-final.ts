import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import Decimal from "decimal.js";
import { evaluateVerdictCheck, UNCERTAINTY_LEVELS, CHECK_RATES, type VerdictCheck } from "../../lib/analyzer/verdictSynthesisV1";
import { POLICY } from "../../lib/analyzer/policy";
import {
  DESIGNS,
  RUNS,
  load,
  supplement,
  filedData,
  valueEv,
  scenarioRow,
  fade,
  flat,
  TG,
  ONE,
  pct,
  money,
  grid,
  type Company,
  type Drivers,
} from "./calibration-v3-drivers";

// ---------------------------------------------------------------------------
// CF-METHODOLOGY-V3-FINAL-01 (issue #498) — TEST / evidence only.
// Calibration #3 on #495/#496's frozen sheets, captures and supplementary SEC
// facts. No re-drafting, no network, no model call.
//
//   A  year-1 funding: the engine funds year t+1's growth from year t's
//      reinvestment, so year 1's growth is free. Required yr-0 investment =
//      NOPAT_0 × g_1 ÷ RONIC_1; available = the last fiscal year's actual net
//      reinvestment; any shortfall is a cash outflow at the valuation date.
//   B  MSFT on Morningstar's three-stage structure (a humility check, never a
//      target), split into inputs vs structure vs rate.
//   C  a growth-plateau Bull for the wide-moat companies.
//
// The general year-by-year engine below reproduces the round-2 engine
// exactly on every company at OPT1 (checked on every run).
//
// Run: npx tsx scripts/analyzer/calibration-v3-final.ts   (free, deterministic)
// ---------------------------------------------------------------------------

const OUT = path.join("docs", "evidence", "methodology-v3-final");
const OPT1 = DESIGNS.find((d) => d.name === "OPT1")!;
const CURRENT = DESIGNS.find((d) => d.name === "CURRENT")!;
const OFF = POLICY.discountRate.verdictCheckOffset;

/**
 * Year-by-year engine. g[t], m[t], ronic[t] for t = 1..N (index t − 1).
 * Reinvestment_t = NOPAT_t × g_(t+1) ÷ RONIC_t, with g_(N+1) = terminal growth;
 * Gordon terminal value at N with terminal FCF = NOPAT × (1 + g) × (1 − g ÷
 * terminalReturn); mid-year flows; terminal discounted from N − 0.5; all
 * shifted by the price-date stub — the D2 timing the engine uses.
 */
function valuePath(c: Company, p: { g: Decimal[]; m: Decimal[]; ronic: Decimal[]; tax: Decimal; rate: Decimal; terminalReturn: Decimal }) {
  const N = p.g.length;
  const after = ONE.minus(p.tax);
  const disc = ONE.plus(p.rate);
  const gNext = (t: number) => (t < N ? p.g[t] : TG);
  let revenue = c.baseRevenue;
  let pv = new Decimal(0);
  for (let t = 1; t <= N; t++) {
    revenue = revenue.mul(ONE.plus(p.g[t - 1]));
    const nopat = revenue.mul(p.m[t - 1]).mul(after);
    pv = pv.plus(nopat.minus(nopat.mul(gNext(t)).div(p.ronic[t - 1])).div(disc.pow(new Decimal(t).minus("0.5").minus(c.stub))));
  }
  const terminalFcf = revenue.mul(p.m[N - 1]).mul(after).mul(ONE.plus(TG)).mul(ONE.minus(TG.div(p.terminalReturn)));
  const tvPv = terminalFcf.div(p.rate.minus(TG)).div(disc.pow(new Decimal(N).minus("0.5").minus(c.stub)));
  return { ev: pv.plus(tvPv), tvPv };
}
const perShare = (c: Company, ev: Decimal, shares: Decimal) => ev.minus(c.bridge).div(shares);

/** OPT1/CURRENT paths for a scenario's drivers, as the round-2 engine builds them. */
function designPath(c: Company, d: Drivers, rate: Decimal, design: (typeof DESIGNS)[number], s: "bear" | "base" | "bull") {
  const r = scenarioRow(design, c.moat, s);
  const N = Math.max(r.G, r.R);
  const years = Array.from({ length: N }, (_, i) => i + 1);
  return {
    g: years.map((t) => (t <= 5 ? d.g[t - 1] : fade(t, d.g[4], TG, r.G))),
    m: years.map((t) => (t <= 5 ? d.m[t - 1] : d.m[4])),
    ronic: years.map((t) => fade(t, d.ronic, rate.plus(r.S), r.R)),
    terminalReturn: rate.plus(r.S),
  };
}

function checkGrid(price: Decimal, baseAt: { lower: Decimal; rate: Decimal; upper: Decimal }) {
  try {
    const chk = evaluateVerdictCheck({ price, baseAt });
    const closeCalls = UNCERTAINTY_LEVELS.filter((u) => new Set(CHECK_RATES.map((r) => chk.grid[r][u])).size > 1).length;
    return { chk, closeCalls };
  } catch {
    return { chk: null as VerdictCheck | null, closeCalls: null as number | null };
  }
}
const zones = (chk: VerdictCheck | null) => (chk === null ? "—" : chk.routing.kind === "AUTOMATIC" ? chk.routing.zone : chk.routing.kind === "CLOSE CALL" ? `CLOSE CALL ${chk.routing.zones.join("/")}` : "UNCERTAINTY Q");
const signed = (v: Decimal) => `${v.greaterThanOrEqualTo(0) ? "+" : ""}${pct(v)}`;
const bn = (v: Decimal) => `$${v.div(1e9).toFixed(1)}bn`;

function main(): void {
  mkdirSync(OUT, { recursive: true });
  const lines: string[] = [];
  const json: Record<string, unknown> = {};
  const companies = RUNS.map(load);
  const data = Object.fromEntries(companies.map((c) => [c.ticker, filedData(c.ticker, c.tax, supplement(c.ticker))]));

  lines.push("# Methodology v3 calibration #3 — final round (TEST only, #498)", "");
  lines.push("Frozen #495/#496 sheets, 19 Oct captures and 20 Oct supplementary SEC facts. † = #495's dilution supplement (not engine output). Runway OPT1 at the recorded moat class unless stated.", "");

  // Reproduction: the path engine is the round-2 engine.
  lines.push("## Reproduction of round 2 (OPT1, drafted, all scenarios and check rates)", "", "| Company | Result |", "|---|---|");
  for (const c of companies) {
    let worst = new Decimal(0);
    for (const s of ["bear", "base", "bull"] as const) {
      for (const rate of [c.rate.minus(OFF), c.rate, c.rate.plus(OFF)]) {
        const a = valueEv(c, c.drivers[s], c.tax, rate, scenarioRow(OPT1, c.moat, s)).ev;
        const b = valuePath(c, { ...designPath(c, c.drivers[s], rate, OPT1, s), tax: c.tax, rate }).ev;
        worst = Decimal.max(worst, a.minus(b).abs().div(a.abs()));
      }
    }
    if (worst.greaterThan("1e-15")) process.exitCode = 1;
    lines.push(`| ${c.label} | ${worst.greaterThan("1e-15") ? `**MISMATCH** ${worst.toExponential(2)}` : "MATCH"} |`);
  }
  lines.push("");

  // --- A. Year-1 funding --------------------------------------------------
  const baseAtRates = (c: Company, d: Drivers, design = OPT1) => {
    const at = (rate: Decimal) => perShare(c, valuePath(c, { ...designPath(c, d, rate, design, "base"), tax: c.tax, rate }).ev, d.shares);
    return { lower: at(c.rate.minus(OFF)), rate: at(c.rate), upper: at(c.rate.plus(OFF)) };
  };
  const ramp = (from: Decimal, to: Decimal) => [0, 1, 2, 3, 4].map((i) => from.plus(to.minus(from).mul(i).div(4)));
  lines.push("## A. Year-1 funding check (OPT1)", "");
  lines.push(
    "Required yr-0 investment = NOPAT_0 × g_1 ÷ RONIC_1, with NOPAT_0 = filed TTM operating income × (1 − the sheet's tax) and RONIC_1 = the drafted Base return on new capital. Available = the last fiscal year's filed net reinvestment (capex − D&A + ΔNWC + acquisitions). The shortfall is charged per share at the valuation date to Base (and to Base at each check rate).",
    "",
    "| Co. | Growth rule | g_1 | NOPAT_0 | Required | Available (FY) | Shortfall | Shortfall ÷ unfunded Base | Unfunded Base | **Funded Base** | Δ vs unfunded | Price÷Base | D3 grid (−½ / rate / +½) | Routing | Close calls |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"
  );
  const aJson: unknown[] = [];
  for (const c of companies) {
    const d = data[c.ticker];
    const nopat0 = d.ttmMargin !== null && d.ttmRevenue !== null ? d.ttmRevenue.value.mul(d.ttmMargin).mul(ONE.minus(c.tax)) : null;
    const avail = d.lastFyReinvestment;
    for (const rule of ["Drafted constant", "G1 ramp"] as const) {
      const b = c.drivers.base;
      const drivers: Drivers = rule === "G1 ramp" && d.ttmGrowth !== null ? { ...b, g: ramp(d.ttmGrowth, b.g[4]) } : b;
      const g1 = drivers.g[0];
      const unfunded = baseAtRates(c, drivers);
      if (nopat0 === null || avail === null) {
        lines.push(`| ${c.label} | ${rule} | ${pct(g1)} | n/a | — | — | NOT COMPUTED: ${nopat0 === null ? "no TTM operating income" : "no last-FY reinvestment"} | | ${money(unfunded.rate)} | | | | | | |`);
        continue;
      }
      const required = nopat0.mul(g1).div(drivers.ronic);
      const shortfall = Decimal.max(0, required.minus(avail.total));
      const perShareCharge = shortfall.div(drivers.shares);
      const funded = { lower: unfunded.lower.minus(perShareCharge), rate: unfunded.rate.minus(perShareCharge), upper: unfunded.upper.minus(perShareCharge) };
      const { chk, closeCalls } = checkGrid(c.price, funded);
      lines.push(
        `| ${c.label} | ${rule} | ${pct(g1)} | ${bn(nopat0)} | ${bn(required)} | ${bn(avail.total)} (FY${avail.fy}) | ${bn(shortfall)} ($${perShareCharge.toFixed(2)}/sh) | ${pct(perShareCharge.div(unfunded.rate))} | ${money(unfunded.rate)} | **${money(funded.rate)}** | ${signed(funded.rate.div(unfunded.rate).minus(1))} | ${c.price.div(funded.rate).toFixed(2)}× | ${grid(chk)} | ${zones(chk)} | ${closeCalls ?? "—"} |`
      );
      aJson.push({ ticker: c.label, rule, g1, nopat0, required, available: avail, shortfall, perShareCharge, unfunded, funded, grid: chk?.grid ?? null, routing: chk?.routing ?? null, closeCalls });
    }
  }
  json.yearOneFunding = aJson;
  lines.push(
    "",
    "Available reinvestment components (last fiscal year, capex − D&A / ΔNWC / acquisitions): " +
      companies
        .map((c) => {
          const a = data[c.ticker].lastFyReinvestment;
          return a ? `${c.label} FY${a.fy} ${bn(a.capexLessDa)} / ${bn(a.dNwc)} / ${bn(a.acquisitions)}` : `${c.label} n/a`;
        })
        .join("; ") +
      ".",
    ""
  );

  // --- B. Morningstar replication (MSFT) -------------------------------------
  const msft = companies.find((c) => c.ticker === "MSFT")!;
  const md = data.MSFT;
  const MS = { g1: new Decimal("0.138"), marginTo: new Decimal("0.476"), g2: new Decimal("0.089"), investmentRate: new Decimal("0.40"), rate: new Decimal("0.085") };
  const years20 = Array.from({ length: 20 }, (_, i) => i + 1);
  const ttmMargin = md.ttmMargin!;
  const msMargin = years20.map((t) => (t <= 5 ? ttmMargin.plus(MS.marginTo.minus(ttmMargin).mul(t).div(5)) : MS.marginTo));
  // Morningstar structure: 5 explicit years; 15 years of constant growth at a constant investment rate; perpetuity
  // from year 20 at a return equal to the rate. With "this year's investment funds next year's growth", a constant
  // investment rate k means RONIC_t = g_(t+1) ÷ k for t = 1..19; year 20's reinvestment funds terminal growth at the rate.
  const msStructure = (g1to5: Decimal, g6to20: Decimal, m: Decimal[], ronicFor: (t: number, gNext: Decimal) => Decimal, rate: Decimal) => {
    const g = years20.map((t) => (t <= 5 ? g1to5 : g6to20));
    const ronic = years20.map((t) => (t < 20 ? ronicFor(t, g[t]) : rate));
    return { g, m, ronic, terminalReturn: rate };
  };
  const msRonic = (_t: number, gNext: Decimal) => gNext.div(MS.investmentRate);
  const b = msft.drivers.base;
  // B2's stage 2 uses our drafted path's own 15-year averages (yrs 6–20 under OPT1), held constant, since the drafted
  // sheet states no stage-2 levels of its own.
  const ours = designPath(msft, b, msft.rate, OPT1, "base");
  const avg = (v: Decimal[]) => v.reduce((s, x) => s.plus(x), new Decimal(0)).div(v.length);
  const ourStage2G = avg(ours.g.slice(5, 20));
  const ourStage2R = avg(ours.ronic.slice(5, 19));
  const B: { key: string; label: string; p: ReturnType<typeof msStructure>; rate: Decimal }[] = [
    { key: "B1", label: "Morningstar structure + Morningstar inputs @ 8.5%", p: msStructure(MS.g1, MS.g2, msMargin, msRonic, MS.rate), rate: MS.rate },
    { key: "B1@9", label: "Morningstar structure + Morningstar inputs @ 9.0%", p: msStructure(MS.g1, MS.g2, msMargin, msRonic, msft.rate), rate: msft.rate },
    { key: "B2", label: "Morningstar structure + our drafted inputs @ 9.0%", p: msStructure(b.g[0], ourStage2G, years20.map(() => b.m[0]), (t) => (t <= 4 ? b.ronic : ourStage2R), msft.rate), rate: msft.rate },
    {
      key: "B3",
      label: "Our structure (OPT1) + Morningstar inputs @ 9.0%",
      p: designPath(msft, { g: flat(MS.g1), m: msMargin.slice(0, 5), ronic: MS.g1.div(MS.investmentRate), shares: b.shares }, msft.rate, OPT1, "base"),
      rate: msft.rate,
    },
    { key: "OURS", label: "Our structure (OPT1) + our drafted inputs @ 9.0% (reference)", p: ours, rate: msft.rate },
  ];
  const bValues: Record<string, Decimal> = {};
  lines.push("## B. Morningstar replication — MSFT (humility check, not a target)", "");
  lines.push(
    `Morningstar inputs: 13.8% growth yrs 1–5; operating margin from TTM ${pct(ttmMargin)} linearly to 47.6% by yr 5, then held; 8.9% growth yrs 6–20 at a 40% investment rate (return on new capital ${pct(MS.g2.div(MS.investmentRate))}); yrs 1–5 also at 40% (return ${pct(MS.g1.div(MS.investmentRate))}); perpetuity from yr 20 at return = rate. Held at our values throughout: tax ${pct(msft.tax)}, D2 timing (mid-year, price-date stub), bridge and Base share count. Our stage-2 levels for B2 are our OPT1 path's yr 6–20 averages: growth ${pct(ourStage2G)}, return on new capital ${pct(ourStage2R)}.`,
    "",
    "| Run | Base | Price÷Base | TV share |",
    "|---|---|---|---|"
  );
  for (const x of B) {
    const v = valuePath(msft, { ...x.p, tax: msft.tax, rate: x.rate });
    const base = perShare(msft, v.ev, b.shares);
    bValues[x.key] = base;
    lines.push(`| ${x.key} — ${x.label} | **${money(base)}** | ${msft.price.div(base).toFixed(2)}× | ${pct(v.tvPv.div(v.ev), 0)} |`);
  }
  const split = [
    ["Inputs (our structure): B3 − ours", bValues.B3.minus(bValues.OURS)],
    ["Structure (Morningstar inputs): B1@9 − B3", bValues["B1@9"].minus(bValues.B3)],
    ["Rate: B1 − B1@9", bValues.B1.minus(bValues["B1@9"])],
  ] as const;
  const total = bValues.B1.minus(bValues.OURS);
  lines.push("", `Split of B1 − ours (${money(bValues.B1)} − ${money(bValues.OURS)} = ${money(total)}), one order:`, "", "| Step | $/share | Share of gap |", "|---|---|---|");
  for (const [k, v] of split) lines.push(`| ${k} | ${v.greaterThanOrEqualTo(0) ? "+" : ""}${money(v)} | ${pct(v.div(total), 0)} |`);
  const alt = [
    ["Structure (our inputs): B2 − ours", bValues.B2.minus(bValues.OURS)],
    ["Inputs (Morningstar structure): B1@9 − B2", bValues["B1@9"].minus(bValues.B2)],
    ["Rate: B1 − B1@9", bValues.B1.minus(bValues["B1@9"])],
  ] as const;
  lines.push("", "The other order:", "", "| Step | $/share | Share of gap |", "|---|---|---|");
  for (const [k, v] of alt) lines.push(`| ${k} | ${v.greaterThanOrEqualTo(0) ? "+" : ""}${money(v)} | ${pct(v.div(total), 0)} |`);
  const shap = (x: Decimal, y: Decimal) => x.plus(y).div(2);
  const sInputs = shap(bValues.B3.minus(bValues.OURS), bValues["B1@9"].minus(bValues.B2));
  const sStructure = shap(bValues["B1@9"].minus(bValues.B3), bValues.B2.minus(bValues.OURS));
  const sRate = bValues.B1.minus(bValues["B1@9"]);
  lines.push(
    "",
    `Order-independent (average of the two orders): inputs ${money(sInputs)} (${pct(sInputs.div(total), 0)}), structure ${money(sStructure)} (${pct(sStructure.div(total), 0)}), rate ${money(sRate)} (${pct(sRate.div(total), 0)}). Inputs and structure interact: Morningstar's structure is worth +$105 with its own inputs but −$13 with ours.`,
    ""
  );
  json.morningstar = { average: { inputs: sInputs, structure: sStructure, rate: sRate }, values: bValues, split: Object.fromEntries(split), alternativeSplit: Object.fromEntries(alt), ourStage2G, ourStage2R };

  // --- C. Growth plateau as Bull ------------------------------------------------
  lines.push("## C. Growth plateau as Bull — wide-moat companies", "");
  lines.push(
    "Bull = drafted Bull drivers; growth yrs 1–5 as drafted, yrs 6–15 at min(drafted yr-5 Bull rate, 9%), linear to 3% by yr 20; return on new capital fades from the drafted Bull value to the rate by yr 20 (R = 20, S = 0); terminal value from yr 19.5. The OPT1 Bull carries S = +1.5pp (D2's bull uplift); the plateau Bull carries S = 0 as specified.",
    "",
    "| Co. | Bull g yrs 1–5 → plateau | CURRENT Bull | OPT1 Bull | **Plateau Bull** | vs OPT1 Bull | Base (unchanged) | Verdict (OPT1) |",
    "|---|---|---|---|---|---|---|---|"
  );
  const cJson: unknown[] = [];
  for (const c of companies.filter((x) => x.moat === "wide")) {
    const bull = c.drivers.bull;
    const plateau = Decimal.min(bull.g[4], new Decimal("0.09"));
    const g = years20.map((t) => (t <= 5 ? bull.g[t - 1] : t <= 15 ? plateau : plateau.minus(plateau.minus(TG).mul(t - 15).div(5))));
    const p = { g, m: years20.map(() => bull.m[0]), ronic: years20.map((t) => fade(t, bull.ronic, c.rate, 20)), terminalReturn: c.rate };
    const plateauBull = perShare(c, valuePath(c, { ...p, tax: c.tax, rate: c.rate }).ev, bull.shares);
    const bullAt = (design: (typeof DESIGNS)[number]) => perShare(c, valuePath(c, { ...designPath(c, bull, c.rate, design, "bull"), tax: c.tax, rate: c.rate }).ev, bull.shares);
    // The D3 check (evaluateVerdictCheck) takes only the price and Base at the three check rates; the Bull is not
    // an input, so a different Bull cannot move the verdict. Base is recomputed here to show it is the same figure.
    const base = baseAtRates(c, c.drivers.base);
    const { chk } = checkGrid(c.price, base);
    lines.push(
      `| ${c.label} | ${pct(bull.g[0])} → ${pct(plateau)} | ${money(bullAt(CURRENT))} | ${money(bullAt(OPT1))} | **${money(plateauBull)}** | ${signed(plateauBull.div(bullAt(OPT1)).minus(1))} | ${money(base.rate)} | ${zones(chk)} (Bull is not a D3 input) |`
    );
    cJson.push({ ticker: c.label, plateau, currentBull: bullAt(CURRENT), opt1Bull: bullAt(OPT1), plateauBull, base: base.rate, routing: chk?.routing ?? null });
  }
  json.plateauBull = cJson;
  lines.push("");

  writeFileSync(path.join(OUT, "results.md"), lines.join("\n") + "\n");
  writeFileSync(path.join(OUT, "results.json"), JSON.stringify(json, (_k, v) => (v instanceof Decimal ? v.toString() : v), 2) + "\n");
  console.log(lines.join("\n"));
}

main();
