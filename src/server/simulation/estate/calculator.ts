// ─────────────────────────────────────────────────────────────────────────────
// Estate Calculator
// ─────────────────────────────────────────────────────────────────────────────
//
// Assembles a user's gross estate from all asset classes, computes federal +
// state estate tax, and produces planning metrics (gifting room, ILIT savings,
// LLC discount savings, beneficiary allocations).
//
// Gross estate components:
//   Investment accounts   — full balance (all types)
//   Real estate           — net equity (FMV × ownership × (1−discount) − mortgage)
//   Insurance (personal)  — net death benefit (deathBenefit − outstandingLoan)
//   Insurance (ILIT)      — excluded; tracked as ilitDeathBenefit for planning
//   Carry positions       — expected net carry (unrealized)
//   LP investments        — current NAV
// ─────────────────────────────────────────────────────────────────────────────

import type { FilingStatus } from "../tax/types";
import {
  calculateEstateTax,
  hasStateEstateTax,
  getStateEstateExemption,
  FEDERAL_EXEMPTION_2026,
} from "../tax/estate-tax";

// ── 2026 Annual Gift Tax Exclusion ────────────────────────────────────────────
// $19,000/recipient (2025 amount; 2026 indexed for inflation)
const ANNUAL_GIFT_EXCLUSION = 19_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export type EstateComponentCategory =
  | "investment_account"
  | "real_estate"
  | "insurance_personal"
  | "insurance_ilit"
  | "carry"
  | "lp_investment";

export interface EstateComponent {
  category: EstateComponentCategory;
  id: string;
  name: string;
  /** Net value included in taxable estate (0 for ILIT). */
  estateValue: number;
  /** True = counts toward gross estate; false = ILIT-excluded. */
  inEstate: boolean;
  /** Human-readable detail. */
  notes: string;
}

export interface BeneficiaryAllocation {
  name: string;
  birthYear: number;
  currentAge: number;
  inheritancePct: number;
  estimatedInheritance: number;
}

export interface EstatePlanningMetric {
  label: string;
  value: number;
  description: string;
  /** true = positive for the estate (reduces tax), false = neutral info */
  isSavings: boolean;
}

export interface EstateCalculationResult {
  components: EstateComponent[];

  // Aggregate estate values
  grossEstate: number;
  ilitDeathBenefit: number;
  netEstateBeforeTax: number;

  // Tax results
  federalTaxableEstate: number;
  federalEstateTax: number;
  stateEstateTax: number;
  totalEstateTax: number;
  estateAfterTax: number;

  // Exemptions
  federalExemption: number;
  stateExemption: number;
  hasStateEstateTax: boolean;

  // Planning metrics
  planningMetrics: EstatePlanningMetric[];

  // Beneficiaries
  beneficiaries: BeneficiaryAllocation[];

  // Metadata
  filingStatus: FilingStatus;
  stateCode: string;
  currentYear: number;
}

// ── Input Types ───────────────────────────────────────────────────────────────

export interface EstateCalcInput {
  profile: {
    filingStatus: FilingStatus;
    stateOfResidence: string;
    birthYear: number;
  };
  children: Array<{
    id: string;
    name: string;
    birthYear: number;
    inheritancePct: number;
  }>;
  investmentAccounts: Array<{
    id: string;
    accountName: string;
    accountType: string;
    currentBalance: number;
  }>;
  realEstate: Array<{
    id: string;
    propertyName: string;
    currentValue: number;
    ownershipPct: number;
    llcValuationDiscountPct: number;
    mortgage: { outstandingBalance: number } | null;
  }>;
  insurance: Array<{
    id: string;
    policyName: string;
    policyType: string;
    ownershipStructure: string;
    deathBenefit: number;
    outstandingLoanBalance: number;
  }>;
  carry: Array<{
    id: string;
    fundName: string;
    expectedGrossCarry: number;
    haircutPct: number;
    expectedRealizationYear: number;
  }>;
  lpInvestments: Array<{
    id: string;
    fundName: string;
    currentNav: number;
  }>;
  currentYear: number;
}

// ── Main Calculator ───────────────────────────────────────────────────────────

