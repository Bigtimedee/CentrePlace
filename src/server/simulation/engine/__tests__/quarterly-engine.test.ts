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
  postFIReturnRate: 0.05,
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
  children: [],
  realizationPolicy: null,
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

  it("carry income received in specified quarter (single tranche)", () => {
    const input = minimalInput({
      carry: [{
        id: "c1",
        fundName: "Fund I",
        expectedGrossCarry: 1_000_000,
        haircutPct: 0.25,
        realizationSchedule: [{ year: 2028, quarter: "Q3", pct: 1.0 }],
      }],
    });
    const { quarters } = runSimulation(input);
    // 2028 Q3 = year offset 2, quarter Q3 = index 2 → q = 2*4+2 = 10
    expect(quarters[10].carryIncome).toBeCloseTo(750_000, 0); // 1M × 0.75
    // No carry in adjacent quarters
    expect(quarters[9].carryIncome).toBe(0);
    expect(quarters[11].carryIncome).toBe(0);
  });

  it("carry income split across multiple tranches", () => {
    const input = minimalInput({
      carry: [{
        id: "c1",
        fundName: "Fund I",
        expectedGrossCarry: 1_000_000,
        haircutPct: 0,
        realizationSchedule: [
          { year: 2027, quarter: "Q2", pct: 0.30 },
          { year: 2029, quarter: "Q4", pct: 0.70 },
        ],
      }],
    });
    const { quarters } = runSimulation(input);
    // 2027 Q2 = year offset 1, Q2 index 1 → q = 5
    expect(quarters[5].carryIncome).toBeCloseTo(300_000, 0); // 1M × 0.30
    // 2029 Q4 = year offset 3, Q4 index 3 → q = 15
    expect(quarters[15].carryIncome).toBeCloseTo(700_000, 0); // 1M × 0.70
    // No carry in other quarters
    expect(quarters[4].carryIncome).toBe(0);
    expect(quarters[6].carryIncome).toBe(0);
    expect(quarters[14].carryIncome).toBe(0);
  });

  it("W-2 income stops in the quarter after FI is first achieved", () => {
    const input = minimalInput({
      investmentAccounts: [{
        id: "a1",
        accountName: "Wealth",
        accountType: "taxable",
        currentBalance: 50_000_000,
        blendedReturnRate: 0.07,
        annualContribution: 0,
      }],
      income: { annualSalary: 400_000, annualBonus: 0, salaryGrowthRate: 0, bonusGrowthRate: 0 },
      recurringExpenditures: [{ description: "Living", annualAmount: 200_000, growthRate: 0 }],
    });
    const { quarters } = runSimulation(input);
    // $50M >> requiredCapital ($200k/0.07 ≈ $2.86M) → FI in Q1
    expect(quarters[0].isFI).toBe(true);
    // W-2 is still earned in the FI quarter itself
    expect(quarters[0].w2Income).toBeCloseTo(100_000, 0); // 400k/4
    // From Q2 onwards, user has stopped full-time employment
    expect(quarters[1].w2Income).toBe(0);
    expect(quarters[4].w2Income).toBe(0); // next year Q1 also 0
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
        realizationSchedule: [{ year: 2030, quarter: "Q4", pct: 1.0 }],
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
        realizationSchedule: [{ year: 2027, quarter: "Q2", pct: 1.0 }],
      }],
    });
    const { quarters } = runSimulation(input);
    // Before realization: q=0..4 should show unrealized carry
    expect(quarters[0].unrealizedCarry).toBeCloseTo(1_000_000, 0);
    // 2027 Q2 = q=5; after realization (q=6+) unrealized carry = 0
    expect(quarters[6].unrealizedCarry).toBe(0);
  });

  it("unrealized carry decreases partially as tranches are realized", () => {
    const input = minimalInput({
      carry: [{
        id: "c1",
        fundName: "Fund A",
        expectedGrossCarry: 1_000_000,
        haircutPct: 0,
        realizationSchedule: [
          { year: 2027, quarter: "Q2", pct: 0.30 },
          { year: 2029, quarter: "Q4", pct: 0.70 },
        ],
      }],
    });
    const { quarters } = runSimulation(input);
    // Before any realization: full 1M unrealized
    expect(quarters[0].unrealizedCarry).toBeCloseTo(1_000_000, 0);
    // After 2027 Q2 (q=6): 70% still unrealized
    expect(quarters[6].unrealizedCarry).toBeCloseTo(700_000, 0);
    // After 2029 Q4 (q=16): nothing left
    expect(quarters[16].unrealizedCarry).toBeCloseTo(0, 0);
  });
});

