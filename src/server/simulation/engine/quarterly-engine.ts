// ─────────────────────────────────────────────────────────────────────────────
// Quarterly Simulation Engine
// ─────────────────────────────────────────────────────────────────────────────
//
// Runs a 160-quarter (40-year) forward simulation of a user's complete
// financial picture — tracking capital accumulation across four buckets,
// modeling income, spending, taxes, and detecting the FI date.
// ─────────────────────────────────────────────────────────────────────────────

import type { SimulationInput, SimulationResult, QuarterResult } from "./types";
import { calculateAnnualTax, safeHarborQuarterlyPayment } from "../tax";
import {
  computeAnnualSpending,
  computePermanentAnnualIncome,
  computeRequiredCapital,
} from "./fi-calculator";

const QUARTER_LABELS = ["Q1", "Q2", "Q3", "Q4"] as const;
type QuarterLabel = typeof QUARTER_LABELS[number];

// ── Mortgage helpers ──────────────────────────────────────────────────────────

/** Standard amortizing monthly payment: P × r / (1 − (1+r)^(−n)) */
function monthlyMortgagePayment(balance: number, monthlyRate: number, remainingMonths: number): number {
  if (remainingMonths <= 0 || balance <= 0) return 0;
  if (monthlyRate === 0) return balance / remainingMonths;
  return balance * monthlyRate / (1 - Math.pow(1 + monthlyRate, -remainingMonths));
}

/**
 * Amortize a mortgage balance over 3 months.
 * Returns { quarterlyPayment, newBalance }.
 */
function amortize3Months(
  balance: number,
  annualRate: number,
  remainingMonths: number,
): { quarterlyPayment: number; newBalance: number } {
  if (balance <= 0 || remainingMonths <= 0) return { quarterlyPayment: 0, newBalance: 0 };

  const monthlyRate = annualRate / 12;
  const payment = monthlyMortgagePayment(balance, monthlyRate, remainingMonths);
  let current = balance;

  for (let m = 0; m < 3 && current > 0; m++) {
    const interest = current * monthlyRate;
    const principal = Math.max(0, Math.min(payment - interest, current));
    current -= principal;
  }

  const quarterlyPayment = Math.min(payment * 3, balance);
  return { quarterlyPayment, newBalance: Math.max(0, current) };
}

/** Remaining months on a mortgage at a given quarter offset from start. */
function remainingMortgageMonths(originalRemainingMonths: number, quartersElapsed: number): number {
  return Math.max(0, originalRemainingMonths - quartersElapsed * 3);
}

// ── Weighted blended return ───────────────────────────────────────────────────

function weightedBlendedReturnRate(
  input: SimulationInput,
  currentCapital: number,
): number {
  if (currentCapital <= 0 || input.investmentAccounts.length === 0) {
    return input.profile.assumedReturnRate;
  }
  const totalBalance = input.investmentAccounts.reduce((s, a) => s + a.currentBalance, 0);
  if (totalBalance <= 0) return input.profile.assumedReturnRate;

  return input.investmentAccounts.reduce((sum, a) => {
    const weight = a.currentBalance / totalBalance;
    return sum + weight * a.blendedReturnRate;
  }, 0);
}

// ── Weighted yield rates ──────────────────────────────────────────────────────

interface WeightedYields {
  ordinaryYieldRate: number;
  qualifiedYieldRate: number;
  taxExemptYieldRate: number;
}

function weightedYieldRates(input: SimulationInput): WeightedYields {
  const totalBalance = input.investmentAccounts.reduce((s, a) => s + a.currentBalance, 0);
  if (totalBalance <= 0) {
    return { ordinaryYieldRate: 0, qualifiedYieldRate: 0, taxExemptYieldRate: 0 };
  }
  return input.investmentAccounts.reduce(
    (acc, a) => {
      const w = a.currentBalance / totalBalance;
      return {
        ordinaryYieldRate: acc.ordinaryYieldRate + w * (a.ordinaryYieldRate ?? 0),
        qualifiedYieldRate: acc.qualifiedYieldRate + w * (a.qualifiedYieldRate ?? 0),
        taxExemptYieldRate: acc.taxExemptYieldRate + w * (a.taxExemptYieldRate ?? 0),
      };
    },
    { ordinaryYieldRate: 0, qualifiedYieldRate: 0, taxExemptYieldRate: 0 },
  );
}

