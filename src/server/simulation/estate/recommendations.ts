// ─────────────────────────────────────────────────────────────────────────────
// Estate Optimization Rules Engine
// ─────────────────────────────────────────────────────────────────────────────
//
// Pure function — no DB calls, no side effects.
// Input:  EstateCalculationResult (already computed by calculateEstate())
// Output: EstateRecommendation[] sorted by priority, then by estimatedTaxSavings
//
// 8 rules:
//   1. ILIT Conversion
//   2. Annual Gifting
//   3. Marital Deduction (MFJ only)
//   4. Portability Election (MFJ only)
//   5. Charitable Giving (DAF / CRT)
//   6. LLC Valuation Discount
//   7. Trust Strategies (GRATs / SLATs)
//   8. Qualified Opportunity Zone
// ─────────────────────────────────────────────────────────────────────────────

import type { EstateCalculationResult } from "./calculator";
import { calculateEstateTax, FEDERAL_EXEMPTION_2026 } from "../tax/estate-tax";

// ── Types ──────────────────────────────────────────────────────────────────────

export type RecommendationPriority = "high" | "medium" | "low";

export type RecommendationCategory =
  | "insurance"
  | "gifting"
  | "trust"
  | "real_estate"
  | "portability"
  | "charitable"
  | "opportunity_zone";

export interface EstateRecommendation {
  /** Stable slug ID used for React keys and tests. */
  id: string;
  /** Short headline. */
  title: string;
  /** 1–2 sentence explanation contextualised to the user's estate. */
  description: string;
  /**
   * Estimated federal + state estate tax reduction if the strategy is implemented.
   * 0 = qualitative / deferral benefit (no precise figure). UI omits the savings
   * badge when this is 0.
   */
  estimatedTaxSavings: number;
  priority: RecommendationPriority;
  /** Short imperative action the user should take. */
  actionRequired: string;
  category: RecommendationCategory;
  /** Optional key figures shown in the expanded detail panel. */
  supportingFigures?: Array<{ label: string; value: string }>;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ANNUAL_GIFT_EXCLUSION = 19_000;
const FEDERAL_ESTATE_RATE = 0.40;

// ── Main entry point ───────────────────────────────────────────────────────────

export function generateRecommendations(
  result: EstateCalculationResult,
): EstateRecommendation[] {
  const out: EstateRecommendation[] = [];

  ruleIlitConversion(result, out);
  ruleAnnualGifting(result, out);
  ruleMaritalDeduction(result, out);
  rulePortabilityElection(result, out);
  ruleCharitableGiving(result, out);
  ruleLlcDiscount(result, out);
  ruleTrustStrategies(result, out);
  ruleQualifiedOpportunityZone(result, out);

  const priorityOrder: Record<RecommendationPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  out.sort((a, b) => {
    const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pd !== 0) return pd;
    return b.estimatedTaxSavings - a.estimatedTaxSavings;
  });

  return out;
}

// ── Rule 1: ILIT Conversion ────────────────────────────────────────────────────

