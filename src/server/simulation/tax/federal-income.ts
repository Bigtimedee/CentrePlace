// ─────────────────────────────────────────────────────────────────────────────
// Federal Income Tax Engine
// Brackets reflect 2026 law (TCJA sunset — pre-TCJA rates restored)
// ─────────────────────────────────────────────────────────────────────────────
//
// If TCJA is extended by Congress, update BRACKETS_2026 below to match 2025
// TCJA rates. The architecture is the same; only the bracket tables change.
//
// References:
//   IRS Rev. Proc. 2024-40 (2025 inflation adjustments)
//   TCJA sunset provisions effective January 1, 2026

import type { FilingStatus, FederalTaxInput, FederalTaxResult } from "./types";

interface Bracket {
  rate: number;
  upTo: number; // taxable income ceiling (Infinity for top bracket)
}

// ── 2026 Ordinary Income Brackets (post-TCJA-sunset) ─────────────────────────
// Rates: 10 / 15 / 25 / 28 / 33 / 35 / 39.6%
// Thresholds below are approximate 2026 projections via CBO inflation estimates.
// Update annually via Rev. Proc.

const ORDINARY_BRACKETS_2026: Record<FilingStatus, Bracket[]> = {
  single: [
    { rate: 0.10,  upTo: 11_925 },
    { rate: 0.15,  upTo: 48_475 },
    { rate: 0.25,  upTo: 103_350 },
    { rate: 0.28,  upTo: 197_300 },
    { rate: 0.33,  upTo: 250_525 },
    { rate: 0.35,  upTo: 626_350 },
    { rate: 0.396, upTo: Infinity },
  ],
  married_filing_jointly: [
    { rate: 0.10,  upTo: 23_850 },
    { rate: 0.15,  upTo: 96_950 },
    { rate: 0.25,  upTo: 206_700 },
    { rate: 0.28,  upTo: 394_600 },
    { rate: 0.33,  upTo: 450_000 },
    { rate: 0.35,  upTo: 501_050 },
    { rate: 0.396, upTo: Infinity },
  ],
};

// ── 2026 LTCG / Qualified Dividend Brackets ──────────────────────────────────
// Post-TCJA sunset thresholds (taxable income, not AGI)

const LTCG_BRACKETS_2026: Record<FilingStatus, Bracket[]> = {
  single: [
    { rate: 0.00, upTo: 48_350 },
    { rate: 0.15, upTo: 533_400 },
    { rate: 0.20, upTo: Infinity },
  ],
  married_filing_jointly: [
    { rate: 0.00, upTo: 96_700 },
    { rate: 0.15, upTo: 600_050 },
    { rate: 0.20, upTo: Infinity },
  ],
};

// ── NIIT Thresholds ───────────────────────────────────────────────────────────
const NIIT_RATE = 0.038;
const NIIT_THRESHOLD: Record<FilingStatus, number> = {
  single: 200_000,
  married_filing_jointly: 250_000,
};

