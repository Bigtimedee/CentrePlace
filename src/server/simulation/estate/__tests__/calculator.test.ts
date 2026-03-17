import { describe, it, expect } from "vitest";
import { calculateEstate } from "../calculator";
import type { EstateCalcInput } from "../calculator";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseProfile = {
  filingStatus: "single" as const,
  stateOfResidence: "CA",
  birthYear: 1970,
};

const currentYear = 2026;

function makeInput(overrides: Partial<EstateCalcInput> = {}): EstateCalcInput {
  return {
    profile: baseProfile,
    children: [],
    investmentAccounts: [],
    realEstate: [],
    insurance: [],
    carry: [],
    lpInvestments: [],
    currentYear,
    ...overrides,
  };
}

// ── Investment Accounts ───────────────────────────────────────────────────────

describe("investment accounts", () => {
  it("includes taxable account at full balance", () => {
    const result = calculateEstate(
      makeInput({
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 5_000_000 },
        ],
      }),
    );
    expect(result.grossEstate).toBe(5_000_000);
    expect(result.components).toHaveLength(1);
    expect(result.components[0].inEstate).toBe(true);
    expect(result.components[0].estateValue).toBe(5_000_000);
  });

  it("includes traditional IRA at full balance with IRD note", () => {
    const result = calculateEstate(
      makeInput({
        investmentAccounts: [
          { id: "a2", accountName: "IRA", accountType: "traditional_ira", currentBalance: 2_000_000 },
        ],
      }),
    );
    expect(result.grossEstate).toBe(2_000_000);
    expect(result.components[0].notes).toMatch(/income tax/i);
  });

  it("includes multiple accounts summed correctly", () => {
    const result = calculateEstate(
      makeInput({
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable",          currentBalance: 3_000_000 },
          { id: "a2", accountName: "401k",       accountType: "traditional_401k", currentBalance: 2_000_000 },
          { id: "a3", accountName: "Roth",       accountType: "roth_ira",         currentBalance: 1_000_000 },
        ],
      }),
    );
    expect(result.grossEstate).toBe(6_000_000);
  });
});

// ── Real Estate ───────────────────────────────────────────────────────────────

describe("real estate", () => {
  it("includes net equity (value × ownershipPct − mortgage)", () => {
    const result = calculateEstate(
      makeInput({
        realEstate: [
          {
            id: "re1",
            propertyName: "Primary Home",
            currentValue: 2_000_000,
            ownershipPct: 1.0,
            llcValuationDiscountPct: 0,
            mortgage: { outstandingBalance: 500_000 },
          },
        ],
      }),
    );
    expect(result.grossEstate).toBe(1_500_000);
  });

  it("applies LLC valuation discount before mortgage deduction", () => {
    const result = calculateEstate(
      makeInput({
        realEstate: [
          {
            id: "re1",
            propertyName: "Rental LLC",
            currentValue: 4_000_000,
            ownershipPct: 1.0,
            llcValuationDiscountPct: 0.25, // 25% discount
            mortgage: { outstandingBalance: 0 },
          },
        ],
      }),
    );
    // 4M × 1.0 × (1 − 0.25) = 3M
    expect(result.grossEstate).toBe(3_000_000);
  });

  it("applies partial ownership percentage", () => {
    const result = calculateEstate(
      makeInput({
        realEstate: [
          {
            id: "re1",
            propertyName: "50% Share",
            currentValue: 2_000_000,
            ownershipPct: 0.5,
            llcValuationDiscountPct: 0,
            mortgage: null,
          },
        ],
      }),
    );
    expect(result.grossEstate).toBe(1_000_000);
  });

  it("floors net equity at 0 (upside-down property)", () => {
    const result = calculateEstate(
      makeInput({
        realEstate: [
          {
            id: "re1",
            propertyName: "Underwater",
            currentValue: 500_000,
            ownershipPct: 1.0,
            llcValuationDiscountPct: 0,
            mortgage: { outstandingBalance: 600_000 },
          },
        ],
      }),
    );
    expect(result.grossEstate).toBe(0);
  });
});

// ── Insurance ─────────────────────────────────────────────────────────────────