// ── Enhancement 1: Portfolio Yield Decomposition ──────────────────────────────

describe("runSimulation — portfolio yield decomposition", () => {
  it("ordinary yield generates quarterly ordinary income", () => {
    const input = minimalInput({
      investmentAccounts: [{
        id: "a1",
        accountName: "Bond Fund",
        accountType: "taxable",
        currentBalance: 1_000_000,
        blendedReturnRate: 0.06,
        annualContribution: 0,
        ordinaryYieldRate: 0.04, // 4% ordinary yield
        qualifiedYieldRate: 0,
        taxExemptYieldRate: 0,
      }],
    });
    const { quarters } = runSimulation(input);
    // Q1: ordinary income ≈ 1M × 4% / 4 = 10k (capital appreciates first, so slightly above)
    expect(quarters[0].portfolioYieldIncome).toBeGreaterThan(9_000);
    expect(quarters[0].portfolioYieldIncome).toBeLessThan(11_000);
  });

  it("qualified yield contributes to LTCG income in Q4 tax snapshot", () => {
    const input = minimalInput({
      investmentAccounts: [{
        id: "a1",
        accountName: "Equity Fund",
        accountType: "taxable",
        currentBalance: 1_000_000,
        blendedReturnRate: 0.08,
        annualContribution: 0,
        ordinaryYieldRate: 0,
        qualifiedYieldRate: 0.02, // 2% qualified dividend yield
        taxExemptYieldRate: 0,
      }],
    });
    const { quarters } = runSimulation(input);
    // Q4 tax snapshot should include qualified yield as LTCG income
    // Annual qualified income ≈ 1M × 2% = 20k (4 quarters of ~5k each, capital growing)
    expect(quarters[3].annualLtcgIncome).toBeGreaterThan(19_000);
    expect(quarters[3].annualLtcgIncome).toBeLessThan(23_000);
  });

  it("tax-exempt yield adds to portfolioYieldIncome but NOT to tax base", () => {
    const input = minimalInput({
      investmentAccounts: [{
        id: "a1",
        accountName: "Muni Fund",
        accountType: "taxable",
        currentBalance: 1_000_000,
        blendedReturnRate: 0.05,
        annualContribution: 0,
        ordinaryYieldRate: 0,
        qualifiedYieldRate: 0,
        taxExemptYieldRate: 0.03, // 3% tax-exempt yield
      }],
    });
    const { quarters } = runSimulation(input);
    // portfolioYieldIncome should reflect the tax-exempt yield ≈ 1M × 3% / 4 = 7.5k
    expect(quarters[0].portfolioYieldIncome).toBeGreaterThan(7_000);
    expect(quarters[0].portfolioYieldIncome).toBeLessThan(8_500);
    // Q4 ordinary income should be 0 (no ordinary/qualified yield)
    expect(quarters[3].annualOrdinaryIncome).toBeCloseTo(0, 0);
    expect(quarters[3].annualLtcgIncome).toBeCloseTo(0, 0);
  });

  it("capital grows at appreciation rate (blended minus yield), not full blended rate", () => {
    const inputWithYield = minimalInput({
      investmentAccounts: [{
        id: "a1",
        accountName: "Fund",
        accountType: "taxable",
        currentBalance: 1_000_000,
        blendedReturnRate: 0.08,
        annualContribution: 0,
        ordinaryYieldRate: 0.03,
        qualifiedYieldRate: 0,
        taxExemptYieldRate: 0,
      }],
    });
    const inputNoYield = minimalInput({
      investmentAccounts: [{
        id: "a1",
        accountName: "Fund",
        accountType: "taxable",
        currentBalance: 1_000_000,
        blendedReturnRate: 0.08,
        annualContribution: 0,
      }],
    });
    const withYield = runSimulation(inputWithYield);
    const noYield = runSimulation(inputNoYield);

    // After 1 year, capital should be lower when yield is distributed separately
    // (appreciation rate = 5% vs full 8%)
    const capitalWith = withYield.quarters[3].investmentCapital;
    const capitalWithout = noYield.quarters[3].investmentCapital;
    expect(capitalWith).toBeLessThan(capitalWithout);
  });

  it("zero yield rates preserve original capital growth behavior", () => {
    const inputOld = minimalInput({
      investmentAccounts: [{
        id: "a1",
        accountName: "Fund",
        accountType: "taxable",
        currentBalance: 1_000_000,
        blendedReturnRate: 0.08,
        annualContribution: 0,
      }],
    });
    const inputNew = minimalInput({
      investmentAccounts: [{
        id: "a1",
        accountName: "Fund",
        accountType: "taxable",
        currentBalance: 1_000_000,
        blendedReturnRate: 0.08,
        annualContribution: 0,
        ordinaryYieldRate: 0,
        qualifiedYieldRate: 0,
        taxExemptYieldRate: 0,
      }],
    });
    const old = runSimulation(inputOld);
    const newR = runSimulation(inputNew);
    // Same capital since yield rates are 0
    expect(old.quarters[3].investmentCapital).toBeCloseTo(newR.quarters[3].investmentCapital, 0);
  });
});