// ── Standard Deduction 2026 (post-TCJA sunset) ───────────────────────────────
const STANDARD_DEDUCTION_2026: Record<FilingStatus, number> = {
  single: 8_300,
  married_filing_jointly: 16_600,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Apply progressive brackets to a taxable amount starting at a given base. */
function applyBrackets(
  brackets: Bracket[],
  amount: number,
  base: number = 0
): number {
  if (amount <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const bracket of brackets) {
    const floor = prev;
    const ceiling = bracket.upTo;
    // how much of this bracket is below the base (already taxed by ordinary income)
    const startInBracket = Math.max(base, floor);
    if (startInBracket >= ceiling) {
      prev = ceiling;
      continue;
    }
    const top = Math.min(base + amount, ceiling);
    if (top <= startInBracket) {
      prev = ceiling;
      continue;
    }
    tax += (top - startInBracket) * bracket.rate;
    prev = ceiling;
    if (top < ceiling) break;
  }
  return tax;
}

function getBrackets(
  status: FilingStatus,
  year: number,
  type: "ordinary" | "ltcg"
): Bracket[] {
  // For now, use 2026 tables for all years >= 2026.
  // Add inflation-adjustment logic here in a future iteration.
  if (type === "ordinary") return ORDINARY_BRACKETS_2026[status];
  return LTCG_BRACKETS_2026[status];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Calculator
// ─────────────────────────────────────────────────────────────────────────────

export function calculateFederalTax(input: FederalTaxInput): FederalTaxResult {
  const {
    ordinaryIncome,
    qualifiedDividends,
    longTermGains,
    unrecaptured1250Gain,
    agi,
    filingStatus,
    year,
  } = input;

  const standardDeduction = STANDARD_DEDUCTION_2026[filingStatus];
  const totalGrossIncome =
    ordinaryIncome + qualifiedDividends + longTermGains + unrecaptured1250Gain;

  // ── Step 1: Taxable ordinary income ─────────────────────────────────────
  // Ordinary income is taxed first; LTCG income "stacks on top"
  const taxableOrdinary = Math.max(0, ordinaryIncome - standardDeduction);

  const ordinaryBrackets = getBrackets(filingStatus, year, "ordinary");
  const ordinaryTax = applyBrackets(ordinaryBrackets, taxableOrdinary);

  // ── Step 2: Depreciation recapture (§ 1250) ──────────────────────────────
  // Unrecaptured § 1250 gain is taxed at ordinary income rates but capped at 25%
  // It stacks on top of ordinary income in the bracket calculation
  const recaptureBase = taxableOrdinary;
  const recaptureAmount = unrecaptured1250Gain;
  let depreciationRecaptureTax = 0;

  if (recaptureAmount > 0) {
    const recaptureAtOrdinaryRate = applyBrackets(
      ordinaryBrackets,
      recaptureAmount,
      recaptureBase
    );
    const recaptureAt25PctCap = recaptureAmount * 0.25;
    depreciationRecaptureTax = Math.min(recaptureAtOrdinaryRate, recaptureAt25PctCap);
  }

  // ── Step 3: LTCG / Qualified dividends ──────────────────────────────────
  // These stack on top of ordinary income + recapture for bracket purposes
  const ltcgBase = taxableOrdinary + recaptureAmount;
  const ltcgAmount = qualifiedDividends + longTermGains;

  const ltcgBrackets = getBrackets(filingStatus, year, "ltcg");
  const ltcgTax = applyBrackets(ltcgBrackets, ltcgAmount, ltcgBase);

  // ── Step 4: NIIT (3.8%) ──────────────────────────────────────────────────
  // Applies to the LESSER of net investment income OR (AGI − threshold)
  const netInvestmentIncome = qualifiedDividends + longTermGains + unrecaptured1250Gain;
  const niitThreshold = NIIT_THRESHOLD[filingStatus];
  const niitBase = Math.max(0, Math.min(netInvestmentIncome, agi - niitThreshold));
  const niit = niitBase * NIIT_RATE;

  const totalFederalTax =
    ordinaryTax + depreciationRecaptureTax + ltcgTax + niit;

  const effectiveRate =
    totalGrossIncome > 0 ? totalFederalTax / totalGrossIncome : 0;

  return {
    ordinaryTax,
    ltcgTax,
    niit,
    depreciationRecaptureTax,
    totalFederalTax,
    effectiveRate,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Marginal Rate Helpers (used by simulation to estimate taxes in carry models)
// ─────────────────────────────────────────────────────────────────────────────

export function getMarginalOrdinaryRate(
  taxableIncome: number,
  filingStatus: FilingStatus,
  year: number
): number {
  const brackets = getBrackets(filingStatus, year, "ordinary");
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.upTo) return bracket.rate;
  }
  return brackets[brackets.length - 1].rate;
}

export function getMarginalLtcgRate(
  totalTaxableIncome: number, // ordinary + LTCG stacked
  filingStatus: FilingStatus,
  year: number
): number {
  const brackets = getBrackets(filingStatus, year, "ltcg");
  for (const bracket of brackets) {
    if (totalTaxableIncome <= bracket.upTo) return bracket.rate;
  }
  return brackets[brackets.length - 1].rate;
}
