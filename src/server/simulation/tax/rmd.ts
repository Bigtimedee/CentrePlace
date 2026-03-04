// ─────────────────────────────────────────────────────────────────────────────
// Required Minimum Distributions (RMDs)
// ─────────────────────────────────────────────────────────────────────────────
//
// Under SECURE Act 2.0 (effective 2023), RMDs begin at age 73.
// Amount = prior-year-end balance ÷ IRS Uniform Lifetime Table factor.
//
// Eligible account types: traditional IRA, traditional 401(k), SEP-IRA, Solo 401(k).
// Exempt: Roth IRA, Roth 401(k) (SECURE Act 2.0, effective 2024+).
// ─────────────────────────────────────────────────────────────────────────────

// IRS Uniform Lifetime Table (SECURE 2.0 updated table, effective 2022+)
const UNIFORM_LIFETIME_TABLE: Record<number, number> = {
  73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1,
  80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2,
  87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1,
  94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8,
  100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6,
  106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5,
};

export const RMD_START_AGE = 73;

export const RMD_ELIGIBLE_ACCOUNT_TYPES = new Set([
  "traditional_ira",
  "traditional_401k",
  "sep_ira",
  "solo_401k",
]);

/**
 * Returns the IRS Uniform Lifetime divisor for a given age.
 * Returns null if the age is below the RMD start age.
 * Ages above 110 use 3.5 (the table minimum).
 */
export function getRMDFactor(age: number): number | null {
  if (age < RMD_START_AGE) return null;
  return UNIFORM_LIFETIME_TABLE[Math.min(age, 110)] ?? 3.5;
}