describe("insurance policies", () => {
  it("includes personally-owned policy death benefit in gross estate", () => {
    const result = calculateEstate(
      makeInput({
        insurance: [
          {
            id: "p1",
            policyName: "Term 20",
            policyType: "term_life",
            ownershipStructure: "personal",
            deathBenefit: 5_000_000,
            outstandingLoanBalance: 0,
          },
        ],
      }),
    );
    expect(result.grossEstate).toBe(5_000_000);
    expect(result.ilitDeathBenefit).toBe(0);
  });

  it("excludes ILIT-owned policy from gross estate, captures in ilitDeathBenefit", () => {
    const result = calculateEstate(
      makeInput({
        insurance: [
          {
            id: "p1",
            policyName: "ILIT WL",
            policyType: "whole_life",
            ownershipStructure: "ilit",
            deathBenefit: 10_000_000,
            outstandingLoanBalance: 0,
          },
        ],
      }),
    );
    expect(result.grossEstate).toBe(0);
    expect(result.ilitDeathBenefit).toBe(10_000_000);
    expect(result.components[0].inEstate).toBe(false);
  });

  it("deducts outstanding loan from policy benefit", () => {
    const result = calculateEstate(
      makeInput({
        insurance: [
          {
            id: "p1",
            policyName: "WL Personal",
            policyType: "whole_life",
            ownershipStructure: "personal",
            deathBenefit: 5_000_000,
            outstandingLoanBalance: 500_000,
          },
        ],
      }),
    );
    expect(result.grossEstate).toBe(4_500_000);
  });
});

// ── Carry ─────────────────────────────────────────────────────────────────────

describe("carry positions", () => {
  it("includes net carry in gross estate", () => {
    const result = calculateEstate(
      makeInput({
        carry: [
          {
            id: "c1",
            fundName: "Fund III",
            expectedGrossCarry: 10_000_000,
            haircutPct: 0.30,
            realizationSchedule: [{ year: 2029, pct: 1.0 }],
          },
        ],
      }),
    );
    // 10M × 1.0 unrealized × (1 - 0.30) = 7M
    expect(result.grossEstate).toBe(7_000_000);
  });

  it("excludes already-realized tranches from gross estate", () => {
    const result = calculateEstate(
      makeInput({
        carry: [
          {
            id: "c1",
            fundName: "Fund III",
            expectedGrossCarry: 10_000_000,
            haircutPct: 0.30,
            // 40% already realized in 2025, 60% future
            realizationSchedule: [{ year: 2025, pct: 0.4 }, { year: 2029, pct: 0.6 }],
          },
        ],
      }),
    );
    // Only 60% unrealized: 10M × 0.6 × (1 - 0.30) = 4.2M
    expect(result.grossEstate).toBeCloseTo(4_200_000);
  });

  it("skips carry positions with zero or negative net carry", () => {
    const result = calculateEstate(
      makeInput({
        carry: [
          {
            id: "c1",
            fundName: "Zeroed Fund",
            expectedGrossCarry: 5_000_000,
            haircutPct: 1.0,
            realizationSchedule: [{ year: 2028, pct: 1.0 }],
          },
        ],
      }),
    );
    expect(result.grossEstate).toBe(0);
    expect(result.components).toHaveLength(0);
  });
});

// ── LP Investments ────────────────────────────────────────────────────────────

describe("LP investments", () => {
  it("includes current NAV in gross estate", () => {
    const result = calculateEstate(
      makeInput({
        lpInvestments: [
          { id: "lp1", fundName: "Buyout Fund IV", currentNav: 3_500_000 },
        ],
      }),
    );
    expect(result.grossEstate).toBe(3_500_000);
  });

  it("skips LP positions with zero NAV", () => {
    const result = calculateEstate(
      makeInput({
        lpInvestments: [{ id: "lp1", fundName: "Empty Fund", currentNav: 0 }],
      }),
    );
    expect(result.grossEstate).toBe(0);
    expect(result.components).toHaveLength(0);
  });
});

// ── Estate Tax ────────────────────────────────────────────────────────────────

describe("federal estate tax", () => {
  it("charges no federal tax when estate is below $7.18M (single)", () => {
    const result = calculateEstate(
      makeInput({
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 5_000_000 },
        ],
      }),
    );
    expect(result.federalEstateTax).toBe(0);
    expect(result.totalEstateTax).toBe(0);
  });

  it("charges 40% on amount above single exemption ($7.18M)", () => {
    const result = calculateEstate(
      makeInput({
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 10_000_000 },
        ],
      }),
    );
    // $10M − $7.18M = $2.82M taxable → × 0.40 = $1.128M
    expect(result.federalEstateTax).toBeCloseTo(1_128_000, -3);
  });

  it("doubles exemption for MFJ filing", () => {
    const result = calculateEstate(
      makeInput({
        profile: { ...baseProfile, filingStatus: "married_filing_jointly" },
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 10_000_000 },
        ],
      }),
    );
    // MFJ exemption = $14.36M; $10M < $14.36M → no tax
    expect(result.federalEstateTax).toBe(0);
    expect(result.federalExemption).toBe(14_360_000);
  });
});

