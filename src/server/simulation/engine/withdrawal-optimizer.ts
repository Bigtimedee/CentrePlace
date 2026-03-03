// ─────────────────────────────────────────────────────────────────────────────
// Withdrawal Optimizer
// ─────────────────────────────────────────────────────────────────────────────
//
// Given a set of investment accounts, insurance policies, and a net annual
// spending need, produces a tax-minimizing withdrawal plan by sequencing
// draws across account types in the following waterfall:
//
//   1. RMDs                (mandatory; adds to ordinary income)
//   2. PPLI loans          (tax-free; borrow against PPLI cash value)
//   3. Whole life loans    (tax-free; borrow against WL cash value)
//   4. Taxable accounts    (gains at 0% LTCG while room remains in 0% bracket)
//   5. Roth IRA / 401k     (tax-free qualified distributions)
//   6. Taxable accounts    (gains at 15%/20% LTCG — remaining balance)
//   7. Traditional IRA / 401k / SEP-IRA / Solo 401k  (ordinary income)
//
// The planner fills each tier until the spending need is met, then stops.
// All amounts are annual.
// ─────────────────────────────────────────────────────────────────────────────

import type { FilingStatus } from "../tax/types";
import { calculateStateTax } from "../tax/state-income";

// ── IRS Uniform Lifetime Table (Pub. 590-B Table III) ─────────────────────────
// Used to compute Required Minimum Distributions for traditional accounts.
// RMDs are required starting the year a participant turns 73 (SECURE 2.0).

const UNIFORM_LIFETIME: Record<number, number> = {
  73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
  78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5,
  83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
  88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8,
  93: 10.1, 94: 9.5,  95: 8.9,  96: 8.4,  97: 7.8,
  98: 7.3,  99: 6.8,  100: 6.4,
};

function rmdFactor(age: number): number {
  if (age < 73) return 0;
  return UNIFORM_LIFETIME[Math.min(age, 100)] ?? 6.4;
}

// ── 2026 Federal Bracket Constants (post-TCJA sunset) ────────────────────────

const STANDARD_DEDUCTION_2026: Record<FilingStatus, number> = {
  single: 8_300,
  married_filing_jointly: 16_600,
};

const LTCG_ZERO_THRESHOLD_2026: Record<FilingStatus, number> = {
  single: 48_350,
  married_filing_jointly: 96_700,
};

const ORDINARY_BRACKETS_2026: Record<FilingStatus, Array<{ rate: number; upTo: number }>> = {
  single: [
    { rate: 0.10, upTo: 11_925 },
    { rate: 0.15, upTo: 48_475 },
    { rate: 0.25, upTo: 103_350 },
    { rate: 0.28, upTo: 197_300 },
    { rate: 0.33, upTo: 250_525 },
    { rate: 0.35, upTo: 626_350 },
    { rate: 0.396, upTo: Infinity },
  ],
  married_filing_jointly: [
    { rate: 0.10, upTo: 23_850 },
    { rate: 0.15, upTo: 96_950 },
    { rate: 0.25, upTo: 206_700 },
    { rate: 0.28, upTo: 394_600 },
    { rate: 0.33, upTo: 450_000 },
    { rate: 0.35, upTo: 501_050 },
    { rate: 0.396, upTo: Infinity },
  ],
};

/** Marginal federal ordinary rate at a given taxable income level. */
function marginalOrdinaryRate(taxableIncome: number, filing: FilingStatus): number {
  const brackets = ORDINARY_BRACKETS_2026[filing];
  for (const b of brackets) {
    if (taxableIncome <= b.upTo) return b.rate;
  }
  return 0.396;
}

/** Marginal federal LTCG rate given (ordinary taxable income, LTCG amount). */
function marginalLtcgRate(ordinaryTaxableIncome: number, ltcgAmount: number, filing: FilingStatus): number {
  const zeroTop = LTCG_ZERO_THRESHOLD_2026[filing];
  const fifteenTop = filing === "single" ? 533_400 : 600_050;
  const ltcgBase = ordinaryTaxableIncome + ltcgAmount / 2; // midpoint for marginal estimate
  if (ltcgBase <= zeroTop) return 0;
  if (ltcgBase <= fifteenTop) return 0.15;
  return 0.20;
}

/** Marginal state tax rate on ordinary income — computed via $1k delta on the state engine. */
function stateOrdinaryMarginalRate(
  baseOrdinaryIncome: number,
  filing: FilingStatus,
  stateCode: string,
  year: number,
): number {
  const delta = 1_000;
  const base = calculateStateTax({ stateCode, ordinaryIncome: baseOrdinaryIncome, longTermGains: 0, shortTermGains: 0, filingStatus: filing, year });
  const bump = calculateStateTax({ stateCode, ordinaryIncome: baseOrdinaryIncome + delta, longTermGains: 0, shortTermGains: 0, filingStatus: filing, year });
  return Math.max(0, (bump.stateIncomeTax - base.stateIncomeTax) / delta);
}

