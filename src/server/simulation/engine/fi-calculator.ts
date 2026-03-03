// ─────────────────────────────────────────────────────────────────────────────
// FI Calculator — Required Capital Formula
// ─────────────────────────────────────────────────────────────────────────────
//
// Required capital = PV of an annuity that funds (annualSpending - permanentIncome)
// for the remaining years until targetAge, growing at the assumed return rate.
//
//   PV = PMT × [1 − (1 + r)^(−n)] / r
//
// where:
//   PMT = netAnnualNeed (spending net of permanent income)
//   r   = assumed annual portfolio return rate
//   n   = yearsRemaining (targetAge − currentAge)
// ─────────────────────────────────────────────────────────────────────────────

import type { SimRecurringExpenditure, SimRealEstateProperty } from "./types";

/**
 * Present value of an ordinary annuity.
 * Returns the lump-sum needed today to fund `pmt` per year for `n` years
 * at annual return rate `r`.
 */
export function pvAnnuity(pmt: number, r: number, n: number): number {
  if (n <= 0 || pmt <= 0) return 0;
  if (r === 0) return pmt * n;
  return pmt * (1 - Math.pow(1 + r, -n)) / r;
}

/**
 * Compute the total annual spending at a given simulation year.
 * Applies each expenditure's growth rate compounded from startYear.
 */
export function computeAnnualSpending(
  expenditures: SimRecurringExpenditure[],
  currentYear: number,
  startYear: number,
): number {
  return expenditures.reduce((sum, exp) => {
    const years = currentYear - startYear;
    return sum + exp.annualAmount * Math.pow(1 + exp.growthRate, years);
  }, 0);
}

/**
 * Compute the permanent annual income that reduces the capital required for FI.
 * Only rental and commercial properties contribute permanent income post-FI.
 */
export function computePermanentAnnualIncome(properties: SimRealEstateProperty[]): number {
  return properties.reduce((sum, p) => {
    if (p.propertyType !== "rental" && p.propertyType !== "commercial") return sum;
    const netAnnual = (p.annualRentalIncome - p.annualOperatingExpenses) * p.ownershipPct;
    return sum + Math.max(0, netAnnual);
  }, 0);
}

/**
 * Compute total capital required to achieve FI at the given simulation step.
 *
 * @param annualSpending  Projected annual spending in the current year
 * @param permanentIncome Permanent annual income (net rental) post-FI
 * @param returnRate      Annual portfolio return rate (e.g. 0.07)
 * @param yearsRemaining  Years from current age to targetAge
 */
export function computeRequiredCapital(
  annualSpending: number,
  permanentIncome: number,
  returnRate: number,
  yearsRemaining: number,
): number {
  const netAnnualNeed = Math.max(0, annualSpending - permanentIncome);
  return pvAnnuity(netAnnualNeed, returnRate, yearsRemaining);
}
