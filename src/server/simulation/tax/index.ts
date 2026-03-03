// ─────────────────────────────────────────────────────────────────────────────
// Tax Engine — Public API
// ─────────────────────────────────────────────────────────────────────────────

export * from "./types";
export * from "./federal-income";
export * from "./state-income";
export * from "./estate-tax";

// ── Combined annual tax calculator ───────────────────────────────────────────
// Convenience function used by the quarterly simulation engine.
// Returns total tax burden (federal + state) for a given year's income.

import { calculateFederalTax } from "./federal-income";
import { calculateStateTax } from "./state-income";
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
}

export interface AnnualTaxResult {
  federalOrdinaryTax: number;
  federalLtcgTax: number;
  federalNiit: number;
  federalDepreciationRecaptureTax: number;
  totalFederalTax: number;
  stateIncomeTax: number;
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
    shortTermGains: 0, // short-term gains included in ordinaryIncome
    filingStatus,
    year,
  });

  const totalIncome =
    ordinaryIncome + qualifiedDividends + longTermGains + unrecaptured1250Gain;
  const totalTax = federal.totalFederalTax + state.stateIncomeTax;

  return {
    federalOrdinaryTax: federal.ordinaryTax,
    federalLtcgTax: federal.ltcgTax,
    federalNiit: federal.niit,
    federalDepreciationRecaptureTax: federal.depreciationRecaptureTax,
    totalFederalTax: federal.totalFederalTax,
    stateIncomeTax: state.stateIncomeTax,
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