function ruleIlitConversion(
  result: EstateCalculationResult,
  out: EstateRecommendation[],
): void {
  const personalPolicies = result.components.filter(
    c => c.category === "insurance_personal" && c.estateValue > 500_000,
  );
  if (personalPolicies.length === 0) return;

  // Only trigger if estate is at or within $2M below the federal exemption (or already above it)
  const distanceFromExemption = result.federalExemption - result.grossEstate;
  if (distanceFromExemption >= 2_000_000) return;

  const totalPersonalInsuranceValue = personalPolicies.reduce(
    (s, p) => s + p.estateValue,
    0,
  );

  // Counterfactual: move personal insurance value into ILIT bucket
  const counterfactualTax = calculateEstateTax({
    grossEstate: result.grossEstate - totalPersonalInsuranceValue,
    ilitDeathBenefit: result.ilitDeathBenefit + totalPersonalInsuranceValue,
    charitableDeductions: 0,
    maritalDeduction: 0,
    stateCode: result.stateCode,
    filingStatus: result.filingStatus,
    year: result.currentYear,
  });
  const taxSavings = Math.max(
    0,
    result.totalEstateTax - counterfactualTax.totalEstateTax,
  );

  const isAboveThreshold = result.grossEstate > result.federalExemption;

  out.push({
    id: "ilit-conversion",
    title: "Convert Personal Life Insurance to ILIT",
    description:
      `Your ${personalPolicies.length === 1 ? "personally-owned policy" : `${personalPolicies.length} personally-owned policies`} (${fc(totalPersonalInsuranceValue)} total death benefit) ${
        isAboveThreshold
          ? "are included in your taxable estate, which already exceeds the federal exemption."
          : `will likely push your estate above the ${fc(result.federalExemption)} federal exemption.`
      } Transferring these policies to an Irrevocable Life Insurance Trust (ILIT) removes the death benefit from your taxable estate entirely.`,
    estimatedTaxSavings: taxSavings,
    priority: isAboveThreshold ? "high" : "medium",
    actionRequired:
      "Work with an estate attorney to establish an ILIT and transfer existing policies. Note: the 3-year look-back rule (IRC §2035) applies to transfers of existing policies — new policies placed directly into the ILIT avoid this issue.",
    category: "insurance",
    supportingFigures: [
      { label: "Death benefit to remove from estate", value: fc(totalPersonalInsuranceValue) },
      { label: "Est. estate tax savings", value: fc(taxSavings) },
    ],
  });
}

// ── Rule 2: Annual Gifting ─────────────────────────────────────────────────────

function ruleAnnualGifting(
  result: EstateCalculationResult,
  out: EstateRecommendation[],
): void {
  const isMfj = result.filingStatus === "married_filing_jointly";
  const numBeneficiaries = Math.max(
    1,
    result.beneficiaries.filter(b => b.birthYear > 0).length,
  );

  // MFJ: both spouses can gift, doubling effective annual capacity
  const annualGiftCapacity =
    ANNUAL_GIFT_EXCLUSION * numBeneficiaries * (isMfj ? 2 : 1);

  const excessAboveExemption = Math.max(0, result.grossEstate - result.federalExemption);

  const yearsToGiftDown =
    excessAboveExemption > 0 && annualGiftCapacity > 0
      ? Math.ceil(excessAboveExemption / annualGiftCapacity)
      : null;

  const tenYearGiftValue = annualGiftCapacity * 10;
  const taxablePortion = Math.min(tenYearGiftValue, excessAboveExemption);
  const tenYearTaxSavings = taxablePortion * FEDERAL_ESTATE_RATE;

  const priority: RecommendationPriority =
    excessAboveExemption > 5_000_000
      ? "high"
      : excessAboveExemption > 0
        ? "medium"
        : "low";

  out.push({
    id: "annual-gifting",
    title: "Maximize Annual Gift Tax Exclusions",
    description:
      `You can gift ${fc(annualGiftCapacity)}/year tax-free${isMfj ? " (both spouses combined)" : ""} to your ${numBeneficiaries} ${numBeneficiaries === 1 ? "beneficiary" : "beneficiaries"} without using your lifetime exemption. ${
        yearsToGiftDown !== null
          ? `At this rate, consistent gifting could reduce your taxable estate below the federal threshold in approximately ${yearsToGiftDown} years.`
          : "Your estate is currently below the federal threshold — gifting now locks in lower future estate values."
      }`,
    estimatedTaxSavings: tenYearTaxSavings,
    priority,
    actionRequired:
      `Gift ${fc(ANNUAL_GIFT_EXCLUSION)}/year per child${isMfj ? " from each spouse" : ""} by December 31 each year. Consider direct transfers, 529 contributions, or 529 superfunding (5-year gift tax averaging).`,
    category: "gifting",
    supportingFigures: [
      { label: "Annual gift capacity", value: fc(annualGiftCapacity) },
      { label: "10-year total gifts", value: fc(tenYearGiftValue) },
      { label: "Est. 10-yr tax savings", value: fc(tenYearTaxSavings) },
      ...(yearsToGiftDown !== null
        ? [{ label: "Years to gift below threshold", value: `${yearsToGiftDown} yrs` }]
        : []),
    ],
  });
}

