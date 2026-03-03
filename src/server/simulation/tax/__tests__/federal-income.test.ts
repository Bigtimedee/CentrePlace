import { describe, it, expect } from "vitest";
import {
  calculateFederalTax,
  getMarginalOrdinaryRate,
  getMarginalLtcgRate,
} from "../federal-income";
import type { FederalTaxInput } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Federal Income Tax Tests
// All expected values calculated manually using 2026 post-TCJA-sunset brackets.
// ─────────────────────────────────────────────────────────────────────────────

const BASE: FederalTaxInput = {
  ordinaryIncome: 0,
  qualifiedDividends: 0,
  longTermGains: 0,
  unrecaptured1250Gain: 0,
  agi: 0,
  filingStatus: "single",
  year: 2026,
};

describe("calculateFederalTax — ordinary income (single)", () => {
  it("returns zero for zero income", () => {
    const result = calculateFederalTax({ ...BASE });
    expect(result.totalFederalTax).toBe(0);
    expect(result.effectiveRate).toBe(0);
  });

  it("taxes $10,000 ordinary at 10% bracket minus std deduction", () => {
    // std deduction 2026 single = $8,300
    // taxable = 10,000 - 8,300 = 1,700 → 10% = $170
    const result = calculateFederalTax({
      ...BASE,
      ordinaryIncome: 10_000,
      agi: 10_000,
    });
    expect(result.ordinaryTax).toBeCloseTo(170, 0);
  });

  it("taxes $100,000 ordinary income correctly (spans 10/15/25 brackets)", () => {
    // taxable = 100,000 - 8,300 = 91,700
    // 10%: 0–11,925 = 11,925 × 0.10 = 1,192.50
    // 15%: 11,925–48,475 = 36,550 × 0.15 = 5,482.50
    // 25%: 48,475–91,700 = 43,225 × 0.25 = 10,806.25
    // total = 17,481.25
    const result = calculateFederalTax({
      ...BASE,
      ordinaryIncome: 100_000,
      agi: 100_000,
    });
    expect(result.ordinaryTax).toBeCloseTo(17_481.25, 0);
    expect(result.ltcgTax).toBe(0);
    expect(result.niit).toBe(0);
  });

  it("taxes $500,000 ordinary income at 35% top bracket", () => {
    // taxable = 491,700
    // marginal rate should be 35%
    const result = calculateFederalTax({
      ...BASE,
      ordinaryIncome: 500_000,
      agi: 500_000,
    });
    expect(result.ordinaryTax).toBeGreaterThan(100_000);
    expect(getMarginalOrdinaryRate(491_700, "single", 2026)).toBe(0.35);
  });

  it("taxes $700,000 ordinary income at 39.6% top bracket", () => {
    const result = calculateFederalTax({
      ...BASE,
      ordinaryIncome: 700_000,
      agi: 700_000,
    });
    expect(getMarginalOrdinaryRate(691_700, "single", 2026)).toBe(0.396);
    expect(result.effectiveRate).toBeGreaterThan(0.30);
  });
});

describe("calculateFederalTax — ordinary income (married_filing_jointly)", () => {
  it("taxes $200,000 MFJ correctly", () => {
    // taxable = 200,000 - 16,600 = 183,400
    // 10%: 23,850 × 0.10 = 2,385
    // 15%: (96,950-23,850) × 0.15 = 10,965
    // 25%: (183,400-96,950) × 0.25 = 21,612.50
    // total ≈ 34,962.50
    const result = calculateFederalTax({
      ...BASE,
      ordinaryIncome: 200_000,
      agi: 200_000,
      filingStatus: "married_filing_jointly",
    });
    expect(result.ordinaryTax).toBeCloseTo(34_962.5, 0);
  });

  it("MFJ married filing jointly has higher bracket thresholds than single", () => {
    const single = calculateFederalTax({
      ...BASE,
      ordinaryIncome: 400_000,
      agi: 400_000,
      filingStatus: "single",
    });
    const mfj = calculateFederalTax({
      ...BASE,
      ordinaryIncome: 400_000,
      agi: 400_000,
      filingStatus: "married_filing_jointly",
    });
    expect(mfj.ordinaryTax).toBeLessThan(single.ordinaryTax);
  });
});

describe("calculateFederalTax — LTCG and qualified dividends", () => {
  it("applies 0% LTCG rate for low income single filer", () => {
    // ordinary = 20,000, taxable = 11,700 (< 48,350 LTCG threshold for single)
    const result = calculateFederalTax({
      ...BASE,
      ordinaryIncome: 20_000,
      longTermGains: 10_000,
      agi: 30_000,
    });
    expect(result.ltcgTax).toBe(0);
  });

  it("applies 15% LTCG rate when stacked income in 15% zone", () => {
    // ordinary = 200,000 (taxable ~191,700), LTCG = 50,000
    // stacked: 191,700 + 50,000 = 241,700 — well above 48,350 (0% limit)
    // but below 533,400 (20% limit) → 15%
    const result = calculateFederalTax({
      ...BASE,
      ordinaryIncome: 200_000,
      longTermGains: 50_000,
      agi: 250_000,
    });
    expect(result.ltcgTax).toBeCloseTo(50_000 * 0.15, 0);
  });

  it("applies 20% LTCG rate above threshold", () => {
    // ordinary = 500,000 (taxable ~491,700), LTCG = 100,000
    // LTCG stacks on 491,700:
    //   15% zone: 491,700–533,400 = 41,700 × 15% = 6,255
    //   20% zone: 100,000–41,700 = 58,300 × 20% = 11,660
    //   total LTCG tax = 17,915
    const result = calculateFederalTax({
      ...BASE,
      ordinaryIncome: 500_000,
      longTermGains: 100_000,
      agi: 600_000,
    });
    expect(result.ltcgTax).toBeCloseTo(17_915, 0);
  });

  it("qualified dividends and LTCG use same rate brackets", () => {
    const withLtcg = calculateFederalTax({
      ...BASE,
      ordinaryIncome: 200_000,
      longTermGains: 50_000,
      agi: 250_000,
    });
    const withDivs = calculateFederalTax({
      ...BASE,
      ordinaryIncome: 200_000,
      qualifiedDividends: 50_000,
      agi: 250_000,
    });
    expect(withLtcg.ltcgTax).toBeCloseTo(withDivs.ltcgTax, 0);
  });
});

