import { describe, it, expect } from "vitest";
import { applyScenarioOverrides } from "../scenario-types";
import type { SimulationInput } from "../types";

// ── Minimal base input fixture ────────────────────────────────────────────────

const BASE: SimulationInput = {
  profile: {
    filingStatus: "single",
    stateOfResidence: "CA",
    birthYear: 1980,
    targetAge: 90,
    assumedReturnRate: 0.07,
    safeHarborElection: true,
  },
  income: {
    annualSalary: 500_000,
    annualBonus: 200_000,
    salaryGrowthRate: 0.05,
    bonusGrowthRate: 0.03,
  },
  carry: [
    { id: "c1", fundName: "Fund A", expectedGrossCarry: 5_000_000, haircutPct: 0.30, expectedRealizationYear: 2028, expectedRealizationQuarter: "Q2" },
    { id: "c2", fundName: "Fund B", expectedGrossCarry: 3_000_000, haircutPct: 0.20, expectedRealizationYear: 2030, expectedRealizationQuarter: "Q4" },
  ],
  lpDistributions: [],
  investmentAccounts: [
    { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 2_000_000, blendedReturnRate: 0.07, annualContribution: 50_000 },
  ],
  realEstate: [],
  insurance: [
    { id: "p1", policyType: "whole_life", ownershipStructure: "personal", deathBenefit: 5_000_000, annualPremium: 50_000, premiumYearsRemaining: 10, currentCashValue: 500_000, assumedReturnRate: 0.05, outstandingLoanBalance: 0, maxLoanPct: 0.9, isEstateTaxFunding: false },
    { id: "p2", policyType: "ppli", ownershipStructure: "ilit", deathBenefit: 10_000_000, annualPremium: 100_000, premiumYearsRemaining: 20, currentCashValue: 2_000_000, assumedReturnRate: 0.07, outstandingLoanBalance: 0, maxLoanPct: 0.9, isEstateTaxFunding: true },
  ],
  recurringExpenditures: [
    { description: "Living expenses", annualAmount: 300_000, growthRate: 0.03 },
    { description: "Travel",          annualAmount: 50_000,  growthRate: 0.02 },
  ],
  oneTimeExpenditures: [],
};

// ── Helper ────────────────────────────────────────────────────────────────────

