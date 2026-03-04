// ─────────────────────────────────────────────────────────────────────────────
// FICA — Employee Payroll Tax Calculator
// ─────────────────────────────────────────────────────────────────────────────
//
// Employee share of FICA (Federal Insurance Contributions Act):
//   • Social Security:  6.2% on wages up to the annual wage base
//   • Medicare:         1.45% on all wages (no cap)
//   • Additional Medicare Tax (ACA §1411): 0.9% on wages above threshold
//
// SS wage base grows ~3.5%/yr with the national average wage index.
// Additional Medicare Tax threshold: $200k single / $250k MFJ (not inflation-adjusted).
// ─────────────────────────────────────────────────────────────────────────────

import type { FilingStatus } from "./types";

const SS_RATE = 0.062;
const MEDICARE_RATE = 0.0145;
const ADDITIONAL_MEDICARE_RATE = 0.009;

// 2025 wage base ($176,100); grows with national average wage index (~3.5%/yr)
const SS_WAGE_BASE_2025 = 176_100;
const SS_WAGE_BASE_GROWTH = 0.035;

// ACA thresholds — not inflation-adjusted by law
const ADDITIONAL_MEDICARE_THRESHOLD: Record<FilingStatus, number> = {
  single: 200_000,
  married_filing_jointly: 250_000,
};

export interface FicaTaxResult {
  /** Employee share of Social Security (6.2% up to wage base) */
  socialSecurityTax: number;
  /** Employee share of Medicare (1.45% on all wages) */
  medicareTax: number;
  /** ACA Additional Medicare Tax (0.9% on wages above threshold) */
  additionalMedicareTax: number;
  /** Sum of all three FICA components */
  totalFicaTax: number;
}

export function calculateFicaTax(input: {
  w2Wages: number;
  filingStatus: FilingStatus;
  year: number;
}): FicaTaxResult {
  const { w2Wages, filingStatus, year } = input;
  if (w2Wages <= 0) {
    return { socialSecurityTax: 0, medicareTax: 0, additionalMedicareTax: 0, totalFicaTax: 0 };
  }

  const yearsFromBase = Math.max(0, year - 2025);
  const ssWageBase = SS_WAGE_BASE_2025 * Math.pow(1 + SS_WAGE_BASE_GROWTH, yearsFromBase);

  const socialSecurityTax = Math.min(w2Wages, ssWageBase) * SS_RATE;
  const medicareTax = w2Wages * MEDICARE_RATE;
  const threshold = ADDITIONAL_MEDICARE_THRESHOLD[filingStatus];
  const additionalMedicareTax = Math.max(0, w2Wages - threshold) * ADDITIONAL_MEDICARE_RATE;

  return {
    socialSecurityTax,
    medicareTax,
    additionalMedicareTax,
    totalFicaTax: socialSecurityTax + medicareTax + additionalMedicareTax,
  };
}
