export interface MonteCarloOptions {
  simulations: number;       // default 500
  returnVolatility: number;  // annual stddev, default 0.12 (12%)
  varyCarryHaircut: boolean; // default false
}

export interface MonteCarloYearBand {
  year: number;
  age: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  /** Fraction of simulations that have reached FI by this year (0–1) */
  pctFI: number;
  /** Deterministic base-case capital for this year (from Q4 result) */
  base: number;
  /** Required capital for FI in this year (from deterministic Q4 result) */
  requiredCapital: number;
}

export interface MonteCarloResult {
  bands: MonteCarloYearBand[];       // 40 annual snapshots
  medianFiYear: number | null;
  medianFiAge: number | null;
  p25FiYear: number | null;          // 75th-percentile-case (faster FI)
  p75FiYear: number | null;          // 25th-percentile-case (slower FI)
  pFIByBaseYear: number;             // probability of FI by deterministicFiYear (0–1)
  deterministicFiYear: number | null;
  simulations: number;
  startYear: number;
  options: MonteCarloOptions;
}