// ── Enhancement 2: Post-FI Glide Path ────────────────────────────────────────

describe("runSimulation — post-FI glide path", () => {
  it("capital grows more slowly after FI when postFIReturnRate < assumedReturnRate", () => {
    // Use a known FI quarter, then compare capital growth pre vs post rate switch
    const inputFast = minimalInput({
      profile: {
        ...baseProfile(),
        assumedReturnRate: 0.10,
        postFIReturnRate: 0.10, // no rate change
      },
      investmentAccounts: [{
        id: "a1",
        accountName: "Wealth",
        accountType: "taxable",
        currentBalance: 10_000_000,
        blendedReturnRate: 0.10,
        annualContribution: 0,
      }],
      recurringExpenditures: [{ description: "Living", annualAmount: 200_000, growthRate: 0 }],
    });
    const inputSlow = minimalInput({
      profile: {
        ...baseProfile(),
        assumedReturnRate: 0.10,
        postFIReturnRate: 0.04, // switch to conservative after FI
      },
      investmentAccounts: [{
        id: "a1",
        accountName: "Wealth",
        accountType: "taxable",
        currentBalance: 10_000_000,
        blendedReturnRate: 0.10,
        annualContribution: 0,
      }],
      recurringExpenditures: [{ description: "Living", annualAmount: 200_000, growthRate: 0 }],
    });

    const fast = runSimulation(inputFast);
    const slow = runSimulation(inputSlow);

    // Both are FI from Q1; after many quarters the slow one should have less capital
    const fastCapital = fast.quarters[40].totalCapital;
    const slowCapital = slow.quarters[40].totalCapital;
    expect(slowCapital).toBeLessThan(fastCapital);
  });

  it("rate switch happens at the FI quarter", () => {
    const input = minimalInput({
      profile: {
        ...baseProfile(),
        assumedReturnRate: 0.10,
        postFIReturnRate: 0.0, // switch to 0% after FI for easy verification
      },
      investmentAccounts: [{
        id: "a1",
        accountName: "Wealth",
        accountType: "taxable",
        currentBalance: 5_000_000,
        blendedReturnRate: 0.10,
        annualContribution: 0,
      }],
      recurringExpenditures: [{ description: "Living", annualAmount: 100_000, growthRate: 0 }],
    });
    const { quarters } = runSimulation(input);
    // FI in Q1 (q=0). After rate switches to 0%, capital should not grow from Q1 onward
    // (ignoring spending deductions, just check growth is near-zero)
    const q1Capital = quarters[0].investmentCapital;
    const q2Capital = quarters[1].investmentCapital;
    // With 0% appreciation: capital should be approximately equal or slightly less (after spending)
    expect(q2Capital).toBeLessThanOrEqual(q1Capital + 1); // allow tiny rounding
  });
});

