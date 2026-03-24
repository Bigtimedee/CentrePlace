// Pure utilities shared between the reinvestment-policy panel and tests.

export const REINVESTMENT_RATE_DEFAULTS = {
  equityAppreciationRate: 5.5,
  equityQualifiedYieldRate: 1.5,
  taxableFixedIncomeRate: 4,
  taxExemptFixedIncomeRate: 3,
  reAppreciationRate: 4,
  reGrossYieldRate: 6,
  reCarryingCostRate: 2,
};

export type PolicyForm = {
  equityPct: number;
  equityAppreciationRate: number;
  equityQualifiedYieldRate: number;
  taxableFixedIncomePct: number;
  taxableFixedIncomeRate: number;
  taxExemptFixedIncomePct: number;
  taxExemptFixedIncomeRate: number;
  realEstatePct: number;
  reAppreciationRate: number;
  reGrossYieldRate: number;
  reCarryingCostRate: number;
};

/**
 * Maps a 3-bucket allocation target { equity, bond, alt } (fractions 0-1) to
 * a 4-bucket PolicyForm (percentage values).  Bond is split 60 / 40 between
 * taxable and tax-exempt fixed income.
 */
export function allocationTargetToPolicyForm(target: {
  equity: number;
  bond: number;
  alt: number;
}): PolicyForm {
  return {
    equityPct: Math.round(target.equity * 100 * 10) / 10,
    taxableFixedIncomePct: Math.round(target.bond * 0.6 * 100 * 10) / 10,
    taxExemptFixedIncomePct: Math.round(target.bond * 0.4 * 100 * 10) / 10,
    realEstatePct: Math.round(target.alt * 100 * 10) / 10,
    ...REINVESTMENT_RATE_DEFAULTS,
  };
}