function apply(overrides: Parameters<typeof applyScenarioOverrides>[1]) {
  return applyScenarioOverrides(BASE, overrides);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("applyScenarioOverrides", () => {
  it("returns a structurally equal result for empty overrides", () => {
    const result = apply({});
    expect(result.profile.assumedReturnRate).toBe(BASE.profile.assumedReturnRate);
    expect(result.profile.targetAge).toBe(BASE.profile.targetAge);
    expect(result.income?.annualSalary).toBe(BASE.income?.annualSalary);
    expect(result.recurringExpenditures).toHaveLength(BASE.recurringExpenditures.length);
    expect(result.carry).toHaveLength(BASE.carry.length);
    expect(result.insurance).toHaveLength(BASE.insurance.length);
  });

  it("does NOT mutate the base input", () => {
    const origRate = BASE.profile.assumedReturnRate;
    apply({ assumedReturnRate: 0.05 });
    expect(BASE.profile.assumedReturnRate).toBe(origRate);
  });

  it("overrides assumedReturnRate", () => {
    const result = apply({ assumedReturnRate: 0.05 });
    expect(result.profile.assumedReturnRate).toBe(0.05);
    // other profile fields unchanged
    expect(result.profile.targetAge).toBe(BASE.profile.targetAge);
    expect(result.profile.birthYear).toBe(BASE.profile.birthYear);
  });

  it("overrides targetAge", () => {
    const result = apply({ targetAge: 85 });
    expect(result.profile.targetAge).toBe(85);
    expect(result.profile.assumedReturnRate).toBe(BASE.profile.assumedReturnRate);
  });

  it("overrides safeHarborElection", () => {
    const result = apply({ safeHarborElection: false });
    expect(result.profile.safeHarborElection).toBe(false);
  });

  it("overrides income fields individually", () => {
    const result = apply({ annualSalary: 800_000, salaryGrowthRate: 0.08 });
    expect(result.income?.annualSalary).toBe(800_000);
    expect(result.income?.salaryGrowthRate).toBe(0.08);
    // unoveridden income fields unchanged
    expect(result.income?.annualBonus).toBe(BASE.income?.annualBonus);
    expect(result.income?.bonusGrowthRate).toBe(BASE.income?.bonusGrowthRate);
  });

  it("handles null income gracefully when income overrides are provided", () => {
    const noIncomeBase: SimulationInput = { ...BASE, income: null };
    const result = applyScenarioOverrides(noIncomeBase, { annualSalary: 1_000_000 });
    expect(result.income).toBeNull();
  });

  it("scales recurringExpenditures by spendingMultiplier", () => {
    const result = apply({ recurringSpendingMultiplier: 0.8 });
    expect(result.recurringExpenditures[0].annualAmount).toBeCloseTo(240_000, 1); // 300k × 0.8
    expect(result.recurringExpenditures[1].annualAmount).toBeCloseTo(40_000, 1);  // 50k × 0.8
    // growthRate should be unchanged
    expect(result.recurringExpenditures[0].growthRate).toBe(0.03);
  });

  it("does not scale expenditures when multiplier is undefined", () => {
    const result = apply({});
    expect(result.recurringExpenditures[0].annualAmount).toBe(300_000);
  });

  it("multiplies carry haircutPct by carryHaircutMultiplier", () => {
    const result = apply({ carryHaircutMultiplier: 1.5 });
    // 0.30 × 1.5 = 0.45
    expect(result.carry[0].haircutPct).toBeCloseTo(0.45, 5);
    // 0.20 × 1.5 = 0.30
    expect(result.carry[1].haircutPct).toBeCloseTo(0.30, 5);
  });

  it("clamps carry haircutPct at 1.0", () => {
    const result = apply({ carryHaircutMultiplier: 10.0 });
    // 0.30 × 10 = 3.0 → clamped to 1.0
    expect(result.carry[0].haircutPct).toBe(1.0);
  });

  it("clamps carry haircutPct at 0 (never negative)", () => {
    const result = apply({ carryHaircutMultiplier: -1 });
    expect(result.carry[0].haircutPct).toBe(0);
  });

  it("halves carry haircut with 0.5 multiplier (optimistic scenario)", () => {
    const result = apply({ carryHaircutMultiplier: 0.5 });
    // 0.30 × 0.5 = 0.15
    expect(result.carry[0].haircutPct).toBeCloseTo(0.15, 5);
  });

  it("forces all insurance to ILIT ownership", () => {
    const result = apply({ forceInsuranceOwnership: "ilit" });
    expect(result.insurance[0].ownershipStructure).toBe("ilit");
    expect(result.insurance[1].ownershipStructure).toBe("ilit");
  });

  it("forces all insurance to personal ownership", () => {
    const result = apply({ forceInsuranceOwnership: "personal" });
    expect(result.insurance[0].ownershipStructure).toBe("personal");
    expect(result.insurance[1].ownershipStructure).toBe("personal");
  });

  it("leaves insurance ownership unchanged when null", () => {
    const result = apply({ forceInsuranceOwnership: null });
    expect(result.insurance[0].ownershipStructure).toBe("personal");
    expect(result.insurance[1].ownershipStructure).toBe("ilit");
  });

  it("leaves insurance ownership unchanged when override is absent", () => {
    const result = apply({});
    expect(result.insurance[0].ownershipStructure).toBe(BASE.insurance[0].ownershipStructure);
    expect(result.insurance[1].ownershipStructure).toBe(BASE.insurance[1].ownershipStructure);
  });

  it("combines multiple overrides simultaneously", () => {
    const result = apply({
      assumedReturnRate: 0.05,
      recurringSpendingMultiplier: 1.1,
      carryHaircutMultiplier: 1.5,
    });
    expect(result.profile.assumedReturnRate).toBe(0.05);
    expect(result.recurringExpenditures[0].annualAmount).toBeCloseTo(330_000, 1); // 300k × 1.1
    expect(result.carry[0].haircutPct).toBeCloseTo(0.45, 5);                     // 0.30 × 1.5
    // income unchanged
    expect(result.income?.annualSalary).toBe(500_000);
  });

  it("preserves all non-overridden array lengths", () => {
    const result = apply({ assumedReturnRate: 0.09 });
    expect(result.carry).toHaveLength(BASE.carry.length);
    expect(result.investmentAccounts).toHaveLength(BASE.investmentAccounts.length);
    expect(result.insurance).toHaveLength(BASE.insurance.length);
    expect(result.recurringExpenditures).toHaveLength(BASE.recurringExpenditures.length);
  });
});