// ── Enhancement 3: Realization Reinvestment Policy ───────────────────────────

const basePolicy = (): NonNullable<SimulationInput["realizationPolicy"]> => ({
  equityPct: 0.50,
  equityAppreciationRate: 0.055,
  equityQualifiedYieldRate: 0.015,
  taxableFixedIncomePct: 0.20,
  taxableFixedIncomeRate: 0.04,
  taxExemptFixedIncomePct: 0.10,
  taxExemptFixedIncomeRate: 0.03,
  realEstatePct: 0.20,
  reAppreciationRate: 0.04,
  reGrossYieldRate: 0.06,
  reCarryingCostRate: 0.02,
});

describe("runSimulation — realization reinvestment policy", () => {
  it("carry proceeds route to realizationCapital when policy is set", () => {
    const input = minimalInput({
      realizationPolicy: basePolicy(),
      carry: [{
        id: "c1",
        fundName: "Fund I",
        expectedGrossCarry: 1_000_000,
        haircutPct: 0,
        realizationSchedule: [{ year: 2026, quarter: "Q1", pct: 1.0 }],
      }],
    });
    const { quarters } = runSimulation(input);
    // Q1: 1M carry received, should appear in realizationCapital
    expect(quarters[0].realizationCapital).toBeGreaterThan(0);
  });

  it("carry proceeds go to investmentCapital when no policy", () => {
    const inputNoPolicy = minimalInput({
      realizationPolicy: null,
      investmentAccounts: [{
        id: "a1",
        accountName: "Cash",
        accountType: "taxable",
        currentBalance: 0,
        blendedReturnRate: 0,
        annualContribution: 0,
      }],
      carry: [{
        id: "c1",
        fundName: "Fund I",
        expectedGrossCarry: 1_000_000,
        haircutPct: 0,
        realizationSchedule: [{ year: 2026, quarter: "Q2", pct: 1.0 }],
      }],
    });
    const { quarters } = runSimulation(inputNoPolicy);
    // Q2 (q=1): carry goes to investmentCapital, realizationCapital stays 0
    expect(quarters[1].realizationCapital).toBe(0);
    expect(quarters[1].investmentCapital).toBeGreaterThan(900_000);
  });

  it("policy generates ordinary and qualified yield income", () => {
    const input = minimalInput({
      realizationPolicy: basePolicy(),
      carry: [{
        id: "c1",
        fundName: "Fund I",
        expectedGrossCarry: 1_000_000,
        haircutPct: 0,
        realizationSchedule: [{ year: 2026, quarter: "Q1", pct: 1.0 }],
      }],
    });
    const { quarters } = runSimulation(input);
    // By Q4 the policy should generate some taxable yield
    expect(quarters[3].annualOrdinaryIncome).toBeGreaterThan(0);
    expect(quarters[3].annualLtcgIncome).toBeGreaterThan(0);
  });

  it("deficit draw transfers from realizationCapital to cover negative investmentCapital", () => {
    // Large spending with policy capital available
    const input = minimalInput({
      realizationPolicy: basePolicy(),
      carry: [{
        id: "c1",
        fundName: "Fund I",
        expectedGrossCarry: 2_000_000,
        haircutPct: 0,
        realizationSchedule: [{ year: 2026, quarter: "Q1", pct: 1.0 }],
      }],
      oneTimeExpenditures: [{
        description: "Large purchase",
        amount: 500_000,
        projectedYear: 2026,
        projectedQuarter: "Q2",
      }],
    });
    const { quarters } = runSimulation(input);
    // investmentCapital should not go negative (deficit is drawn from realizationCapital)
    quarters.forEach(q => {
      expect(q.investmentCapital).toBeGreaterThanOrEqual(0);
    });
  });

  it("realizationCapital is included in totalCapital", () => {
    const input = minimalInput({
      realizationPolicy: basePolicy(),
      carry: [{
        id: "c1",
        fundName: "Fund I",
        expectedGrossCarry: 1_000_000,
        haircutPct: 0,
        realizationSchedule: [{ year: 2026, quarter: "Q1", pct: 1.0 }],
      }],
    });
    const { quarters } = runSimulation(input);
    // totalCapital should equal investmentCapital + realizationCapital + other buckets
    quarters.forEach(q => {
      const summed = q.investmentCapital + q.realizationCapital + q.realEstateEquity + q.insuranceCashValue + q.unrealizedCarry;
      expect(q.totalCapital).toBeCloseTo(summed, 0);
    });
  });
});

