import { describe, it, expect } from "vitest";
import {
  pvAnnuity,
  computeAnnualSpending,
  computePermanentAnnualIncome,
  computeRequiredCapital,
} from "../fi-calculator";
import type { SimRecurringExpenditure, SimRealEstateProperty } from "../types";

describe("pvAnnuity", () => {
  it("returns 0 for 0 years", () => {
    expect(pvAnnuity(100_000, 0.07, 0)).toBe(0);
  });

  it("returns 0 for 0 payment", () => {
    expect(pvAnnuity(0, 0.07, 30)).toBe(0);
  });

  it("returns pmt × n when rate is 0", () => {
    expect(pvAnnuity(50_000, 0, 20)).toBe(1_000_000);
  });

  it("computes standard 30-year annuity correctly", () => {
    // PV of $100k/yr for 30 yrs at 7%
    // 100000 × (1 − 1.07^−30) / 0.07 ≈ 1,240,904
    const pv = pvAnnuity(100_000, 0.07, 30);
    expect(pv).toBeCloseTo(1_240_904, -2);
  });

  it("higher return rate → lower required capital", () => {
    const low = pvAnnuity(100_000, 0.04, 30);
    const high = pvAnnuity(100_000, 0.09, 30);
    expect(high).toBeLessThan(low);
  });

  it("more years → higher required capital", () => {
    const short = pvAnnuity(100_000, 0.07, 20);
    const long = pvAnnuity(100_000, 0.07, 40);
    expect(long).toBeGreaterThan(short);
  });
});

describe("computeAnnualSpending", () => {
  const expenditures: SimRecurringExpenditure[] = [
    { description: "Living", annualAmount: 100_000, growthRate: 0.03 },
    { description: "Travel", annualAmount: 20_000, growthRate: 0.05 },
  ];

  it("returns base amounts when currentYear === startYear", () => {
    const total = computeAnnualSpending(expenditures, 2025, 2025);
    expect(total).toBeCloseTo(120_000, 0);
  });

  it("applies growth correctly after 5 years", () => {
    const total = computeAnnualSpending(expenditures, 2030, 2025);
    const living = 100_000 * Math.pow(1.03, 5);
    const travel = 20_000 * Math.pow(1.05, 5);
    expect(total).toBeCloseTo(living + travel, 0);
  });

  it("returns 0 with empty expenditures", () => {
    expect(computeAnnualSpending([], 2025, 2025)).toBe(0);
  });
});

describe("computePermanentAnnualIncome", () => {
  const baseProperty = (overrides: Partial<SimRealEstateProperty>): SimRealEstateProperty => ({
    id: "p1",
    propertyName: "Property",
    propertyType: "rental",
    currentValue: 1_000_000,
    purchasePrice: 600_000,
    purchaseYear: 2015,
    appreciationRate: 0.04,
    ownershipPct: 1.0,
    llcValuationDiscountPct: 0,
    annualRentalIncome: 60_000,
    annualOperatingExpenses: 15_000,
    projectedSaleYear: null,
    projectedSaleQuarter: null,
    is1031Exchange: false,
    mortgage: null,
    ...overrides,
  });

  it("includes net rental income for rental properties", () => {
    const income = computePermanentAnnualIncome([baseProperty({})]);
    expect(income).toBeCloseTo(45_000, 0); // 60k - 15k
  });

  it("includes commercial property income", () => {
    const income = computePermanentAnnualIncome([
      baseProperty({ propertyType: "commercial", annualRentalIncome: 100_000, annualOperatingExpenses: 30_000 }),
    ]);
    expect(income).toBeCloseTo(70_000, 0);
  });

  it("excludes primary residence", () => {
    const income = computePermanentAnnualIncome([baseProperty({ propertyType: "primary_residence" })]);
    expect(income).toBe(0);
  });

  it("excludes vacation property", () => {
    const income = computePermanentAnnualIncome([baseProperty({ propertyType: "vacation" })]);
    expect(income).toBe(0);
  });

  it("applies ownershipPct", () => {
    const income = computePermanentAnnualIncome([baseProperty({ ownershipPct: 0.5 })]);
    expect(income).toBeCloseTo(22_500, 0); // (60k - 15k) × 0.5
  });

  it("floors at 0 (no negative net income)", () => {
    const income = computePermanentAnnualIncome([
      baseProperty({ annualRentalIncome: 10_000, annualOperatingExpenses: 50_000 }),
    ]);
    expect(income).toBe(0);
  });
});

describe("computeRequiredCapital", () => {
  it("returns PV annuity of net need", () => {
    const req = computeRequiredCapital(200_000, 50_000, 0.07, 30);
    // Net need = 150k, PV at 7% for 30 yrs
    expect(req).toBeCloseTo(pvAnnuity(150_000, 0.07, 30), 0);
  });

  it("permanent income equal to spending → 0 required", () => {
    expect(computeRequiredCapital(100_000, 100_000, 0.07, 30)).toBe(0);
  });

  it("permanent income exceeds spending → 0 required (no negative)", () => {
    expect(computeRequiredCapital(80_000, 100_000, 0.07, 30)).toBe(0);
  });
});
