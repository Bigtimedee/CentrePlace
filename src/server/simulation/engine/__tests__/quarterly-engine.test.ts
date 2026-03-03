import { describe, it, expect } from "vitest";
import { runSimulation } from "../quarterly-engine";
import type { SimulationInput } from "../types";

// ── Minimal test helpers ───────────────────────────────────────────────────────

const baseProfile = (): SimulationInput["profile"] => ({
  filingStatus: "single",
  stateOfResidence: "TX", // no state income tax — simpler assertions
  birthYear: 1985,
  targetAge: 90,
  assumedReturnRate: 0.07,
  safeHarborElection: true,
});

const minimalInput = (overrides: Partial<SimulationInput> = {}): SimulationInput => ({
  profile: baseProfile(),
  income: null,
  carry: [],
  lpDistributions: [],
  investmentAccounts: [],
  realEstate: [],
  insurance: [],
  recurringExpenditures: [],
  oneTimeExpenditures: [],
  startYear: 2026,
  ...overrides,
});

// ── Structure tests ───────────────────────────────────────────────────────────

describe("runSimulation — structure", () => {
  it("returns exactly 160 quarters", () => {
    const result = runSimulation(minimalInput());
    expect(result.quarters).toHaveLength(160);
  });

  it("quarter labels cycle Q1→Q4 correctly", () => {
    const { quarters } = runSimulation(minimalInput());
    expect(quarters[0].quarterLabel).toBe("Q1");
    expect(quarters[1].quarterLabel).toBe("Q2");
    expect(quarters[2].quarterLabel).toBe("Q3");
    expect(quarters[3].quarterLabel).toBe("Q4");
    expect(quarters[4].quarterLabel).toBe("Q1");
  });

  it("years advance correctly", () => {
    const { quarters } = runSimulation(minimalInput());
    expect(quarters[0].year).toBe(2026);
    expect(quarters[3].year).toBe(2026);
    expect(quarters[4].year).toBe(2027);
    expect(quarters[159].year).toBe(2065);
  });

  it("age is correct at start", () => {
    const { quarters, currentAge } = runSimulation(minimalInput());
    // birthYear 1985, startYear 2026 → age 41
    expect(currentAge).toBe(41);
    expect(quarters[0].age).toBe(41);
  });

  it("returns startYear and currentAge", () => {
    const result = runSimulation(minimalInput());
    expect(result.startYear).toBe(2026);
    expect(result.currentAge).toBe(41);
  });
});

// ── Capital growth tests ───────────────────────────────────────────────────────

describe("runSimulation — investment capital growth", () => {
  it("investment capital grows at blended return rate", () => {
    const input = minimalInput({
      investmentAccounts: [{
        id: "a1",
        accountName: "Taxable",
        accountType: "taxable",
        currentBalance: 1_000_000,
        blendedReturnRate: 0.08, // 8% annual
        annualContribution: 0,
      }],
    });
    const { quarters } = runSimulation(input);
    // After 4 quarters at 2% per quarter: 1M × 1.02^4 ≈ 1,082,432
    expect(quarters[3].investmentCapital).toBeCloseTo(1_000_000 * Math.pow(1.02, 4), -2);
  });

  it("annual contributions added at Q1", () => {
    const input = minimalInput({
      investmentAccounts: [{
        id: "a1",
        accountName: "401k",
        accountType: "traditional_401k",
        currentBalance: 500_000,
        blendedReturnRate: 0,  // 0% return to isolate contribution effect
        annualContribution: 20_000,
      }],
    });
    const { quarters } = runSimulation(input);
    // Q1: 500k contribution added + 20k → 520k
    // Q2–Q4: no contributions
    expect(quarters[0].investmentCapital).toBeCloseTo(520_000, 0);
    expect(quarters[1].investmentCapital).toBeCloseTo(520_000, 0);
    // Q5 (next Q1): another 20k contribution
    expect(quarters[4].investmentCapital).toBeCloseTo(540_000, 0);
  });

  it("zero capital stays at zero with no income or accounts", () => {
    const { quarters } = runSimulation(minimalInput());
    quarters.forEach(q => {
      expect(q.investmentCapital).toBeGreaterThanOrEqual(0);
    });
  });
});

// ── Income tests ───────────────────────────────────────────────────────────────