/** Marginal state LTCG rate — computed via $1k delta on the state engine. */
function stateLtcgMarginalRate(
  baseOrdinaryIncome: number,
  baseLtcg: number,
  filing: FilingStatus,
  stateCode: string,
  year: number,
): number {
  const delta = 1_000;
  const base = calculateStateTax({ stateCode, ordinaryIncome: baseOrdinaryIncome, longTermGains: baseLtcg, shortTermGains: 0, filingStatus: filing, year });
  const bump = calculateStateTax({ stateCode, ordinaryIncome: baseOrdinaryIncome, longTermGains: baseLtcg + delta, shortTermGains: 0, filingStatus: filing, year });
  return Math.max(0, (bump.stateIncomeTax - base.stateIncomeTax) / delta);
}

// ── Public Types ──────────────────────────────────────────────────────────────

const TRADITIONAL_TYPES = new Set([
  "traditional_ira", "traditional_401k", "sep_ira", "solo_401k",
]);
const ROTH_TYPES = new Set(["roth_ira", "roth_401k"]);

export interface WithdrawalAccount {
  id: string;
  accountName: string;
  accountType: string;
  currentBalance: number;
  /**
   * Fraction of balance that is cost basis (tax-free on withdrawal from taxable accounts).
   * Defaults to 0.50 (conservative assumption) when not tracked.
   */
  costBasisPct: number;
}

export interface WithdrawalInsurance {
  id: string;
  policyName: string;
  policyType: "whole_life" | "ppli";
  cashValue: number;
  outstandingLoan: number;
  maxLoanPct: number;
}

export interface WithdrawalOptimizerInput {
  /** Annual net spending need (total spending minus permanent income already received). */
  annualSpendingNeed: number;
  /** Non-withdrawal ordinary income this year: W-2, rental income, etc. */
  existingOrdinaryIncome: number;
  accounts: WithdrawalAccount[];
  insurance: WithdrawalInsurance[];
  filingStatus: FilingStatus;
  stateCode: string;
  age: number;
  year: number;
}

export type WithdrawalSourceType =
  | "rmd"
  | "ppli_loan"
  | "wl_loan"
  | "taxable_0pct"
  | "roth"
  | "taxable_15pct"
  | "traditional";

export interface WithdrawalStep {
  rank: number;
  sourceType: WithdrawalSourceType;
  accountId: string;
  label: string;          // human-readable e.g. "Roth IRA — Fidelity"
  grossAmount: number;
  gainsTaxed: number;     // portion of grossAmount that is taxable (gains only for taxable accts)
  federalTaxRate: number;
  stateTaxRate: number;
  taxCost: number;
  netAmount: number;
  notes: string;
}

export interface WithdrawalPlan {
  steps: WithdrawalStep[];
  totalGross: number;
  totalTax: number;
  totalNet: number;
  effectiveTaxRate: number;
  rmdAmount: number;
  metNeed: number;
  unmetNeed: number;
  /** Hypothetical tax if all funds came from a traditional account at the marginal rate. */
  naiveAllTradTax: number;
  taxSavings: number;
}

// ── Main optimizer ────────────────────────────────────────────────────────────