// ── Rule 3: Marital Deduction ──────────────────────────────────────────────────

function ruleMaritalDeduction(
  result: EstateCalculationResult,
  out: EstateRecommendation[],
): void {
  if (result.filingStatus !== "married_filing_jointly") return;

  const combinedExemption = FEDERAL_EXEMPTION_2026 * 2;
  if (result.grossEstate <= combinedExemption) return;

  const excessAboveCombined = result.grossEstate - combinedExemption;

  out.push({
    id: "marital-deduction",
    title: "Structure Transfers to Use the Unlimited Marital Deduction",
    description:
      `Your estate of ${fc(result.grossEstate)} exceeds the combined MFJ exemption of ${fc(combinedExemption)}. Transfers between US-citizen spouses qualify for the unlimited marital deduction (IRC §2056), deferring estate tax until the surviving spouse's death. However, this defers rather than eliminates the tax — proper QTIP or credit-shelter (bypass) trust structuring ensures both spouses' exemptions are fully utilized.`,
    estimatedTaxSavings: 0, // Deferral mechanism, not a permanent reduction
    priority: "medium",
    actionRequired:
      "Consult an estate attorney about QTIP trusts or AB trusts to shelter both spouses' exemptions rather than stacking everything into the surviving spouse's estate.",
    category: "trust",
    supportingFigures: [
      { label: "Estate above combined exemption", value: fc(excessAboveCombined) },
      {
        label: "Potential tax on survivor's estate",
        value: fc(Math.round(excessAboveCombined * FEDERAL_ESTATE_RATE)),
      },
    ],
  });
}

// ── Rule 4: Portability Election ───────────────────────────────────────────────

function rulePortabilityElection(
  result: EstateCalculationResult,
  out: EstateRecommendation[],
): void {
  if (result.filingStatus !== "married_filing_jointly") return;

  const unusedExemption = Math.max(0, result.federalExemption - result.grossEstate);
  const isNearThreshold = result.grossEstate > result.federalExemption * 0.70;

  out.push({
    id: "portability-election",
    title: "File Form 706 to Elect Portability of Deceased Spouse's Exemption",
    description:
      `As a married filer, the surviving spouse can inherit any unused federal exemption from the first spouse to die (the DSUE — Deceased Spouse Unused Exclusion). The executor must file Form 706 within 5 years of death (Rev. Proc. 2022-32 late-filing relief). ${
        unusedExemption > 0
          ? `Your current unused federal exemption is ${fc(unusedExemption)} — this amount is portable to your surviving spouse.`
          : "Your estate currently uses the full combined exemption, making a timely portability election critical."
      }`,
    estimatedTaxSavings: 0, // Preserves future exemption, not a current savings
    priority: isNearThreshold ? "high" : "medium",
    actionRequired:
      "Instruct your estate attorney and executor to file IRS Form 706 after the first spouse's death — even if no estate tax is currently owed — to preserve the DSUE for the surviving spouse.",
    category: "portability",
    supportingFigures: [
      {
        label: "Current unused exemption (portable)",
        value: fc(unusedExemption),
      },
      { label: "Filing deadline", value: "Within 5 yrs of death (Rev. Proc. 2022-32)" },
    ],
  });
}

// ── Rule 5: Charitable Giving ──────────────────────────────────────────────────