// ── Unrealized carry ──────────────────────────────────────────────────────────

/**
 * Sum of expected net carry for tranches not yet realized by (year, quarter).
 * Only tranches whose realization date is AFTER the current quarter are counted.
 */
function computeUnrealizedCarry(
  input: SimulationInput,
  year: number,
  quarter: QuarterLabel,
): number {
  const qIndex = QUARTER_LABELS.indexOf(quarter);
  return input.carry.reduce((sum, c) => {
    const unrealizedFraction = c.realizationSchedule.reduce((f, t) => {
      const isRealized =
        t.year < year ||
        (t.year === year && QUARTER_LABELS.indexOf(t.quarter) <= qIndex);
      return isRealized ? f : f + t.pct;
    }, 0);
    return sum + c.expectedGrossCarry * unrealizedFraction * (1 - c.haircutPct);
  }, 0);
}

// ── Real estate equity ────────────────────────────────────────────────────────

function computeRealEstateEquity(
  input: SimulationInput,
  propertyValues: Map<string, number>,
  mortgageBalances: Map<string, number>,
): number {
  return input.realEstate.reduce((sum, p) => {
    const value = propertyValues.get(p.id) ?? 0;
    if (value <= 0) return sum; // sold
    const discount = 1 - (p.llcValuationDiscountPct ?? 0);
    const ownedValue = value * p.ownershipPct * discount;
    const mortgage = mortgageBalances.get(p.id) ?? 0;
    return sum + Math.max(0, ownedValue - mortgage);
  }, 0);
}

// ── Main engine ───────────────────────────────────────────────────────────────

