// ─────────────────────────────────────────────────────────────────────────────
// Tax Engine — Public API
// ─────────────────────────────────────────────────────────────────────────────

export * from "./types";
export * from "./federal-income";
export * from "./state-income";
export * from "./estate-tax";
export * from "./city-income";
export * from "./payroll-tax";
export * from "./rmd";

// ── Combined annual tax calculator ───────────────────────────────────────────
// Convenience function used by the quarterly simulation engine.
// Returns total tax burden (federal + state + FICA) for a given year's income.

import { calculateFederalTax } from "./federal-income";
import { calculateStateTax } from "./state-income";
import { calculateFicaTax } from "./payroll-tax";
import type { FilingStatus } from "./types";

export interface AnnualTaxInput {
  /** W-2 wages, business income, interest, short-term gains */
  ordinaryIncome: number;
  /** Qualified dividends */
  qualifiedDividends: number;
  /** Net long-term capital gains (after losses) */
  longTermGains: number;
  /** Unrecaptured § 1250 depreciation recapture */
  unrecaptured1250Gain: number;
  /** Adjusted gross income (used for NIIT threshold) */
  agi: number;
  filingStatus: FilingStatus;
  stateCode: string;
  year: number;
  /** W-2 wages only (salary + bonus). Used for CA SDI and city wage taxes. */
  w2Wages?: number;
  /** City/local tax jurisdiction code (e.g. "NYC", "PHL"). */
  cityCode?: string;
}

export interface AnnualTaxResult {
  federalOrdinaryTax: number;
  federalLtcgTax: number;
  federalNiit: number;
  federalDepreciationRecaptureTax: number;
  totalFederalTax: number;
  stateIncomeTax: number;
  /** CA SDI (1.1% of W-2 wages). Zero for all other states. */
  sdiTax: number;
  /** City/local income tax (NYC, Philadelphia, etc.). Zero if not applicable. */
  cityIncomeTax: number;
  /** Employee Social Security tax (6.2% up to SS wage base). Zero when no W-2 wages. */
  ficaSocialSecurityTax: number;
  /** Employee Medicare tax (1.45% on all W-2 wages). Zero when no W-2 wages. */
  ficaMedicareTax: number;
  /** ACA Additional Medicare Tax (0.9% on W-2 wages above $200k/$250k MFJ). */
  ficaAdditionalMedicareTax: number;
  /** Sum of all three FICA components. */
  totalFicaTax: number;
  totalTax: number;
  effectiveFederalRate: number;
  effectiveStateRate: number;
  effectiveTotalRate: number;
}

export function calculateAnnualTax(input: AnnualTaxInput): AnnualTaxResult {
  const {
    ordinaryIncome,
    qualifiedDividends,
    longTermGains,
    unrecaptured1250Gain,
    agi,
    filingStatus,
    stateCode,
    year,
    w2Wages,
    cityCode,
  } = input;

  const federal = calculateFederalTax({
    ordinaryIncome,
    qualifiedDividends,
    longTermGains,
    unrecaptured1250Gain,
    agi,
    filingStatus,
    year,
  });

  const state = calculateStateTax({
    stateCode,
    ordinaryIncome,
    longTermGains,
    shortTermGains: 0,
    filingStatus,
    year,
    w2Wages,
    cityCode,
  });

  const fica = calculateFicaTax({
    w2Wages: w2Wages ?? 0,
    filingStatus,
    year,
  });

  const totalIncome =
    ordinaryIncome + qualifiedDividends + longTermGains + unrecaptured1250Gain;
  const totalTax =
    federal.totalFederalTax +
    state.stateIncomeTax + state.sdiTax + state.cityIncomeTax +
    fica.totalFicaTax;

  return {
    federalOrdinaryTax: federal.ordinaryTax,
    federalLtcgTax: federal.ltcgTax,
    federalNiit: federal.niit,
    federalDepreciationRecaptureTax: federal.depreciationRecaptureTax,
    totalFederalTax: federal.totalFederalTax,
    stateIncomeTax: state.stateIncomeTax,
    sdiTax: state.sdiTax,
    cityIncomeTax: state.cityIncomeTax,
    ficaSocialSecurityTax: fica.socialSecurityTax,
    ficaMedicareTax: fica.medicareTax,
    ficaAdditionalMedicareTax: fica.additionalMedicareTax,
    totalFicaTax: fica.totalFicaTax,
    totalTax,
    effectiveFederalRate: federal.effectiveRate,
    effectiveStateRate: state.effectiveRate,
    effectiveTotalRate: totalIncome > 0 ? totalTax / totalIncome : 0,
  };
}

// ── Safe Harbor Quarterly Estimate ───────────────────────────────────────────
// Used by the quarterly simulation to model estimated tax payments.
// Safe harbor = pay 100% of prior-year tax (or 110% if prior-year AGI > $150k).

export function safeHarborQuarterlyPayment(
  priorYearTax: number,
  priorYearAgi: number
): number {
  const safeHarborRate = priorYearAgi > 150_000 ? 1.10 : 1.00;
  return (priorYearTax * safeHarborRate) / 4;
}