// ── Children education costs ──────────────────────────────────────────────────

describe("runSimulation — children education costs", () => {
  // startYear 2026; child born 2008 → turns 18 in 2026, college 2026–2029, grad 2030–2031
  const collegeChild = (): SimulationInput["children"][0] => ({
    name: "Alex",
    birthYear: 2008, // turns 18 in 2026 (Q1 = first college year)
    hasCollege: true,
    annualCollegeCost: 80_000,
    hasGradSchool: false,
    annualGradSchoolCost: 0,
    gradSchoolYears: 0,
  });

  it("college tuition applies in all 4 quarters of each college year", () => {
    // Child born 2008, starts college at 18 (2026), tuition applies 2026–2029
    const input = minimalInput({ children: [collegeChild()] });
    const { quarters } = runSimulation(input);

    // 2026 Q1–Q4 (q 0–3): child is 18, college active
    for (let q = 0; q < 4; q++) {
      expect(quarters[q].recurringSpending).toBeCloseTo(80_000 / 4, 0);
    }
  });

  it("college tuition ends after age 21 (stops at 22)", () => {
    const input = minimalInput({ children: [collegeChild()] });
    const { quarters } = runSimulation(input);

    // 2030 Q1 (q=16): child is 22 — college should be over
    const q2030 = quarters[16];
    expect(q2030.year).toBe(2030);
    expect(q2030.recurringSpending).toBeCloseTo(0, 0);
  });

  it("no tuition before child turns 18", () => {
    // Child born 2012 — turns 18 in 2030; sim starts 2026
    const input = minimalInput({
      children: [{
        name: "Young child",
        birthYear: 2012,
        hasCollege: true,
        annualCollegeCost: 60_000,
        hasGradSchool: false,
        annualGradSchoolCost: 0,
        gradSchoolYears: 0,
      }],
    });
    const { quarters } = runSimulation(input);

    // 2026–2029 (q 0–15): child is 14–17, no tuition yet
    for (let q = 0; q < 16; q++) {
      expect(quarters[q].recurringSpending).toBeCloseTo(0, 0);
    }

    // 2030 Q1 (q=16): child turns 18 — tuition starts
    expect(quarters[16].recurringSpending).toBeCloseTo(60_000 / 4, 0);
  });

  it("grad school costs apply after college ends", () => {
    const input = minimalInput({
      children: [{
        name: "Scholar",
        birthYear: 2008, // turns 18 in 2026, college 2026–2029, grad 2030–2031
        hasCollege: true,
        annualCollegeCost: 80_000,
        hasGradSchool: true,
        annualGradSchoolCost: 60_000,
        gradSchoolYears: 2,
      }],
    });
    const { quarters } = runSimulation(input);

    // 2030 Q1 (q=16): child is 22, grad school active
    expect(quarters[16].year).toBe(2030);
    expect(quarters[16].recurringSpending).toBeCloseTo(60_000 / 4, 0);

    // 2031 Q4 (q=23): child is 23, still in grad school
    expect(quarters[23].recurringSpending).toBeCloseTo(60_000 / 4, 0);

    // 2032 Q1 (q=24): child is 24, grad school over
    expect(quarters[24].recurringSpending).toBeCloseTo(0, 0);
  });

  it("two children with overlapping college years both deduct tuition", () => {
    const input = minimalInput({
      children: [
        {
          name: "Older",
          birthYear: 2008, // college 2026–2029
          hasCollege: true,
          annualCollegeCost: 80_000,
          hasGradSchool: false,
          annualGradSchoolCost: 0,
          gradSchoolYears: 0,
        },
        {
          name: "Younger",
          birthYear: 2010, // college 2028–2031
          hasCollege: true,
          annualCollegeCost: 70_000,
          hasGradSchool: false,
          annualGradSchoolCost: 0,
          gradSchoolYears: 0,
        },
      ],
    });
    const { quarters } = runSimulation(input);

    // 2028 Q1 (q=8): both children in college — 80k + 70k = 150k/yr = 37.5k/qtr
    expect(quarters[8].year).toBe(2028);
    expect(quarters[8].recurringSpending).toBeCloseTo(150_000 / 4, 0);
  });

  it("education costs are excluded from FI required capital (temporary costs)", () => {
    // With education costs modeled but a child who will finish college eventually,
    // required capital should be based on permanent spending only (0 here).
    const input = minimalInput({
      children: [collegeChild()],
      // No recurring expenditures — only education spending
    });
    const { quarters } = runSimulation(input);

    // requiredCapital should be 0 (no permanent spending)
    expect(quarters[0].requiredCapital).toBe(0);
  });

  it("K-12 tuition applies ages 5–17 and stops at 18", () => {
    // Child born 2014; turns 5 in 2019, turns 18 in 2032. Sim starts 2026 (child is 12).
    const input = minimalInput({
      children: [{
        name: "School-age",
        birthYear: 2014,
        annualK12Cost: 40_000,
        hasCollege: false,
        annualCollegeCost: 0,
        hasGradSchool: false,
        annualGradSchoolCost: 0,
        gradSchoolYears: 0,
      }],
    });
    const { quarters } = runSimulation(input);

    // 2026 Q1 (q=0): child is 12, K-12 active
    expect(quarters[0].recurringSpending).toBeCloseTo(40_000 / 4, 0);

    // 2031 Q4 (q=23): child is 17, still K-12
    expect(quarters[23].year).toBe(2031);
    expect(quarters[23].recurringSpending).toBeCloseTo(40_000 / 4, 0);

    // 2032 Q1 (q=24): child turns 18, K-12 ends
    expect(quarters[24].year).toBe(2032);
    expect(quarters[24].recurringSpending).toBeCloseTo(0, 0);
  });

  it("K-12 and college costs are both applied in the correct years", () => {
    // Child born 2008: K-12 up to 17 (2025, already past); college 2026–2029
    // Child born 2014: K-12 2019–2031; turns 18 in 2032
    // At sim start 2026, child born 2008 is 18 (college), child born 2014 is 12 (K-12)
    const input = minimalInput({
      children: [
        {
          name: "College-age",
          birthYear: 2008,
          annualK12Cost: 0,
          hasCollege: true,
          annualCollegeCost: 80_000,
          hasGradSchool: false,
          annualGradSchoolCost: 0,
          gradSchoolYears: 0,
        },
        {
          name: "K-12",
          birthYear: 2014,
          annualK12Cost: 40_000,
          hasCollege: false,
          annualCollegeCost: 0,
          hasGradSchool: false,
          annualGradSchoolCost: 0,
          gradSchoolYears: 0,
        },
      ],
    });
    const { quarters } = runSimulation(input);

    // 2026 Q1 (q=0): college child 18 (80k/yr) + K-12 child 12 (40k/yr) = 120k/yr
    expect(quarters[0].recurringSpending).toBeCloseTo(120_000 / 4, 0);
  });

  it("child with no tuition modeled incurs no education spending", () => {
    const input = minimalInput({
      children: [{
        name: "No tuition",
        birthYear: 2008,
        hasCollege: false,
        annualCollegeCost: 100_000,
        hasGradSchool: false,
        annualGradSchoolCost: 0,
        gradSchoolYears: 0,
      }],
    });
    const { quarters } = runSimulation(input);
    // hasCollege = false → no tuition even during college years
    expect(quarters[0].recurringSpending).toBeCloseTo(0, 0);
    expect(quarters[4].recurringSpending).toBeCloseTo(0, 0);
  });
});
