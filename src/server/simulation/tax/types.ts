// ─────────────────────────────────────────────────────────────────────────────
// Tax Engine — Shared Types
// ─────────────────────────────────────────────────────────────────────────────

export type FilingStatus = "single" | "married_filing_jointly";

export type IncomeType =
  | "ordinary"          // W-2, interest, short-term gains
  | "qualified_dividend"// Taxed at LTCG rates
  | "long_term_gain"    // LTCG (≥ 1 year)
  | "carried_interest"  // GP carry — federal LTCG rate (assumed held > 3yr)
  | "depreciation_recapture" // Unrecaptured § 1250 gain — 25% federal max
  | "roth_distribution" // Tax-free
  | "return_of_capital";// Tax-free (basis recovery)

export interface FederalTaxInput {
  ordinaryIncome: number;         // W-2, business income, interest, STCG, ord divs
  qualifiedDividends: number;     // Qualified divs taxed at LTCG rate
  longTermGains: number;          // LTCG from sales and carry
  unrecaptured1250Gain: number;   // Depreciation recapture (25% cap)
  agi: number;                    // Adjusted gross income (for NIIT, phase-outs)
  filingStatus: FilingStatus;
  year: number;                   // For future-year bracket adjustments
}

export interface FederalTaxResult {
  ordinaryTax: number;
  ltcgTax: number;
  niit: number;                   // 3.8% net investment income tax
  depreciationRecaptureTax: number;
  totalFederalTax: number;
  effectiveRate: number;          // total / (ordinaryIncome + qualifiedDividends + longTermGains + unrecaptured1250Gain)
}

export interface StateTaxInput {
  stateCode: string;              // Two-letter state code, e.g. "CA", "NY"
  ordinaryIncome: number;
  longTermGains: number;          // Some states have preferential LTCG treatment
  shortTermGains: number;
  filingStatus: FilingStatus;
  year: number;
  /** W-2 wages only (salary + bonus). Used for CA SDI and city wage taxes. Defaults to ordinaryIncome if omitted. */
  w2Wages?: number;
  /** City/local tax jurisdiction code (e.g. "NYC", "PHL"). Drives local tax calculation. */
  cityCode?: string;
}

export interface StateTaxResult {
  stateIncomeTax: number;
  /** CA State Disability Insurance (1.1% of W-2 wages). Zero for all other states. */
  sdiTax: number;
  /** City/local income tax. Zero if no cityCode or city not recognized. */
  cityIncomeTax: number;
  effectiveRate: number;
  ltcgTreatment: "ordinary" | "preferential" | "exempt";
}

export interface EstateTaxInput {
  grossEstate: number;            // Total estate value
  ilitDeathBenefit: number;       // Excluded from estate (held in ILIT)
  charitableDeductions: number;
  maritalDeduction: number;       // Unlimited if spouse is US citizen
  stateCode: string;
  filingStatus: FilingStatus;
  year: number;
}

export interface EstateTaxResult {
  federalTaxableEstate: number;
  federalEstateTax: number;
  stateEstateTax: number;
  totalEstateTax: number;
  netEstate: number;              // grossEstate − ilitDeathBenefit − total tax
}