describe("runSimulation — income", () => {
  it("W-2 salary distributes quarterly", () => {
    const input = minimalInput({
      income: { annualSalary: 400_000, annualBonus: 0, salaryGrowthRate: 0, bonusGrowthRate: 0 },
    });
    const { quarters } = runSimulation(input);
    expect(quarters[0].w2Income).toBeCloseTo(100_000, 0);
    expect(quarters[1].w2Income).toBeCloseTo(100_000, 0);
  });

  it("bonus is paid in Q1 only", () => {
    const input = minimalInput({
      income: { annualSalary: 0, annualBonus: 100_000, salaryGrowthRate: 0, bonusGrowthRate: 0 },
    });
    const { quarters } = runSimulation(input);
    expect(quarters[0].w2Income).toBeCloseTo(100_000, 0); // Q1 bonus
    expect(quarters[1].w2Income).toBeCloseTo(0, 0);
    expect(quarters[4].w2Income).toBeCloseTo(100_000, 0); // next year Q1
  });

  it("salary grows each year", () => {
    const input = minimalInput({
      income: { annualSalary: 200_000, annualBonus: 0, salaryGrowthRate: 0.10, bonusGrowthRate: 0 },
    });
    const { quarters } = runSimulation(input);
    const q1Year0 = quarters[0].w2Income;   // 200k/4 = 50k
    const q1Year1 = quarters[4].w2Income;   // 220k/4 = 55k
    expect(q1Year0).toBeCloseTo(50_000, 0);
    expect(q1Year1).toBeCloseTo(55_000, 0);
  });

  it("carry income received in specified quarter", () => {
    const input = minimalInput({
      carry: [{
        id: "c1",
        fundName: "Fund I",
        expectedGrossCarry: 1_000_000,
        haircutPct: 0.25,
        expectedRealizationYear: 2028,
        expectedRealizationQuarter: "Q3",
      }],
    });
    const { quarters } = runSimulation(input);
    // 2028 Q3 = year offset 2, quarter Q3 = index 2 → q = 2*4+2 = 10
    expect(quarters[10].carryIncome).toBeCloseTo(750_000, 0); // 1M × 0.75
    // No carry in adjacent quarters
    expect(quarters[9].carryIncome).toBe(0);
    expect(quarters[11].carryIncome).toBe(0);
  });

  it("LP distributions arrive in correct quarter", () => {
    const input = minimalInput({
      lpDistributions: [{
        fundName: "LP Fund",
        year: 2027,
        quarter: "Q2",
        amount: 500_000,
        taxCharacter: "ltcg",
      }],
    });
    const { quarters } = runSimulation(input);
    // 2027 Q2 = year offset 1, quarter Q2 = index 1 → q = 1*4+1 = 5
    expect(quarters[5].lpIncome).toBe(500_000);
    expect(quarters[4].lpIncome).toBe(0);
    expect(quarters[6].lpIncome).toBe(0);
  });

  it("rental net income only from rental and commercial properties", () => {
    const rentalProp = {
      id: "p1",
      propertyName: "Rental",
      propertyType: "rental" as const,
      currentValue: 1_000_000,
      purchasePrice: 700_000,
      purchaseYear: 2018,
      appreciationRate: 0.04,
      ownershipPct: 1.0,
      llcValuationDiscountPct: 0,
      annualRentalIncome: 60_000,
      annualOperatingExpenses: 12_000,
      projectedSaleYear: null,
      projectedSaleQuarter: null as null,
      is1031Exchange: false,
      mortgage: null,
    };
    const primaryProp = { ...rentalProp, id: "p2", propertyType: "primary_residence" as const };

    const input = minimalInput({ realEstate: [rentalProp, primaryProp] });
    const { quarters } = runSimulation(input);
    // Rental: (60k - 12k)/4 = 12k per quarter; primary: 0
    expect(quarters[0].rentalNetIncome).toBeCloseTo(12_000, 0);
  });
});

// ── FI detection tests ────────────────────────────────────────────────────────

describe("runSimulation — FI detection", () => {
  it("detects FI when capital exceeds required", () => {
    // Huge capital, minimal spending → should be FI immediately
    const input = minimalInput({
      investmentAccounts: [{
        id: "a1",
        accountName: "Wealth",
        accountType: "taxable",
        currentBalance: 50_000_000, // $50M
        blendedReturnRate: 0.07,
        annualContribution: 0,
      }],
      recurringExpenditures: [{ description: "Living", annualAmount: 200_000, growthRate: 0.03 }],
    });
    const result = runSimulation(input);
    expect(result.fiDate).not.toBeNull();
    expect(result.fiDate?.year).toBe(2026);
    expect(result.fiDate?.quarter).toBe("Q1");
    expect(result.fiAge).toBe(41);
  });

  it("returns null fiDate when capital never reaches required", () => {
    // No capital, high spending → never FI
    const input = minimalInput({
      recurringExpenditures: [{ description: "Living", annualAmount: 500_000, growthRate: 0.03 }],
    });
    const result = runSimulation(input);
    expect(result.fiDate).toBeNull();
    expect(result.fiAge).toBeNull();
  });

  it("first FI date is sticky (not reset if capital later dips)", () => {
    const input = minimalInput({
      investmentAccounts: [{
        id: "a1",
        accountName: "Wealth",
        accountType: "taxable",
        currentBalance: 10_000_000,
        blendedReturnRate: 0.07,
        annualContribution: 0,
      }],
      recurringExpenditures: [{ description: "Living", annualAmount: 100_000, growthRate: 0.03 }],
    });
    const result = runSimulation(input);
    // Should be FI immediately and stay FI
    expect(result.fiDate?.year).toBe(2026);
    result.quarters.forEach(q => expect(q.isFI).toBe(true));
  });
});