function ruleCharitableGiving(
  result: EstateCalculationResult,
  out: EstateRecommendation[],
): void {
  const excessAboveExemption = result.grossEstate - result.federalExemption;
  if (excessAboveExemption < 3_000_000) return;

  // Illustrative charitable vehicle: 10% of excess, capped at $2M
  const illustrativeGift = Math.min(excessAboveExemption * 0.10, 2_000_000);

  // Combined federal + effective state rate on excess
  const effectiveStatePct =
    result.stateEstateTax > 0 && result.grossEstate > result.stateExemption
      ? result.stateEstateTax /
        Math.max(1, result.grossEstate - result.stateExemption)
      : 0;
  const combinedRate = FEDERAL_ESTATE_RATE + effectiveStatePct;
  const illustrativeSavings = Math.round(illustrativeGift * combinedRate);

  const priority: RecommendationPriority =
    excessAboveExemption > 10_000_000 ? "high" : "medium";

  out.push({
    id: "charitable-giving",
    title: "Reduce Taxable Estate via Donor Advised Fund or CRT",
    description:
      `Your estate is ${fc(excessAboveExemption)} above the federal exemption. A Donor Advised Fund (DAF) provides an immediate estate and income tax deduction; a Charitable Remainder Trust (CRT) provides you or your heirs with an income stream before the remainder passes to charity. Either vehicle permanently reduces your taxable estate while supporting causes you care about.`,
    estimatedTaxSavings: illustrativeSavings,
    priority,
    actionRequired:
      "Work with a financial advisor or estate attorney to model a DAF contribution or CRT. Fidelity Charitable, Schwab Charitable, and Vanguard Charitable are common DAF sponsors with low minimums.",
    category: "charitable",
    supportingFigures: [
      { label: "Excess above federal exemption", value: fc(excessAboveExemption) },
      {
        label: `Est. savings from ${fc(illustrativeGift)} charitable vehicle`,
        value: fc(illustrativeSavings),
      },
      {
        label: "Effective combined tax rate on excess",
        value: `${Math.round(combinedRate * 100)}%`,
      },
    ],
  });
}

// ── Rule 6: LLC Valuation Discount ────────────────────────────────────────────

function ruleLlcDiscount(
  result: EstateCalculationResult,
  out: EstateRecommendation[],
): void {
  // Real estate components with no existing LLC discount (detected via notes)
  const undiscountedRealEstate = result.components.filter(
    c =>
      c.category === "real_estate" &&
      c.inEstate &&
      c.estateValue > 1_000_000 &&
      !c.notes.includes("discounted"),
  );
  if (undiscountedRealEstate.length === 0) return;

  const totalUndiscountedValue = undiscountedRealEstate.reduce(
    (s, c) => s + c.estateValue,
    0,
  );

  // Illustrative 25% discount
  const ILLUSTRATIVE_DISCOUNT = 0.25;
  const illustrativeDiscountAmount = totalUndiscountedValue * ILLUSTRATIVE_DISCOUNT;

  const counterfactualTax = calculateEstateTax({
    grossEstate: result.grossEstate - illustrativeDiscountAmount,
    ilitDeathBenefit: result.ilitDeathBenefit,
    charitableDeductions: 0,
    maritalDeduction: 0,
    stateCode: result.stateCode,
    filingStatus: result.filingStatus,
    year: result.currentYear,
  });
  const taxSavings = Math.max(
    0,
    result.totalEstateTax - counterfactualTax.totalEstateTax,
  );

  const nearThreshold = result.grossEstate > result.federalExemption * 0.80;
  const priority: RecommendationPriority = nearThreshold ? "medium" : "low";

  out.push({
    id: "llc-discount",
    title: "Form LLC to Claim Valuation Discount on Real Estate",
    description:
      `You have ${fc(totalUndiscountedValue)} in real estate held outside an LLC structure. Holding real estate inside a Family Limited Partnership (FLP) or multi-member LLC allows your estate to claim a minority interest and lack-of-marketability valuation discount of 20–35% for estate tax purposes, reducing the taxable value of those assets.`,
    estimatedTaxSavings: taxSavings,
    priority,
    actionRequired:
      "Consult a CPA and estate attorney to evaluate forming a Family LLC or FLP for your real estate. The LLC must have genuine non-tax business purposes (centralized management, liability protection) to withstand IRS scrutiny under IRC §2036.",
    category: "real_estate",
    supportingFigures: [
      { label: "Real estate without LLC structure", value: fc(totalUndiscountedValue) },
      { label: "Illustrative 25% discount amount", value: fc(illustrativeDiscountAmount) },
      { label: "Est. estate tax savings", value: fc(taxSavings) },
    ],
  });
}