export function calculateEstate(input: EstateCalcInput): EstateCalculationResult {
  const { profile, children, currentYear } = input;
  const filing = profile.filingStatus;
  const stateCode = profile.stateOfResidence;
  const components: EstateComponent[] = [];

  // ── 1. Investment Accounts ────────────────────────────────────────────────
  for (const acct of input.investmentAccounts) {
    const typeLabel: Record<string, string> = {
      taxable: "Taxable",
      traditional_ira: "Traditional IRA",
      roth_ira: "Roth IRA",
      traditional_401k: "Traditional 401(k)",
      roth_401k: "Roth 401(k)",
      sep_ira: "SEP-IRA",
      solo_401k: "Solo 401(k)",
    };
    const isRoth = acct.accountType === "roth_ira" || acct.accountType === "roth_401k";
    const isTraditional = ["traditional_ira", "traditional_401k", "sep_ira", "solo_401k"].includes(
      acct.accountType,
    );

    components.push({
      category: "investment_account",
      id: acct.id,
      name: `${acct.accountName} (${typeLabel[acct.accountType] ?? acct.accountType})`,
      estateValue: acct.currentBalance,
      inEstate: true,
      notes: isRoth
        ? "Roth: heirs inherit tax-free (no income tax on distributions)"
        : isTraditional
          ? "Pre-tax: heirs owe income tax on withdrawals (Income in Respect of Decedent)"
          : "Taxable: heirs receive step-up in cost basis to FMV at date of death",
    });
  }

  // ── 2. Real Estate ────────────────────────────────────────────────────────
  for (const prop of input.realEstate) {
    const discountedValue = prop.currentValue * prop.ownershipPct * (1 - prop.llcValuationDiscountPct);
    const mortgageBalance = prop.mortgage?.outstandingBalance ?? 0;
    const netEquity = Math.max(0, discountedValue - mortgageBalance);
    const hasDiscount = prop.llcValuationDiscountPct > 0;

    components.push({
      category: "real_estate",
      id: prop.id,
      name: prop.propertyName,
      estateValue: netEquity,
      inEstate: true,
      notes: hasDiscount
        ? `FMV ${formatCompact(prop.currentValue * prop.ownershipPct)} discounted ${Math.round(prop.llcValuationDiscountPct * 100)}% via LLC → ${formatCompact(discountedValue)}; mortgage deducted`
        : mortgageBalance > 0
          ? `FMV ${formatCompact(prop.currentValue * prop.ownershipPct)} less ${formatCompact(mortgageBalance)} mortgage`
          : `FMV at ownership % (${Math.round(prop.ownershipPct * 100)}%)`,
    });
  }

  // ── 3. Insurance Policies ─────────────────────────────────────────────────
  let ilitDeathBenefit = 0;
  for (const policy of input.insurance) {
    const isIlit = policy.ownershipStructure === "ilit";
    const netBenefit = Math.max(0, policy.deathBenefit - policy.outstandingLoanBalance);
    const policyTypeLabel = policy.policyType === "ppli"
      ? "PPLI"
      : policy.policyType === "whole_life"
        ? "Whole Life"
        : "Term Life";

    if (isIlit) {
      ilitDeathBenefit += netBenefit;
      components.push({
        category: "insurance_ilit",
        id: policy.id,
        name: `${policy.policyName} (${policyTypeLabel} · ILIT)`,
        estateValue: 0,
        inEstate: false,
        notes: `${formatCompact(netBenefit)} death benefit held in ILIT — excluded from taxable estate`,
      });
    } else {
      components.push({
        category: "insurance_personal",
        id: policy.id,
        name: `${policy.policyName} (${policyTypeLabel} · Personal)`,
        estateValue: netBenefit,
        inEstate: true,
        notes: policy.outstandingLoanBalance > 0
          ? `Death benefit ${formatCompact(policy.deathBenefit)} less ${formatCompact(policy.outstandingLoanBalance)} outstanding loan`
          : "Personally-owned policy — death benefit included in gross estate",
      });
    }
  }

  // ── 4. Carry Positions (unrealized) ──────────────────────────────────────
  for (const carry of input.carry) {
    // Include all unrealized carry (realization year > currentYear, or current year not yet passed)
    const netCarry = carry.expectedGrossCarry * (1 - carry.haircutPct);
    if (netCarry <= 0) continue;

    const yearsToRealization = carry.expectedRealizationYear - currentYear;
    components.push({
      category: "carry",
      id: carry.id,
      name: `Carry — ${carry.fundName}`,
      estateValue: netCarry,
      inEstate: true,
      notes: `Expected ${formatCompact(netCarry)} net carry; realizing ~${carry.expectedRealizationYear} (${yearsToRealization > 0 ? `${yearsToRealization} yrs` : "this year"})`,
    });
  }

  // ── 5. LP Investments ─────────────────────────────────────────────────────
  for (const fund of input.lpInvestments) {
    if (fund.currentNav <= 0) continue;
    components.push({
      category: "lp_investment",
      id: fund.id,
      name: `LP — ${fund.fundName}`,
      estateValue: fund.currentNav,
      inEstate: true,
      notes: "Current NAV; final distribution may differ",
    });
  }

  // ── Aggregate ─────────────────────────────────────────────────────────────
  const grossEstate = components
    .filter(c => c.inEstate)
    .reduce((s, c) => s + c.estateValue, 0);

  const netEstateBeforeTax = grossEstate; // ILIT already excluded via in-estate flag

  // ── Estate Tax ────────────────────────────────────────────────────────────
  const taxResult = calculateEstateTax({
    grossEstate,
    ilitDeathBenefit,
    charitableDeductions: 0,
    maritalDeduction: 0, // shown as a planning note, not applied automatically
    stateCode,
    filingStatus: filing,
    year: currentYear,
  });

  // ── Exemptions ────────────────────────────────────────────────────────────
  const federalExemption = filing === "married_filing_jointly"
    ? FEDERAL_EXEMPTION_2026 * 2
    : FEDERAL_EXEMPTION_2026;
  const stateExemption = getStateEstateExemption(stateCode);
  const stateHasEstateTax = hasStateEstateTax(stateCode);

  // ── Planning Metrics ──────────────────────────────────────────────────────
  const planningMetrics: EstatePlanningMetric[] = [];

  // Annual gifting room
  const numBeneficiaries = children.length || 1;
  const annualGiftingRoom = ANNUAL_GIFT_EXCLUSION * numBeneficiaries;
  planningMetrics.push({
    label: "Annual Gifting Room",
    value: annualGiftingRoom,
    description: `$${(ANNUAL_GIFT_EXCLUSION / 1000).toFixed(0)}k × ${numBeneficiaries} ${numBeneficiaries === 1 ? "child" : "children"} — tax-free per year under annual exclusion`,
    isSavings: false,
  });

  // Unused federal exemption
  const unusedFederalExemption = Math.max(0, federalExemption - grossEstate);
  planningMetrics.push({
    label: "Unused Federal Exemption",
    value: unusedFederalExemption,
    description:
      unusedFederalExemption > 0
        ? `${formatCompact(unusedFederalExemption)} of ${formatCompact(federalExemption)} exemption remains — estate currently below federal threshold`
        : `Estate exceeds ${formatCompact(federalExemption)} exemption — federal estate tax applies`,
    isSavings: false,
  });

  // ILIT savings (compute tax without ILIT to measure savings)
  if (ilitDeathBenefit > 0) {
    const taxWithoutIlit = calculateEstateTax({
      grossEstate: grossEstate + ilitDeathBenefit,
      ilitDeathBenefit: 0,
      charitableDeductions: 0,
      maritalDeduction: 0,
      stateCode,
      filingStatus: filing,
      year: currentYear,
    });
    const ilitTaxSavings = Math.max(0, taxWithoutIlit.totalEstateTax - taxResult.totalEstateTax);
    planningMetrics.push({
      label: "ILIT Tax Savings",
      value: ilitTaxSavings,
      description: `${formatCompact(ilitDeathBenefit)} ILIT death benefit excluded from estate saves ${formatCompact(ilitTaxSavings)} in estate tax`,
      isSavings: true,
    });
  }

  // LLC valuation discount savings
  const llcDiscountTotal = input.realEstate.reduce((sum, p) => {
    return sum + p.currentValue * p.ownershipPct * p.llcValuationDiscountPct;
  }, 0);

  if (llcDiscountTotal > 0) {
    const taxWithoutDiscounts = calculateEstateTax({
      grossEstate: grossEstate + llcDiscountTotal,
      ilitDeathBenefit,
      charitableDeductions: 0,
      maritalDeduction: 0,
      stateCode,
      filingStatus: filing,
      year: currentYear,
    });
    const discountTaxSavings = Math.max(0, taxWithoutDiscounts.totalEstateTax - taxResult.totalEstateTax);
    planningMetrics.push({
      label: "LLC Discount Savings",
      value: discountTaxSavings,
      description: `${formatCompact(llcDiscountTotal)} valuation discount on LLC-held real estate reduces estate tax by ${formatCompact(discountTaxSavings)}`,
      isSavings: true,
    });
  }

  // MFJ portability note
  if (filing === "married_filing_jointly") {
    planningMetrics.push({
      label: "Portability (MFJ)",
      value: FEDERAL_EXEMPTION_2026,
      description: `Surviving spouse can inherit unused exemption (portability election). Effective combined federal shield: ${formatCompact(federalExemption)}.`,
      isSavings: false,
    });
  }

  // ── Beneficiary Allocations ───────────────────────────────────────────────
  const netEstate = taxResult.netEstate;
  const allocatedPct = children.reduce((s, c) => s + c.inheritancePct, 0);
  const beneficiaries: BeneficiaryAllocation[] = children.map(c => ({
    name: c.name,
    birthYear: c.birthYear,
    currentAge: currentYear - c.birthYear,
    inheritancePct: c.inheritancePct,
    estimatedInheritance: netEstate * c.inheritancePct,
  }));

  // Add "unallocated" row if percentages don't add up to 100%
  if (allocatedPct < 0.999 && children.length > 0) {
    beneficiaries.push({
      name: "Unallocated / Other",
      birthYear: 0,
      currentAge: 0,
      inheritancePct: 1 - allocatedPct,
      estimatedInheritance: netEstate * (1 - allocatedPct),
    });
  }

  return {
    components,
    grossEstate,
    ilitDeathBenefit,
    netEstateBeforeTax,
    federalTaxableEstate: taxResult.federalTaxableEstate,
    federalEstateTax: taxResult.federalEstateTax,
    stateEstateTax: taxResult.stateEstateTax,
    totalEstateTax: taxResult.totalEstateTax,
    estateAfterTax: taxResult.netEstate,
    federalExemption,
    stateExemption,
    hasStateEstateTax: stateHasEstateTax,
    planningMetrics,
    beneficiaries,
    filingStatus: filing,
    stateCode,
    currentYear,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCompact(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}