// ── Spending tests ────────────────────────────────────────────────────────────

describe("runSimulation — spending", () => {
  it("recurring spending is distributed quarterly with inflation", () => {
    const input = minimalInput({
      recurringExpenditures: [{ description: "Living", annualAmount: 120_000, growthRate: 0.04 }],
    });
    const { quarters } = runSimulation(input);
    // Year 0: 120k/4 = 30k per quarter
    expect(quarters[0].recurringSpending).toBeCloseTo(30_000, 0);
    // Year 1: 120k × 1.04 / 4 = 31.2k
    expect(quarters[4].recurringSpending).toBeCloseTo(31_200, 0);
  });

  it("one-time spending appears in correct quarter only", () => {
    const input = minimalInput({
      oneTimeExpenditures: [{ description: "Boat", amount: 500_000, projectedYear: 2029, projectedQuarter: "Q2" }],
    });
    const { quarters } = runSimulation(input);
    // 2029 Q2 = year offset 3, Q2 = index 1 → q = 3*4+1 = 13
    expect(quarters[13].oneTimeSpending).toBe(500_000);
    expect(quarters[12].oneTimeSpending).toBe(0);
    expect(quarters[14].oneTimeSpending).toBe(0);
  });

  it("insurance premiums deducted for remaining premium years", () => {
    const input = minimalInput({
      insurance: [{
        id: "ins1",
        policyType: "term",
        ownershipStructure: "personal",
        deathBenefit: 2_000_000,
        annualPremium: 4_000,
        premiumYearsRemaining: 2, // pay for 2 years
        currentCashValue: 0,
        assumedReturnRate: 0,
        outstandingLoanBalance: 0,
        maxLoanPct: 0,
        isEstateTaxFunding: false,
      }],
    });
    const { quarters } = runSimulation(input);
    // Q1 year 0: premiums active (0 < 2)
    expect(quarters[0].insurancePremiums).toBeCloseTo(1_000, 0); // 4k/4
    // Q1 year 2: elapsed = 2, not < 2 → no premium
    expect(quarters[8].insurancePremiums).toBeCloseTo(0, 0);
  });
});

// ── Real estate tests ─────────────────────────────────────────────────────────

describe("runSimulation — real estate", () => {
  it("property equity increases with appreciation", () => {
    const input = minimalInput({
      realEstate: [{
        id: "p1",
        propertyName: "Home",
        propertyType: "primary_residence",
        currentValue: 2_000_000,
        purchasePrice: 1_200_000,
        purchaseYear: 2015,
        appreciationRate: 0.04,
        ownershipPct: 1.0,
        llcValuationDiscountPct: 0,
        annualRentalIncome: 0,
        annualOperatingExpenses: 0,
        projectedSaleYear: null,
        projectedSaleQuarter: null,
        is1031Exchange: false,
        mortgage: null,
      }],
    });
    const { quarters } = runSimulation(input);
    // Equity at Q4 = 2M × (1.01)^4 ≈ 2,081,208
    expect(quarters[3].realEstateEquity).toBeGreaterThan(2_000_000);
  });

  it("mortgage reduces real estate equity", () => {
    const input = minimalInput({
      realEstate: [{
        id: "p1",
        propertyName: "Home",
        propertyType: "primary_residence",
        currentValue: 1_000_000,
        purchasePrice: 800_000,
        purchaseYear: 2010,
        appreciationRate: 0,
        ownershipPct: 1.0,
        llcValuationDiscountPct: 0,
        annualRentalIncome: 0,
        annualOperatingExpenses: 0,
        projectedSaleYear: null,
        projectedSaleQuarter: null,
        is1031Exchange: false,
        mortgage: { outstandingBalance: 600_000, interestRate: 0.065, remainingTermMonths: 240 },
      }],
    });
    const { quarters } = runSimulation(input);
    // Equity = 1M − (600k − principal paid in 3 months) ≈ 403.7k at Q1
    expect(quarters[0].realEstateEquity).toBeGreaterThan(400_000);
    expect(quarters[0].realEstateEquity).toBeLessThan(410_000);
    // Equity increases each quarter as mortgage is paid down
    expect(quarters[3].realEstateEquity).toBeGreaterThan(quarters[0].realEstateEquity);
  });

  it("property sale adds net proceeds to investmentCapital", () => {
    const input = minimalInput({
      investmentAccounts: [{
        id: "a1",
        accountName: "Cash",
        accountType: "taxable",
        currentBalance: 0,
        blendedReturnRate: 0,
        annualContribution: 0,
      }],
      realEstate: [{
        id: "p1",
        propertyName: "Sale Property",
        propertyType: "rental",
        currentValue: 2_000_000,
        purchasePrice: 1_000_000,
        purchaseYear: 2010,
        appreciationRate: 0,
        ownershipPct: 1.0,
        llcValuationDiscountPct: 0,
        annualRentalIncome: 0,
        annualOperatingExpenses: 0,
        projectedSaleYear: 2028,
        projectedSaleQuarter: "Q1",
        is1031Exchange: false,
        mortgage: null,
      }],
    });
    const { quarters } = runSimulation(input);
    // 2028 Q1 = q = 2*4+0 = 8
    // Before sale (q=7): investmentCapital ≈ 0
    expect(quarters[7].investmentCapital).toBeCloseTo(0, -2);
    // After sale (q=8): investmentCapital jumps by ~2M
    expect(quarters[8].investmentCapital).toBeGreaterThan(1_500_000);
    // Property equity should be 0 after sale
    expect(quarters[8].realEstateEquity).toBeCloseTo(0, 0);
  });
});