// ── Rule 7: Trust Strategies (GRATs / SLATs) ──────────────────────────────────

function ruleTrustStrategies(
  result: EstateCalculationResult,
  out: EstateRecommendation[],
): void {
  const excessAboveExemption = result.grossEstate - result.federalExemption;
  if (excessAboveExemption < 5_000_000) return;

  const isMfj = result.filingStatus === "married_filing_jointly";

  out.push({
    id: "grat-slat",
    title: "Explore GRATs and SLATs for Advanced Wealth Transfer",
    description:
      `With ${fc(excessAboveExemption)} above the federal exemption, advanced trust strategies can freeze your estate and transfer future appreciation to heirs estate-tax-free. A Grantor Retained Annuity Trust (GRAT) transfers appreciation above the IRS §7520 hurdle rate to heirs with zero gift tax. ${
        isMfj
          ? "A Spousal Lifetime Access Trust (SLAT) lets you gift assets to an irrevocable trust while your spouse retains access to income."
          : "An Irrevocable Grantor Trust can accelerate income tax payments (reducing the taxable estate) while growing wealth for heirs."
      }`,
    estimatedTaxSavings: 0, // Highly variable; depends on asset growth vs §7520 rate
    priority: "medium",
    actionRequired:
      `Engage an estate planning attorney specializing in irrevocable trusts. GRATs are most effective for high-growth assets in low-interest-rate environments. ${
        isMfj
          ? "Each spouse should establish separate SLATs to avoid the reciprocal trust doctrine."
          : ""
      }`,
    category: "trust",
    supportingFigures: [
      { label: "Estate above exemption", value: fc(excessAboveExemption) },
      {
        label: "GRAT advantage",
        value: "Transfers appreciation above IRS §7520 rate, gift-tax free",
      },
      ...(isMfj
        ? [{ label: "SLAT advantage", value: "Spouse retains income access from irrevocable trust" }]
        : []),
    ],
  });
}

// ── Rule 8: Qualified Opportunity Zone ────────────────────────────────────────

function ruleQualifiedOpportunityZone(
  result: EstateCalculationResult,
  out: EstateRecommendation[],
): void {
  const carryAndLp = result.components.filter(
    c => c.category === "carry" || c.category === "lp_investment",
  );
  const totalCarryAndLp = carryAndLp.reduce((s, c) => s + c.estateValue, 0);

  if (totalCarryAndLp < 1_000_000) return;
  // Most compelling when estate is near or above exemption
  if (result.grossEstate < result.federalExemption * 0.70) return;

  out.push({
    id: "qualified-opportunity-zone",
    title: "Invest Realized Gains in a Qualified Opportunity Zone Fund",
    description:
      `You have ${fc(totalCarryAndLp)} in carry and LP positions. When these realize, capital gains reinvested in a Qualified Opportunity Zone (QOZ) fund within 180 days defer federal tax until 2026 (or earlier sale) and eliminate capital gains tax on QOZ appreciation held 10+ years. This also reduces your taxable estate by keeping capital in a deferred vehicle.`,
    estimatedTaxSavings: 0, // Deferral; permanent benefit depends on hold period and appreciation
    priority: "low",
    actionRequired:
      "When carry or LP distributions realize capital gains, consult a tax advisor about 180-day QOZ reinvestment eligibility. Evaluate the underlying QOZ fund's investment quality independently before committing.",
    category: "opportunity_zone",
    supportingFigures: [
      {
        label: "Carry + LP value (potential gains source)",
        value: fc(totalCarryAndLp),
      },
      { label: "QOZ reinvestment window", value: "180 days from realization" },
      {
        label: "QOZ appreciation benefit",
        value: "10+ yr hold → no capital gains tax on QOZ gains",
      },
    ],
  });
}

// ── Internal helper ────────────────────────────────────────────────────────────

function fc(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}