export function optimizeWithdrawals(input: WithdrawalOptimizerInput): WithdrawalPlan {
  const { annualSpendingNeed, existingOrdinaryIncome, filingStatus, stateCode, age, year } = input;

  const stdDed = STANDARD_DEDUCTION_2026[filingStatus];
  const steps: WithdrawalStep[] = [];
  let remaining = annualSpendingNeed;
  let rank = 0;

  // Running income state (cumulative, for marginal rate calculations)
  let cumOrdinary = existingOrdinaryIncome;
  let cumLtcg = 0;

  // ── Tier 1: RMDs ──────────────────────────────────────────────────────────
  let rmdAmount = 0;
  if (age >= 73) {
    const tradAccounts = input.accounts.filter(a => TRADITIONAL_TYPES.has(a.accountType));
    for (const acct of tradAccounts) {
      const factor = rmdFactor(age);
      if (factor <= 0) continue;
      const rmd = acct.currentBalance / factor;
      if (rmd <= 0) continue;

      const ordinaryTaxable = Math.max(0, cumOrdinary + rmd - stdDed);
      const fedRate = marginalOrdinaryRate(ordinaryTaxable, filingStatus);
      const stateRate = stateOrdinaryMarginalRate(cumOrdinary, filingStatus, stateCode, year);
      const taxCost = rmd * (fedRate + stateRate);

      rmdAmount += rmd;
      remaining -= rmd; // RMDs offset spending need dollar-for-dollar (before tax)

      steps.push({
        rank: ++rank,
        sourceType: "rmd",
        accountId: acct.id,
        label: `RMD — ${acct.accountName}`,
        grossAmount: rmd,
        gainsTaxed: rmd,
        federalTaxRate: fedRate,
        stateTaxRate: stateRate,
        taxCost,
        netAmount: rmd - taxCost,
        notes: `Required minimum distribution (age ${age}, IRS factor ${factor})`,
      });

      cumOrdinary += rmd;
    }
  }

  // ── Tier 2: PPLI loans ────────────────────────────────────────────────────
  for (const policy of input.insurance.filter(p => p.policyType === "ppli")) {
    if (remaining <= 0) break;
    const available = Math.max(0, policy.cashValue * policy.maxLoanPct - policy.outstandingLoan);
    if (available <= 0) continue;

    const amount = Math.min(available, remaining);
    steps.push({
      rank: ++rank,
      sourceType: "ppli_loan",
      accountId: policy.id,
      label: `PPLI Loan — ${policy.policyName}`,
      grossAmount: amount,
      gainsTaxed: 0,
      federalTaxRate: 0,
      stateTaxRate: 0,
      taxCost: 0,
      netAmount: amount,
      notes: "Policy loan — tax-free (not a taxable event); repaid via death benefit",
    });
    remaining -= amount;
  }

  // ── Tier 3: Whole life loans ──────────────────────────────────────────────
  for (const policy of input.insurance.filter(p => p.policyType === "whole_life")) {
    if (remaining <= 0) break;
    const available = Math.max(0, policy.cashValue * policy.maxLoanPct - policy.outstandingLoan);
    if (available <= 0) continue;

    const amount = Math.min(available, remaining);
    steps.push({
      rank: ++rank,
      sourceType: "wl_loan",
      accountId: policy.id,
      label: `Whole Life Loan — ${policy.policyName}`,
      grossAmount: amount,
      gainsTaxed: 0,
      federalTaxRate: 0,
      stateTaxRate: 0,
      taxCost: 0,
      netAmount: amount,
      notes: "Policy loan — tax-free; accrues loan interest against cash value",
    });
    remaining -= amount;
  }

  // ── Tier 4: Taxable accounts — 0% LTCG zone ──────────────────────────────
  const zeroTop = LTCG_ZERO_THRESHOLD_2026[filingStatus];
  const ordinaryTaxableNow = Math.max(0, cumOrdinary - stdDed);
  const ltcgZeroRoom = Math.max(0, zeroTop - ordinaryTaxableNow - cumLtcg);
  let ltcgZeroRemaining = ltcgZeroRoom;

  if (ltcgZeroRemaining > 0) {
    for (const acct of input.accounts.filter(a => a.accountType === "taxable")) {
      if (remaining <= 0 || ltcgZeroRemaining <= 0) break;
      if (acct.currentBalance <= 0) continue;

      const gainsFraction = 1 - acct.costBasisPct;
      if (gainsFraction <= 0) continue;

      // Maximum withdrawal such that gains stay within 0% zone
      // gains = withdrawal * gainsFraction ≤ ltcgZeroRemaining
      const maxForZero = ltcgZeroRemaining / gainsFraction;
      const amount = Math.min(acct.currentBalance, remaining, maxForZero);
      if (amount <= 0) continue;

      const gainsAmount = amount * gainsFraction;
      const stateRate = stateLtcgMarginalRate(cumOrdinary, cumLtcg, filingStatus, stateCode, year);
      const taxCost = gainsAmount * stateRate; // federal rate is 0% here

      steps.push({
        rank: ++rank,
        sourceType: "taxable_0pct",
        accountId: acct.id,
        label: `Taxable — ${acct.accountName}`,
        grossAmount: amount,
        gainsTaxed: gainsAmount,
        federalTaxRate: 0,
        stateTaxRate: stateRate,
        taxCost,
        netAmount: amount - taxCost,
        notes: `0% federal LTCG zone; gains: ${Math.round(gainsFraction * 100)}% of withdrawal`,
      });

      remaining -= amount;
      ltcgZeroRemaining -= gainsAmount;
      cumLtcg += gainsAmount;
    }
  }

  // ── Tier 5: Roth accounts ─────────────────────────────────────────────────
  for (const acct of input.accounts.filter(a => ROTH_TYPES.has(a.accountType))) {
    if (remaining <= 0) break;
    if (acct.currentBalance <= 0) continue;

    const amount = Math.min(acct.currentBalance, remaining);
    steps.push({
      rank: ++rank,
      sourceType: "roth",
      accountId: acct.id,
      label: `Roth — ${acct.accountName}`,
      grossAmount: amount,
      gainsTaxed: 0,
      federalTaxRate: 0,
      stateTaxRate: 0,
      taxCost: 0,
      netAmount: amount,
      notes: "Qualified Roth distribution — entirely tax-free",
    });
    remaining -= amount;
  }

  // ── Tier 6: Taxable accounts — 15%/20% LTCG ──────────────────────────────
  for (const acct of input.accounts.filter(a => a.accountType === "taxable")) {
    if (remaining <= 0) break;
    if (acct.currentBalance <= 0) continue;

    // How much is already drawn from this account in tier 4?
    const alreadyUsed = steps
      .filter(s => s.accountId === acct.id && s.sourceType === "taxable_0pct")
      .reduce((sum, s) => sum + s.grossAmount, 0);
    const availableBalance = acct.currentBalance - alreadyUsed;
    if (availableBalance <= 0) continue;

    const gainsFraction = 1 - acct.costBasisPct;
    const amount = Math.min(availableBalance, remaining);
    const gainsAmount = amount * gainsFraction;

    const fedRate = marginalLtcgRate(ordinaryTaxableNow, cumLtcg + gainsAmount / 2, filingStatus);
    const stateRate = stateLtcgMarginalRate(cumOrdinary, cumLtcg, filingStatus, stateCode, year);
    const taxCost = gainsAmount * (fedRate + stateRate);

    steps.push({
      rank: ++rank,
      sourceType: "taxable_15pct",
      accountId: acct.id,
      label: `Taxable — ${acct.accountName}`,
      grossAmount: amount,
      gainsTaxed: gainsAmount,
      federalTaxRate: fedRate,
      stateTaxRate: stateRate,
      taxCost,
      netAmount: amount - taxCost,
      notes: `LTCG at ${Math.round(fedRate * 100)}% federal; gains: ${Math.round(gainsFraction * 100)}% of withdrawal`,
    });

    remaining -= amount;
    cumLtcg += gainsAmount;
  }

  // ── Tier 7: Traditional accounts ─────────────────────────────────────────
  for (const acct of input.accounts.filter(a => TRADITIONAL_TYPES.has(a.accountType))) {
    if (remaining <= 0) break;

    // Remaining balance after any RMD already drawn in tier 1
    const rmdDrawn = steps
      .filter(s => s.accountId === acct.id && s.sourceType === "rmd")
      .reduce((sum, s) => sum + s.grossAmount, 0);
    const availableBalance = acct.currentBalance - rmdDrawn;
    if (availableBalance <= 0) continue;

    const amount = Math.min(availableBalance, remaining);
    const taxableIncome = Math.max(0, cumOrdinary + amount - stdDed);
    const fedRate = marginalOrdinaryRate(taxableIncome, filingStatus);
    const stateRate = stateOrdinaryMarginalRate(cumOrdinary, filingStatus, stateCode, year);
    const taxCost = amount * (fedRate + stateRate);

    steps.push({
      rank: ++rank,
      sourceType: "traditional",
      accountId: acct.id,
      label: `Traditional — ${acct.accountName}`,
      grossAmount: amount,
      gainsTaxed: amount,
      federalTaxRate: fedRate,
      stateTaxRate: stateRate,
      taxCost,
      netAmount: amount - taxCost,
      notes: `Taxed as ordinary income at ${Math.round(fedRate * 100)}% federal marginal rate`,
    });

    remaining -= amount;
    cumOrdinary += amount;
  }

  // ── Summarize ─────────────────────────────────────────────────────────────
  const totalGross = steps.reduce((s, step) => s + step.grossAmount, 0);
  const totalTax = steps.reduce((s, step) => s + step.taxCost, 0);
  const totalNet = steps.reduce((s, step) => s + step.netAmount, 0);
  const metNeed = Math.min(totalNet, annualSpendingNeed);
  const unmetNeed = Math.max(0, annualSpendingNeed - totalNet);

  // Naive comparison: what if all from traditional at top marginal rate?
  const topFedRate = marginalOrdinaryRate(
    Math.max(0, existingOrdinaryIncome + annualSpendingNeed - stdDed),
    filingStatus,
  );
  const topStateRate = stateOrdinaryMarginalRate(
    existingOrdinaryIncome + annualSpendingNeed,
    filingStatus,
    stateCode,
    year,
  );
  const naiveAllTradTax = annualSpendingNeed * (topFedRate + topStateRate);
  const taxSavings = Math.max(0, naiveAllTradTax - totalTax);

  return {
    steps,
    totalGross,
    totalTax,
    totalNet,
    effectiveTaxRate: totalGross > 0 ? totalTax / totalGross : 0,
    rmdAmount,
    metNeed,
    unmetNeed,
    naiveAllTradTax,
    taxSavings,
  };
}