// ── State Estate Tax ──────────────────────────────────────────────────────────

describe("state estate tax", () => {
  it("returns zero state tax for CA (no state estate tax)", () => {
    const result = calculateEstate(
      makeInput({
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 20_000_000 },
        ],
      }),
    );
    expect(result.stateEstateTax).toBe(0);
    expect(result.hasStateEstateTax).toBe(false);
  });

  it("charges Oregon state estate tax above $1M exemption", () => {
    const result = calculateEstate(
      makeInput({
        profile: { ...baseProfile, stateOfResidence: "OR" },
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 3_000_000 },
        ],
      }),
    );
    expect(result.hasStateEstateTax).toBe(true);
    expect(result.stateEstateTax).toBeGreaterThan(0);
    expect(result.stateExemption).toBe(1_000_000);
  });

  it("NY state estate tax applies above exemption", () => {
    const result = calculateEstate(
      makeInput({
        profile: { ...baseProfile, stateOfResidence: "NY" },
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 10_000_000 },
        ],
      }),
    );
    expect(result.hasStateEstateTax).toBe(true);
    expect(result.stateEstateTax).toBeGreaterThan(0);
  });
});

// ── Planning Metrics ──────────────────────────────────────────────────────────

describe("planning metrics", () => {
  it("calculates annual gifting room based on number of children", () => {
    const result = calculateEstate(
      makeInput({
        children: [
          { id: "c1", name: "Alice", birthYear: 2000, inheritancePct: 0.5 },
          { id: "c2", name: "Bob",   birthYear: 2002, inheritancePct: 0.5 },
        ],
      }),
    );
    const giftingMetric = result.planningMetrics.find(m => m.label === "Annual Gifting Room");
    expect(giftingMetric).toBeDefined();
    // $19,000 × 2 children = $38,000
    expect(giftingMetric!.value).toBe(38_000);
  });

  it("includes ILIT tax savings metric when ILIT policies exist", () => {
    const result = calculateEstate(
      makeInput({
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 12_000_000 },
        ],
        insurance: [
          {
            id: "p1",
            policyName: "ILIT",
            policyType: "whole_life",
            ownershipStructure: "ilit",
            deathBenefit: 5_000_000,
            outstandingLoanBalance: 0,
          },
        ],
      }),
    );
    const ilitMetric = result.planningMetrics.find(m => m.label === "ILIT Tax Savings");
    expect(ilitMetric).toBeDefined();
    expect(ilitMetric!.isSavings).toBe(true);
    expect(ilitMetric!.value).toBeGreaterThan(0);
  });

  it("includes LLC discount savings metric when discount is applied", () => {
    const result = calculateEstate(
      makeInput({
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 10_000_000 },
        ],
        realEstate: [
          {
            id: "re1",
            propertyName: "LLC Property",
            currentValue: 4_000_000,
            ownershipPct: 1.0,
            llcValuationDiscountPct: 0.25,
            mortgage: null,
          },
        ],
      }),
    );
    const llcMetric = result.planningMetrics.find(m => m.label === "LLC Discount Savings");
    expect(llcMetric).toBeDefined();
    expect(llcMetric!.isSavings).toBe(true);
    expect(llcMetric!.value).toBeGreaterThan(0);
  });

  it("includes portability metric for MFJ filers", () => {
    const result = calculateEstate(
      makeInput({
        profile: { ...baseProfile, filingStatus: "married_filing_jointly" },
      }),
    );
    const portabilityMetric = result.planningMetrics.find(m => m.label === "Portability (MFJ)");
    expect(portabilityMetric).toBeDefined();
  });

  it("does not include portability metric for single filers", () => {
    const result = calculateEstate(makeInput());
    const portabilityMetric = result.planningMetrics.find(m => m.label === "Portability (MFJ)");
    expect(portabilityMetric).toBeUndefined();
  });
});

// ── Beneficiary Allocations ───────────────────────────────────────────────────