export function runSimulation(input: SimulationInput): SimulationResult {
  const startYear = input.startYear ?? new Date().getFullYear();
  const currentAge = startYear - input.profile.birthYear;

  // ── Initial state ──

  // Pool all investment account balances
  let investmentCapital = input.investmentAccounts.reduce((s, a) => s + a.currentBalance, 0);

  // Realization capital pool (receives carry/LP proceeds when policy is set)
  let realizationCapital = 0;

  // Blended return rate: computed once from starting allocation
  // Enhancement 2: becomes mutable so we can switch to postFIReturnRate after FI
  let annualBlendedRate = weightedBlendedReturnRate(input, investmentCapital);

  // Pre-compute weighted yield rates (account-level, fixed for simulation)
  const yields = weightedYieldRates(input);

  // Mutable property values and mortgage balances
  const propertyValues = new Map<string, number>(
    input.realEstate.map(p => [p.id, p.currentValue]),
  );
  const mortgageBalances = new Map<string, number>(
    input.realEstate.map(p => [p.id, p.mortgage?.outstandingBalance ?? 0]),
  );

  // Insurance cash values (mutable)
  const insuranceCashValues = new Map<string, number>(
    input.insurance.map(p => [p.id, p.currentCashValue]),
  );

  // ── Tax state ──
  let priorYearTax = 0;
  let priorYearAgi = 0;
  let ytdOrdinaryIncome = 0;
  let ytdLtcgIncome = 0;
  let ytdW2Income = 0; // W-2 wages only — needed for CA SDI and city wage taxes

  // Carry-forward of annual tax snapshot for Q1-Q3 display
  let displayOrdinaryIncome = 0;
  let displayLtcgIncome = 0;
  let displayAnnualTax = 0;
  let displayEffectiveTaxRate = 0;
  let displayFederalOrdinaryTax = 0;
  let displayFederalLtcgTax = 0;
  let displayFederalNiit = 0;
  let displayStateTax = 0;

  // ── Income state (grows each year) ──
  let currentSalary = input.income?.annualSalary ?? 0;
  let currentBonus = input.income?.annualBonus ?? 0;
  const salaryGrowthRate = input.income?.salaryGrowthRate ?? 0;
  const bonusGrowthRate = input.income?.bonusGrowthRate ?? 0;

  // ── Output accumulators ──
  const quarters: QuarterResult[] = [];
  let fiDate: { year: number; quarter: QuarterLabel } | null = null;
  let fiAge: number | null = null;

  // ── Simulation loop ──
  for (let q = 0; q < 160; q++) {
    const year = startYear + Math.floor(q / 4);
    const quarterIndex = q % 4; // 0 = Q1
    const quarterLabel = QUARTER_LABELS[quarterIndex];
    const age = year - input.profile.birthYear;
    const isFirstQuarterOfYear = quarterIndex === 0;

    // Apply annual income growth at start of each new year (after year 0)
    if (isFirstQuarterOfYear && q > 0) {
      currentSalary *= 1 + salaryGrowthRate;
      currentBonus *= 1 + bonusGrowthRate;
    }

    // ── Investment capital: quarterly growth ──
    // Appreciation rate = blended rate minus total yield (yield is distributed separately)
    const totalYieldRate = yields.ordinaryYieldRate + yields.qualifiedYieldRate + yields.taxExemptYieldRate;
    const appreciationRate = Math.max(0, annualBlendedRate - totalYieldRate);
    const quarterlyAppreciationReturn = appreciationRate / 4;
    investmentCapital *= 1 + quarterlyAppreciationReturn;

    // Annual contributions at Q1 (pre-FI only — checked below after FI test)
    if (isFirstQuarterOfYear) {
      const annualContributions = input.investmentAccounts.reduce(
        (s, a) => s + a.annualContribution,
        0,
      );
      investmentCapital += annualContributions;
    }

    // ── Yield income from investmentCapital ──
    const ordinaryYieldIncome = investmentCapital * yields.ordinaryYieldRate / 4;
    const qualifiedYieldIncome = investmentCapital * yields.qualifiedYieldRate / 4;
    const taxExemptYieldIncome = investmentCapital * yields.taxExemptYieldRate / 4;
    const portfolioYieldIncome = ordinaryYieldIncome + qualifiedYieldIncome + taxExemptYieldIncome;

    // ── Realization capital: grow and generate yield ──
    let realizationOrdinaryYield = 0;
    let realizationQualifiedYield = 0;
    let realizationTaxExemptYield = 0;

    if (realizationCapital > 0 && input.realizationPolicy !== null) {
      const policy = input.realizationPolicy;

      // Appreciation component (equity + real estate appreciation only)
      const policyAppreciationRate =
        policy.equityPct * policy.equityAppreciationRate +
        policy.realEstatePct * policy.reAppreciationRate;
      realizationCapital *= 1 + policyAppreciationRate / 4;

      // Yield income from realization capital
      realizationOrdinaryYield = realizationCapital * (
        policy.taxableFixedIncomePct * policy.taxableFixedIncomeRate +
        policy.realEstatePct * (policy.reGrossYieldRate - policy.reCarryingCostRate)
      ) / 4;
      realizationQualifiedYield = realizationCapital * (
        policy.equityPct * policy.equityQualifiedYieldRate
      ) / 4;
      realizationTaxExemptYield = realizationCapital * (
        policy.taxExemptFixedIncomePct * policy.taxExemptFixedIncomeRate
      ) / 4;
    }

    // ── Real estate: quarterly appreciation ──
    for (const prop of input.realEstate) {
      const currentValue = propertyValues.get(prop.id) ?? 0;
      if (currentValue <= 0) continue; // already sold
      propertyValues.set(prop.id, currentValue * (1 + prop.appreciationRate / 4));
    }

    // ── Insurance: grow cash values ──
    for (const policy of input.insurance) {
      if (policy.policyType === "term") continue;
      const cv = insuranceCashValues.get(policy.id) ?? 0;
      insuranceCashValues.set(policy.id, cv * (1 + policy.assumedReturnRate / 4));
    }

    // ── Income events this quarter ──

    // W-2 income: stops when FI is achieved — user may discontinue full-time employment
    if (fiDate !== null) {
      currentSalary = 0;
      currentBonus = 0;
    }

    // W-2: salary distributed evenly; bonus paid in Q1
    const salaryIncome = currentSalary / 4;
    const bonusIncome = isFirstQuarterOfYear ? currentBonus : 0;
    const w2Income = salaryIncome + bonusIncome;

    // Carry realizations (LTCG) — match each tranche individually
    let carryIncome = 0;
    for (const carry of input.carry) {
      for (const tranche of carry.realizationSchedule) {
        if (tranche.year === year && tranche.quarter === quarterLabel) {
          carryIncome += carry.expectedGrossCarry * tranche.pct * (1 - carry.haircutPct);
        }
      }
    }

    // LP distributions
    let lpIncome = 0;
    let lpOrdinary = 0;
    let lpLtcg = 0;
    for (const dist of input.lpDistributions) {
      if (dist.year === year && dist.quarter === quarterLabel) {
        lpIncome += dist.amount;
        if (dist.taxCharacter === "ordinary") lpOrdinary += dist.amount;
        else if (dist.taxCharacter === "ltcg") lpLtcg += dist.amount;
        // return_of_capital: non-taxable, included in lpIncome for cash flow but not tax
      }
    }

    // Rental net income (rental + commercial only)
    let rentalNetIncome = 0;
    for (const prop of input.realEstate) {
      if (prop.propertyType !== "rental" && prop.propertyType !== "commercial") continue;
      const netAnnual = (prop.annualRentalIncome - prop.annualOperatingExpenses) * prop.ownershipPct;
      rentalNetIncome += Math.max(0, netAnnual) / 4;
    }

    // ── Real estate sales this quarter ──
    let realEstateSaleProceeds = 0;
    let realEstateLtcgThisQuarter = 0;
    for (const prop of input.realEstate) {
      if (prop.projectedSaleYear !== year || prop.projectedSaleQuarter !== quarterLabel) continue;
      const value = propertyValues.get(prop.id) ?? 0;
      if (value <= 0) continue;

      const discount = 1 - (prop.llcValuationDiscountPct ?? 0);
      const saleValue = value * prop.ownershipPct * discount;
      const mortgageBalance = mortgageBalances.get(prop.id) ?? 0;
      const netProceeds = saleValue - mortgageBalance;

      realEstateSaleProceeds += netProceeds;

      // Capital gain = net proceeds − adjusted basis (purchase price × ownershipPct)
      if (!prop.is1031Exchange) {
        const basis = prop.purchasePrice * prop.ownershipPct;
        const gain = Math.max(0, netProceeds - basis);
        realEstateLtcgThisQuarter += gain;
      }

      // Remove from simulation
      propertyValues.set(prop.id, 0);
      mortgageBalances.set(prop.id, 0);
    }

    // Add sale proceeds to investment capital
    investmentCapital += realEstateSaleProceeds;

    // ── Spending ──

    // Recurring expenditures (inflation-adjusted)
    const yearsElapsed = year - startYear;
    let recurringSpending = 0;
    for (const exp of input.recurringExpenditures) {
      const annualAmt = exp.annualAmount * Math.pow(1 + exp.growthRate, yearsElapsed);
      recurringSpending += annualAmt / 4;
    }

    // One-time expenditures
    let oneTimeSpending = 0;
    for (const exp of input.oneTimeExpenditures) {
      if (exp.projectedYear === year && exp.projectedQuarter === quarterLabel) {
        oneTimeSpending += exp.amount;
      }
    }

    // ── Children education costs ──
    // College (undergraduate): 4 years while child is age 18–21.
    // Grad school: graduateSchoolYears years while child is age 22–(22+n-1).
    // These are temporary costs and do NOT feed into the FI required-capital
    // perpetuity — they reduce investmentCapital during the relevant years only.
    for (const child of input.children) {
      const childAge = year - child.birthYear;

      // K-12 private tuition: ages 5–17 (kindergarten through senior year)
      if (child.annualK12Cost > 0 && childAge >= 5 && childAge <= 17) {
        recurringSpending += child.annualK12Cost / 4;
      }

      if (child.hasCollege && childAge >= 18 && childAge <= 21) {
        recurringSpending += child.annualCollegeCost / 4;
      }

      if (child.hasGradSchool && child.gradSchoolYears > 0 &&
          childAge >= 22 && childAge < 22 + child.gradSchoolYears) {
        recurringSpending += child.annualGradSchoolCost / 4;
      }
    }

    // ── Mortgage payments ──
    let mortgagePayments = 0;
    for (const prop of input.realEstate) {
      if (!prop.mortgage) continue;
      const balance = mortgageBalances.get(prop.id) ?? 0;
      if (balance <= 0) continue;

      const origRemaining = prop.mortgage.remainingTermMonths;
      const remMonths = remainingMortgageMonths(origRemaining, q);
      if (remMonths <= 0) continue;

      const { quarterlyPayment, newBalance } = amortize3Months(
        balance,
        prop.mortgage.interestRate,
        remMonths,
      );
      mortgagePayments += quarterlyPayment;
      mortgageBalances.set(prop.id, newBalance);
    }

    // ── Insurance premiums ──
    let insurancePremiums = 0;
    for (const policy of input.insurance) {
      if (yearsElapsed < policy.premiumYearsRemaining) {
        insurancePremiums += policy.annualPremium / 4;
      }
    }

    // ── Tax accounting ──
    // Accumulate year-to-date taxable income
    // Yield income: ordinary yield → ordinary income; qualified yield → LTCG
    ytdW2Income += w2Income;
    ytdOrdinaryIncome +=
      w2Income +
      rentalNetIncome +
      lpOrdinary +
      ordinaryYieldIncome +
      realizationOrdinaryYield;
    ytdLtcgIncome +=
      carryIncome +
      lpLtcg +
      realEstateLtcgThisQuarter +
      qualifiedYieldIncome +
      realizationQualifiedYield;
    // taxExemptYield is excluded from both (cash flow only)

    let taxPayment: number;

    if (quarterIndex < 3) {
      // Q1–Q3: safe harbor installment
      if (input.profile.safeHarborElection) {
        taxPayment = safeHarborQuarterlyPayment(priorYearTax, priorYearAgi);
      } else {
        // Pay 1/4 of estimated current-year liability (approximated as prior-year)
        taxPayment = priorYearTax / 4;
      }
    } else {
      // Q4: compute actual annual tax; true-up vs already paid
      const agi = ytdOrdinaryIncome + ytdLtcgIncome;
      const taxResult = calculateAnnualTax({
        ordinaryIncome: ytdOrdinaryIncome,
        qualifiedDividends: 0,
        longTermGains: ytdLtcgIncome,
        unrecaptured1250Gain: 0,
        agi,
        filingStatus: input.profile.filingStatus,
        stateCode: input.profile.stateOfResidence,
        year,
        w2Wages: ytdW2Income,
        cityCode: input.profile.cityOfResidence ?? undefined,
      });

      const annualTax = taxResult.totalTax;
      const alreadyPaid = input.profile.safeHarborElection
        ? safeHarborQuarterlyPayment(priorYearTax, priorYearAgi) * 3
        : (priorYearTax / 4) * 3;

      taxPayment = Math.max(0, annualTax - alreadyPaid);

      // Update display snapshot for Q4 and carry-forward
      displayOrdinaryIncome = ytdOrdinaryIncome;
      displayLtcgIncome = ytdLtcgIncome;
      displayAnnualTax = annualTax;
      displayEffectiveTaxRate = taxResult.effectiveTotalRate;
      displayFederalOrdinaryTax = taxResult.federalOrdinaryTax;
      displayFederalLtcgTax = taxResult.federalLtcgTax;
      displayFederalNiit = taxResult.federalNiit;
      displayStateTax = taxResult.stateIncomeTax;

      // Advance tax state for next year
      priorYearTax = annualTax;
      priorYearAgi = agi;
      ytdOrdinaryIncome = 0;
      ytdLtcgIncome = 0;
      ytdW2Income = 0;
    }

    // ── Net cash flow → investment capital (or realization capital pool) ──
    // Tax payments come from investmentCapital regardless of policy.
    // Carry/LP proceeds route to realizationCapital if policy is set.

    let generalIncome = w2Income + rentalNetIncome + portfolioYieldIncome +
      realizationOrdinaryYield + realizationQualifiedYield + realizationTaxExemptYield;

    if (input.realizationPolicy !== null) {
      // Carry and LP go to the realization pool; do NOT add to general cash flow
      realizationCapital += carryIncome + lpIncome;
    } else {
      // No policy — carry/LP flow into investmentCapital as before
      generalIncome += carryIncome + lpIncome;
    }

    const generalOutflow = recurringSpending + oneTimeSpending + mortgagePayments + insurancePremiums + taxPayment;
    const netCashFlow =
      (w2Income + carryIncome + lpIncome + rentalNetIncome + portfolioYieldIncome +
       realizationOrdinaryYield + realizationQualifiedYield + realizationTaxExemptYield) -
      generalOutflow;

    investmentCapital += generalIncome - generalOutflow;

    // If investmentCapital goes negative after expenses, draw from realizationCapital
    if (investmentCapital < 0 && realizationCapital > 0) {
      const draw = Math.min(-investmentCapital, realizationCapital);
      realizationCapital -= draw;
      investmentCapital += draw;
    }

    investmentCapital = Math.max(0, investmentCapital);

    // ── Capital totals ──
    const realEstateEquity = computeRealEstateEquity(input, propertyValues, mortgageBalances);
    const insuranceCashValueTotal = Array.from(insuranceCashValues.values()).reduce(
      (s, v) => s + v,
      0,
    );
    const unrealizedCarry = computeUnrealizedCarry(input, year, quarterLabel);
    const totalCapital =
      investmentCapital +
      realizationCapital +
      realEstateEquity +
      insuranceCashValueTotal +
      unrealizedCarry;

    // ── FI test ──
    const annualSpending = computeAnnualSpending(input.recurringExpenditures, year, startYear);
    const permanentIncome = computePermanentAnnualIncome(input.realEstate);
    const requiredCapital = computeRequiredCapital(
      annualSpending,
      permanentIncome,
      input.profile.assumedReturnRate,
    );

    const isFI = totalCapital >= requiredCapital;
    // Only mark FI when spending > 0: a defined spending need is required for
    // FI to be meaningful; this also prevents degenerate detection when no
    // expenses have been entered.
    if (isFI && fiDate === null && annualSpending > 0) {
      fiDate = { year, quarter: quarterLabel };
      fiAge = age;

      // Enhancement 2: switch to post-FI return rate after FI is detected
      annualBlendedRate = input.profile.postFIReturnRate;
    }

    quarters.push({
      q,
      year,
      quarterLabel,
      age,
      investmentCapital,
      realizationCapital,
      realEstateEquity,
      insuranceCashValue: insuranceCashValueTotal,
      unrealizedCarry,
      totalCapital,
      requiredCapital,
      isFI,
      w2Income,
      carryIncome,
      lpIncome,
      rentalNetIncome,
      portfolioYieldIncome,
      recurringSpending,
      oneTimeSpending,
      mortgagePayments,
      insurancePremiums,
      taxPayment,
      netCashFlow,
      annualOrdinaryIncome: displayOrdinaryIncome,
      annualLtcgIncome: displayLtcgIncome,
      annualTotalTax: displayAnnualTax,
      annualEffectiveTaxRate: displayEffectiveTaxRate,
      annualFederalOrdinaryTax: displayFederalOrdinaryTax,
      annualFederalLtcgTax: displayFederalLtcgTax,
      annualFederalNiit: displayFederalNiit,
      annualStateTax: displayStateTax,
    });
  }

  // ── Summary (as of Q1 of startYear — current state) ──
  const q0 = quarters[0];
  const annualSpendingToday = computeAnnualSpending(input.recurringExpenditures, startYear, startYear);
  const permanentIncomeToday = computePermanentAnnualIncome(input.realEstate);

  return {
    quarters,
    fiDate,
    fiAge,
    startYear,
    currentAge,
    summary: {
      totalCapitalToday: q0.totalCapital,
      requiredCapitalToday: q0.requiredCapital,
      gapToFI: q0.requiredCapital - q0.totalCapital,
      projectedAnnualSpending: annualSpendingToday,
      permanentAnnualIncome: permanentIncomeToday,
    },
  };
}