describe("calculateFederalTax — NIIT (3.8%)", () => {
  it("no NIIT below threshold ($200k single)", () => {
    const result = calculateFederalTax({
      ...BASE,
      ordinaryIncome: 100_000,
      longTermGains: 50_000,
      agi: 150_000,
    });
    expect(result.niit).toBe(0);
  });

  it("applies NIIT to investment income above threshold", () => {
    // AGI = 300,000, threshold = 200,000, excess = 100,000
    // NII = LTCG 80,000 — lesser of NII (80k) vs excess (100k) = 80,000
    // NIIT = 80,000 × 3.8% = 3,040
    const result = calculateFederalTax({
      ...BASE,
      ordinaryIncome: 220_000,
      longTermGains: 80_000,
      agi: 300_000,
    });
    expect(result.niit).toBeCloseTo(3_040, 0);
  });

  it("NIIT limited to NII when excess AGI > NII", () => {
    // AGI = 500,000, threshold = 200,000, excess = 300,000
    // NII = 50,000 → lesser = 50,000
    // NIIT = 50,000 × 3.8% = 1,900
    const result = calculateFederalTax({
      ...BASE,
      ordinaryIncome: 450_000,
      longTermGains: 50_000,
      agi: 500_000,
    });
    expect(result.niit).toBeCloseTo(1_900, 0);
  });

  it("MFJ NIIT threshold is $250,000", () => {
    const result = calculateFederalTax({
      ...BASE,
      ordinaryIncome: 240_000,
      longTermGains: 30_000,
      agi: 270_000,
      filingStatus: "married_filing_jointly",
    });
    // excess = 270k - 250k = 20k; NII = 30k → lesser = 20k → 20k × 3.8% = 760
    expect(result.niit).toBeCloseTo(760, 0);
  });
});

describe("calculateFederalTax — depreciation recapture (§ 1250)", () => {
  it("taxes recapture at ordinary rate when below 25% cap", () => {
    // ordinary = 40,000, taxable = 31,700; recapture = 20,000 stacks on top
    // 15% bracket ceiling: 48,475; 31,700 is in 15% zone
    //   48,475 - 31,700 = 16,775 × 15% = 2,516.25 (still in 15% bracket)
    //   20,000 - 16,775 = 3,225 × 25% = 806.25 (spills into 25% bracket)
    //   total at ordinary rates = 3,322.50
    //   25% cap = 5,000 → actual = min(3,322.50, 5,000) = 3,322.50
    const result = calculateFederalTax({
      ...BASE,
      ordinaryIncome: 40_000,
      unrecaptured1250Gain: 20_000,
      agi: 60_000,
    });
    expect(result.depreciationRecaptureTax).toBeCloseTo(3_322.5, 0);
    // Must be below the 25% cap
    expect(result.depreciationRecaptureTax).toBeLessThan(20_000 * 0.25);
  });

  it("caps recapture tax at 25%", () => {
    // High income — ordinary rate is 35% or 39.6%; cap kicks in at 25%
    const result = calculateFederalTax({
      ...BASE,
      ordinaryIncome: 700_000,
      unrecaptured1250Gain: 100_000,
      agi: 800_000,
    });
    // max recapture = 100,000 × 25% = 25,000
    expect(result.depreciationRecaptureTax).toBeLessThanOrEqual(25_001);
    expect(result.depreciationRecaptureTax).toBeCloseTo(25_000, 0);
  });

  it("recapture is included in NIIT NII calculation", () => {
    // unrecaptured1250 is included in NII per IRC § 1411
    const result = calculateFederalTax({
      ...BASE,
      ordinaryIncome: 220_000,
      unrecaptured1250Gain: 50_000,
      agi: 270_000,
    });
    // excess AGI over 200k = 70k; NII = 50k → 50k × 3.8% = 1,900
    expect(result.niit).toBeCloseTo(1_900, 0);
  });
});

describe("getMarginalOrdinaryRate", () => {
  it("returns 10% for income in first bracket", () => {
    expect(getMarginalOrdinaryRate(5_000, "single", 2026)).toBe(0.10);
  });

  it("returns 15% in second bracket", () => {
    expect(getMarginalOrdinaryRate(30_000, "single", 2026)).toBe(0.15);
  });

  it("returns 39.6% at top", () => {
    expect(getMarginalOrdinaryRate(1_000_000, "single", 2026)).toBe(0.396);
  });
});

describe("getMarginalLtcgRate", () => {
  it("returns 0% for low income", () => {
    expect(getMarginalLtcgRate(20_000, "single", 2026)).toBe(0.00);
  });

  it("returns 15% for middle income", () => {
    expect(getMarginalLtcgRate(200_000, "single", 2026)).toBe(0.15);
  });

  it("returns 20% for high income", () => {
    expect(getMarginalLtcgRate(600_000, "single", 2026)).toBe(0.20);
  });
});