// ── Summary tests ─────────────────────────────────────────────────────────────

describe("runSimulation — summary", () => {
  it("gapToFI is negative when already FI (have more than needed)", () => {
    const input = minimalInput({
      investmentAccounts: [{
        id: "a1",
        accountName: "Wealth",
        accountType: "taxable",
        currentBalance: 50_000_000,
        blendedReturnRate: 0.07,
        annualContribution: 0,
      }],
      recurringExpenditures: [{ description: "Living", annualAmount: 300_000, growthRate: 0.03 }],
    });
    const { summary } = runSimulation(input);
    expect(summary.gapToFI).toBeLessThan(0);
  });

  it("projectedAnnualSpending equals sum of recurring expenditures at start", () => {
    const input = minimalInput({
      recurringExpenditures: [
        { description: "Living", annualAmount: 150_000, growthRate: 0.03 },
        { description: "Travel", annualAmount: 50_000, growthRate: 0.05 },
      ],
    });
    const { summary } = runSimulation(input);
    expect(summary.projectedAnnualSpending).toBeCloseTo(200_000, 0);
  });

  it("permanentAnnualIncome reflects rental net income", () => {
    const input = minimalInput({
      realEstate: [{
        id: "p1",
        propertyName: "Rental",
        propertyType: "rental",
        currentValue: 1_000_000,
        purchasePrice: 700_000,
        purchaseYear: 2018,
        appreciationRate: 0.04,
        ownershipPct: 0.8,
        llcValuationDiscountPct: 0,
        annualRentalIncome: 80_000,
        annualOperatingExpenses: 20_000,
        projectedSaleYear: null,
        projectedSaleQuarter: null,
        is1031Exchange: false,
        mortgage: null,
      }],
    });
    const { summary } = runSimulation(input);
    // (80k - 20k) × 0.8 = 48k
    expect(summary.permanentAnnualIncome).toBeCloseTo(48_000, 0);
  });
});

// ── Unrealized carry tests ────────────────────────────────────────────────────

describe("runSimulation — unrealized carry", () => {
  it("carry is unrealized before realization date", () => {
    const input = minimalInput({
      carry: [{
        id: "c1",
        fundName: "Fund A",
        expectedGrossCarry: 2_000_000,
        haircutPct: 0.20,
        expectedRealizationYear: 2030,
        expectedRealizationQuarter: "Q4",
      }],
    });
    const { quarters } = runSimulation(input);
    // In 2026: net carry = 2M × 0.8 = 1.6M should be in unrealizedCarry
    expect(quarters[0].unrealizedCarry).toBeCloseTo(1_600_000, 0);
  });

  it("carry drops from unrealized after realization quarter", () => {
    const input = minimalInput({
      carry: [{
        id: "c1",
        fundName: "Fund A",
        expectedGrossCarry: 1_000_000,
        haircutPct: 0,
        expectedRealizationYear: 2027,
        expectedRealizationQuarter: "Q2",
      }],
    });
    const { quarters } = runSimulation(input);
    // Before realization: q=0..4 should show unrealized carry
    expect(quarters[0].unrealizedCarry).toBeCloseTo(1_000_000, 0);
    // 2027 Q2 = q=5; after realization (q=6+) unrealized carry = 0
    expect(quarters[6].unrealizedCarry).toBe(0);
  });
});
