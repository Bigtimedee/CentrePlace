// ─────────────────────────────────────────────────────────────────────────────
// Quarterly Simulation Engine — Input / Output Types
// ─────────────────────────────────────────────────────────────────────────────

import type { FilingStatus } from "../tax/types";

// ── Simulation Inputs ─────────────────────────────────────────────────────────

export interface SimProfile {
  filingStatus: FilingStatus;
  stateOfResidence: string;
  birthYear: number;
  targetAge: number;
  /** Annual blended portfolio return rate (e.g. 0.07 for 7%) */
  assumedReturnRate: number;
  safeHarborElection: boolean;
  /** Conservative return rate applied after FI is achieved (e.g. 0.05 for 5%) */
  postFIReturnRate: number;
  /** City/local tax jurisdiction code (e.g. "NYC", "PHL"). Null = no city tax. */
  cityOfResidence?: string | null;
}

export interface SimIncome {
  annualSalary: number;
  annualBonus: number;
  salaryGrowthRate: number;
  bonusGrowthRate: number;
}

export interface CarryRealizationTranche {
  year: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  pct: number; // fraction of expectedGrossCarry (0–1)
}

export interface SimCarryPosition {
  id: string;
  fundName: string;
  expectedGrossCarry: number;
  haircutPct: number;
  realizationSchedule: CarryRealizationTranche[];
}

export interface SimLPDistribution {
  fundName: string;
  year: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  amount: number;
  taxCharacter: "ltcg" | "ordinary" | "return_of_capital";
}

export interface SimInvestmentAccount {
  id: string;
  accountName: string;
  /** Determines tax treatment on withdrawal */
  accountType:
    | "taxable"
    | "traditional_ira"
    | "roth_ira"
    | "traditional_401k"
    | "roth_401k"
    | "sep_ira"
    | "solo_401k";
  currentBalance: number;
  blendedReturnRate: number; // pre-computed: equity*eRate + bond*bRate + alt*aRate
  annualContribution: number;
  /** Annual ordinary income yield as % of balance (e.g. bond interest, non-qualified dividends). Default 0. */
  ordinaryYieldRate?: number;
  /** Annual qualified dividend yield as % of balance (taxed at LTCG rates). Default 0. */
  qualifiedYieldRate?: number;
  /** Annual tax-exempt yield as % of balance (e.g. muni bonds — cash flow only, not taxed). Default 0. */
  taxExemptYieldRate?: number;
}

export interface SimRealEstateProperty {
  id: string;
  propertyName: string;
  propertyType: "primary_residence" | "rental" | "vacation" | "commercial" | "llc_held";
  currentValue: number;
  purchasePrice: number;
  purchaseYear: number;
  appreciationRate: number;
  ownershipPct: number;
  llcValuationDiscountPct: number;
  annualRentalIncome: number;
  annualOperatingExpenses: number;
  projectedSaleYear: number | null;
  projectedSaleQuarter: "Q1" | "Q2" | "Q3" | "Q4" | null;
  is1031Exchange: boolean;
  mortgage: SimMortgage | null;
}

export interface SimMortgage {
  outstandingBalance: number;
  interestRate: number;
  remainingTermMonths: number;
}

export interface SimInsurancePolicy {
  id: string;
  policyType: "term" | "whole_life" | "ppli";
  ownershipStructure: "personal" | "ilit";
  deathBenefit: number;
  annualPremium: number;
  premiumYearsRemaining: number;
  currentCashValue: number;
  assumedReturnRate: number;
  outstandingLoanBalance: number;
  maxLoanPct: number;
  isEstateTaxFunding: boolean;
}

export interface SimChildEducation {
  name: string;
  birthYear: number;
  /** Annual private K-12 tuition — applies while child is age 5–17. 0 = not modeling. */
  annualK12Cost: number;
  /** Whether college costs are modeled (false = no tuition projected) */
  hasCollege: boolean;
  /** Annual undergraduate tuition — applies for 4 years starting at age 18 */
  annualCollegeCost: number;
  /** Whether graduate school costs are modeled */
  hasGradSchool: boolean;
  /** Annual grad school cost */
  annualGradSchoolCost: number;
  /** Number of years of grad school (starting at age 22) */
  gradSchoolYears: number;
}

export interface SimRecurringExpenditure {
  description: string;
  annualAmount: number;
  growthRate: number;
}

export interface SimOneTimeExpenditure {
  description: string;
  amount: number;
  projectedYear: number;
  projectedQuarter: "Q1" | "Q2" | "Q3" | "Q4";
}

export interface SimRealizationPolicy {
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
}

/** All inputs to the quarterly simulation engine */
export interface SimulationInput {
  profile: SimProfile;
  income: SimIncome | null;
  carry: SimCarryPosition[];
  lpDistributions: SimLPDistribution[];
  investmentAccounts: SimInvestmentAccount[];
  realEstate: SimRealEstateProperty[];
  insurance: SimInsurancePolicy[];
  recurringExpenditures: SimRecurringExpenditure[];
  oneTimeExpenditures: SimOneTimeExpenditure[];
  children: SimChildEducation[];
  /** Realization reinvestment policy — null means carry/LP flow into investmentCapital as before */
  realizationPolicy: SimRealizationPolicy | null;
  /** Override the simulation start year (defaults to current year) */
  startYear?: number;
}

// ── Simulation Outputs ────────────────────────────────────────────────────────

export interface QuarterResult {
  /** 0-indexed quarter number (0 = Q1 of startYear) */
  q: number;
  year: number;
  quarterLabel: "Q1" | "Q2" | "Q3" | "Q4";
  age: number;

  // Capital balances (end of quarter)
  investmentCapital: number;
  realizationCapital: number;
  realEstateEquity: number;
  insuranceCashValue: number;
  unrealizedCarry: number;
  totalCapital: number;
  requiredCapital: number;
  isFI: boolean;

  // Quarterly cash flows
  w2Income: number;
  carryIncome: number;         // net of haircut
  lpIncome: number;
  rentalNetIncome: number;
  portfolioYieldIncome: number; // sum of ordinary + qualified + tax-exempt yield this quarter
  recurringSpending: number;
  oneTimeSpending: number;
  mortgagePayments: number;
  insurancePremiums: number;
  taxPayment: number;
  netCashFlow: number;

  // Annual tax snapshot (populated at Q4, carried forward for display)
  annualOrdinaryIncome: number;
  annualLtcgIncome: number;
  annualTotalTax: number;
  annualEffectiveTaxRate: number;
  // Full tax breakdown (populated at Q4, carried forward)
  annualFederalOrdinaryTax: number;
  annualFederalLtcgTax: number;
  annualFederalNiit: number;
  annualStateTax: number;
}

export interface SimulationResult {
  quarters: QuarterResult[];
  /** null = FI never achieved within the 40-year window */
  fiDate: { year: number; quarter: "Q1" | "Q2" | "Q3" | "Q4" } | null;
  fiAge: number | null;
  startYear: number;
  currentAge: number;

  summary: {
    totalCapitalToday: number;
    requiredCapitalToday: number;
    gapToFI: number;           // requiredCapital - totalCapital (negative = already FI)
    projectedAnnualSpending: number;
    permanentAnnualIncome: number; // rental net income = permanent post-FI offset
  };
}
