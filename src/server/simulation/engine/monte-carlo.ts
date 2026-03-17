// ─────────────────────────────────────────────────────────────────────────────
// Monte Carlo Engine — Probabilistic FI Forecasting
// ─────────────────────────────────────────────────────────────────────────────
//
// Runs N simplified annual simulations with log-normal investment returns.
// Uses the deterministic quarterly result for non-investment cash flows
// (carry, W-2, rental, spending) and RE / insurance buckets.
// ─────────────────────────────────────────────────────────────────────────────

import type { SimulationInput, SimulationResult } from "./types";
import type {
  MonteCarloOptions,
  MonteCarloResult,
  MonteCarloYearBand,
} from "./monte-carlo-types";

const YEARS = 40;
const CARRY_TAX = 0.238; // simplified LTCG + NIIT rate
const W2_TAX = 0.50;     // simplified effective rate for high-W2 earners

// ── Box-Muller normal RNG ─────────────────────────────────────────────────────

function randNormal(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ── Percentile helper (requires sorted array) ─────────────────────────────────

function percentile(sorted: number[], p: number): number {
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

// ── Main engine ───────────────────────────────────────────────────────────────

export function runMonteCarlo(
  simInput: SimulationInput,
  deterministicResult: SimulationResult,
  options: MonteCarloOptions,
): MonteCarloResult {
  const { simulations, returnVolatility: σ, varyCarryHaircut } = options;
  const { startYear, currentAge } = deterministicResult;
  const μ = simInput.profile.assumedReturnRate;

  // ── Q4 snapshots for each of 40 years ──────────────────────────────────────
  const q4Rows = Array.from({ length: YEARS }, (_, t) => {
    const year = startYear + t;
    return deterministicResult.quarters.find(
      q => q.year === year && q.quarterLabel === "Q4",
    ) ?? null;
  });

  // ── Annual carry, LP, and W-2 sums across all 4 quarters ──────────────────
  const annualCarry = Array.from({ length: YEARS }, (_, t) => {
    const year = startYear + t;
    return deterministicResult.quarters
      .filter(q => q.year === year)
      .reduce((s, q) => s + q.carryIncome, 0);
  });

  const annualLP = Array.from({ length: YEARS }, (_, t) => {
    const year = startYear + t;
    return deterministicResult.quarters
      .filter(q => q.year === year)
      .reduce((s, q) => s + q.lpIncome, 0);
  });

  // W-2 income includes bonus paid in Q1 — sum all 4 quarters to capture it correctly
  const annualW2 = Array.from({ length: YEARS }, (_, t) => {
    const year = startYear + t;
    return deterministicResult.quarters
      .filter(q => q.year === year)
      .reduce((s, q) => s + q.w2Income, 0);
  });

  // ── Carry tranches by year (for varyCarryHaircut) ───────────────────────────
  // Build map: year → array of {carry, pct} pairs for each tranche realizing that year
  type CarryTranche = { carry: typeof simInput.carry[0]; pct: number };
  const carryByYear = new Map<number, CarryTranche[]>();
  for (const c of simInput.carry) {
    for (const t of c.realizationSchedule) {
      if (!carryByYear.has(t.year)) carryByYear.set(t.year, []);
      carryByYear.get(t.year)!.push({ carry: c, pct: t.pct });
    }
  }

  // ── Seed investment capital from current account balances ──────────────────
  const initialInvestmentCapital = simInput.investmentAccounts.reduce(
    (s, a) => s + a.currentBalance,
    0,
  );

  // ── Annual net spending per year ────────────────────────────────────────────
  // Computed directly from expenditures (inflation-adjusted). Rental income is
  // added separately in step 4, so full gross spending is deducted here.
  const annualNetSpending = Array.from({ length: YEARS }, (_, t) => {
    const year = startYear + t;
    return simInput.recurringExpenditures.reduce((sum, e) => {
      return sum + e.annualAmount * Math.pow(1 + e.growthRate, year - startYear);
    }, 0);
  });

  // ── Run N simulations ──────────────────────────────────────────────────────
  // yearEndCapitals[t][sim] = total capital at end of year t for simulation sim
  const yearEndCapitals: number[][] = Array.from({ length: YEARS }, () =>
    new Array(simulations).fill(0),
  );
  const fiYears: (number | null)[] = new Array(simulations).fill(null);

  for (let sim = 0; sim < simulations; sim++) {
    let investmentCapital = initialInvestmentCapital;

    for (let t = 0; t < YEARS; t++) {
      const q4 = q4Rows[t];
      if (!q4) continue;
      const year = startYear + t;

      // 1. Random log-normal investment return: E[r_t] = e^μ
      const Z = randNormal();
      investmentCapital *= Math.exp(Z * σ + (μ - (σ * σ) / 2));

      // 2. Carry + LP net proceeds (post simplified tax); floor at 0 (no negative carry)
      let carryLP: number;
      if (varyCarryHaircut) {
        const tranches = carryByYear.get(year) ?? [];
        carryLP =
          Math.max(0, tranches.reduce((s, { carry: c, pct }) => {
            const randomHaircut = Math.random() * 2 * c.haircutPct;
            return s + c.expectedGrossCarry * pct * (1 - randomHaircut);
          }, 0)) + Math.max(0, annualLP[t]);
      } else {
        carryLP = Math.max(0, annualCarry[t]) + Math.max(0, annualLP[t]);
      }
      investmentCapital += carryLP * (1 - CARRY_TAX);

      // 3. W-2 net income (annual sum across all quarters captures salary + bonus)
      investmentCapital += annualW2[t] * (1 - W2_TAX);

      // 4. Rental net income (quarterly × 4 for annual)
      investmentCapital += q4.rentalNetIncome * 4;

      // 5. Annual spending (inflation-adjusted gross spending; rental income added above)
      investmentCapital -= annualNetSpending[t];

      // 6. Track investable capital (investment accounts + carry/LP proceeds).
      // RE equity and insurance CV are deterministic and excluded from the stochastic
      // FI test — they cannot generate the investment income stream needed to sustain spending.
      yearEndCapitals[t][sim] = Math.max(0, investmentCapital) + q4.realEstateEquity + q4.insuranceCashValue;

      // 7. FI detection: investable capital must cover the after-tax perpetuity threshold
      if (fiYears[sim] === null && investmentCapital >= q4.requiredCapital) {
        fiYears[sim] = year;
      }
    }
  }

  // ── Build annual bands ─────────────────────────────────────────────────────
  const bands: MonteCarloYearBand[] = [];

  for (let t = 0; t < YEARS; t++) {
    const year = startYear + t;
    const q4 = q4Rows[t];
    if (!q4) continue;

    const sorted = [...yearEndCapitals[t]].sort((a, b) => a - b);
    const pctFI =
      fiYears.filter(fy => fy !== null && fy <= year).length / simulations;

    bands.push({
      year,
      age: currentAge + t,
      p10: percentile(sorted, 0.1),
      p25: percentile(sorted, 0.25),
      p50: percentile(sorted, 0.5),
      p75: percentile(sorted, 0.75),
      p90: percentile(sorted, 0.9),
      pctFI,
      base: q4.totalCapital,
      requiredCapital: q4.requiredCapital,
    });
  }

  // ── Summary statistics ─────────────────────────────────────────────────────
  const deterministicFiYear = deterministicResult.fiDate?.year ?? null;
  const medianFiYear = bands.find(b => b.pctFI >= 0.5)?.year ?? null;
  const medianFiAge =
    medianFiYear !== null ? currentAge + (medianFiYear - startYear) : null;
  const p25FiYear = bands.find(b => b.pctFI >= 0.25)?.year ?? null;
  const p75FiYear = bands.find(b => b.pctFI >= 0.75)?.year ?? null;

  let pFIByBaseYear = 0;
  if (deterministicFiYear !== null) {
    const band = bands.find(b => b.year === deterministicFiYear);
    pFIByBaseYear = band?.pctFI ?? 0;
  }

  return {
    bands,
    medianFiYear,
    medianFiAge,
    p25FiYear,
    p75FiYear,
    pFIByBaseYear,
    deterministicFiYear,
    simulations,
    startYear,
    options,
  };
}