describe("beneficiary allocations", () => {
  it("allocates net estate proportionally across children", () => {
    const result = calculateEstate(
      makeInput({
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 5_000_000 },
        ],
        children: [
          { id: "c1", name: "Alice", birthYear: 2000, inheritancePct: 0.6 },
          { id: "c2", name: "Bob",   birthYear: 2002, inheritancePct: 0.4 },
        ],
      }),
    );
    expect(result.beneficiaries).toHaveLength(2);
    const alice = result.beneficiaries.find(b => b.name === "Alice")!;
    const bob   = result.beneficiaries.find(b => b.name === "Bob")!;
    expect(alice.estimatedInheritance).toBeCloseTo(bob.estimatedInheritance * 1.5, -2);
  });

  it("appends unallocated row when percentages sum to less than 100%", () => {
    const result = calculateEstate(
      makeInput({
        children: [
          { id: "c1", name: "Alice", birthYear: 2000, inheritancePct: 0.6 },
        ],
      }),
    );
    const unallocated = result.beneficiaries.find(b => b.name === "Unallocated / Other");
    expect(unallocated).toBeDefined();
    expect(unallocated!.inheritancePct).toBeCloseTo(0.4, 3);
  });

  it("does not append unallocated row when percentages sum to 100%", () => {
    const result = calculateEstate(
      makeInput({
        children: [
          { id: "c1", name: "Alice", birthYear: 2000, inheritancePct: 0.5 },
          { id: "c2", name: "Bob",   birthYear: 2002, inheritancePct: 0.5 },
        ],
      }),
    );
    const unallocated = result.beneficiaries.find(b => b.name === "Unallocated / Other");
    expect(unallocated).toBeUndefined();
  });

  it("computes currentAge correctly", () => {
    const result = calculateEstate(
      makeInput({
        children: [{ id: "c1", name: "Alice", birthYear: 2001, inheritancePct: 1.0 }],
      }),
    );
    // currentYear (2026) - birthYear (2001) = 25
    expect(result.beneficiaries[0].currentAge).toBe(25);
  });
});

// ── End-to-end scenario ───────────────────────────────────────────────────────

describe("full scenario — high-net-worth single in OR", () => {
  it("produces correct totals and non-zero estate taxes", () => {
    const result = calculateEstate({
      profile: { filingStatus: "single", stateOfResidence: "OR", birthYear: 1968 },
      children: [
        { id: "c1", name: "Emma", birthYear: 1998, inheritancePct: 0.5 },
        { id: "c2", name: "Liam", birthYear: 2000, inheritancePct: 0.5 },
      ],
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage",       accountType: "taxable",          currentBalance: 8_000_000 },
        { id: "a2", accountName: "Traditional IRA", accountType: "traditional_ira",  currentBalance: 3_000_000 },
      ],
      realEstate: [
        {
          id: "re1",
          propertyName: "Portland Home",
          currentValue: 2_000_000,
          ownershipPct: 1.0,
          llcValuationDiscountPct: 0,
          mortgage: { outstandingBalance: 400_000 },
        },
      ],
      insurance: [
        {
          id: "p1",
          policyName: "WL ILIT",
          policyType: "whole_life",
          ownershipStructure: "ilit",
          deathBenefit: 5_000_000,
          outstandingLoanBalance: 0,
        },
      ],
      carry: [
        { id: "c1", fundName: "PE Fund III", expectedGrossCarry: 4_000_000, haircutPct: 0.25, realizationSchedule: [{ year: 2029, pct: 1.0 }] },
      ],
      lpInvestments: [
        { id: "lp1", fundName: "Buyout IV", currentNav: 2_000_000 },
      ],
      currentYear,
    });

    // Gross estate: 8M + 3M + 1.6M (RE net) + 3M (net carry) + 2M (LP) = 17.6M
    expect(result.grossEstate).toBe(17_600_000);
    expect(result.ilitDeathBenefit).toBe(5_000_000);

    // Federal taxable estate = grossEstate − ilitBenefit = 17.6M − 5M = 12.6M
    // Federal tax = (12.6M − 7.18M) × 40% = 5.42M × 0.40 = $2.168M
    expect(result.federalEstateTax).toBeCloseTo(2_168_000, -3);

    // Oregon state tax > 0
    expect(result.stateEstateTax).toBeGreaterThan(0);
    expect(result.totalEstateTax).toBeGreaterThan(result.federalEstateTax);

    // estateAfterTax = grossEstate − ilitBenefit − totalTax (net estate passed to heirs)
    // Actually: estateAfterTax = grossEstate − ilitBenefit − totalTax per estate-tax.ts logic
    // netEstate = grossEstate − ilitDeathBenefit − totalEstateTax
    expect(result.estateAfterTax).toBeLessThan(result.grossEstate);
    expect(result.estateAfterTax).toBeGreaterThan(0);

    // ILIT savings metric should be present and positive
    const ilitMetric = result.planningMetrics.find(m => m.label === "ILIT Tax Savings");
    expect(ilitMetric).toBeDefined();
    expect(ilitMetric!.value).toBeGreaterThan(0);

    // Two beneficiaries, no unallocated row
    expect(result.beneficiaries).toHaveLength(2);
    const totalInheritance = result.beneficiaries.reduce((s, b) => s + b.estimatedInheritance, 0);
    expect(totalInheritance).toBeCloseTo(result.estateAfterTax, -2);
  });
});
