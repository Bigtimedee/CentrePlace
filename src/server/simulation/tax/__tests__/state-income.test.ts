import { describe, it, expect } from "vitest";
import { calculateStateTax, getStateLtcgTreatment } from "../state-income";
import type { StateTaxInput } from "../types";

const BASE: StateTaxInput = {
  stateCode: "CA",
  ordinaryIncome: 0,
  longTermGains: 0,
  shortTermGains: 0,
  filingStatus: "single",
  year: 2026,
};

// ─────────────────────────────────────────────────────────────────────────────
// No-income-tax states
// ─────────────────────────────────────────────────────────────────────────────

describe("No-income-tax states", () => {
  const noTaxStates = ["FL", "TX", "NV", "WY", "SD", "AK", "TN"];

  for (const state of noTaxStates) {
    it(`${state} returns zero state tax`, () => {
      const result = calculateStateTax({
        ...BASE,
        stateCode: state,
        ordinaryIncome: 500_000,
        longTermGains: 200_000,
      });
      expect(result.stateIncomeTax).toBe(0);
      expect(result.ltcgTreatment).toBe("exempt");
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Flat-rate states
// ─────────────────────────────────────────────────────────────────────────────

describe("Flat-rate states", () => {
  it("IL taxes at 4.95% flat", () => {
    const result = calculateStateTax({
      ...BASE,
      stateCode: "IL",
      ordinaryIncome: 100_000,
    });
    expect(result.stateIncomeTax).toBeCloseTo(4_950, 0);
    expect(result.effectiveRate).toBeCloseTo(0.0495, 4);
  });

  it("CO taxes at 4.4% flat", () => {
    const result = calculateStateTax({
      ...BASE,
      stateCode: "CO",
      ordinaryIncome: 200_000,
    });
    expect(result.stateIncomeTax).toBeCloseTo(8_800, 0);
  });

  it("PA taxes at 3.07% flat", () => {
    const result = calculateStateTax({
      ...BASE,
      stateCode: "PA",
      ordinaryIncome: 150_000,
      longTermGains: 50_000,
    });
    // PA treats LTCG as ordinary: 200,000 × 3.07% = 6,140
    expect(result.stateIncomeTax).toBeCloseTo(6_140, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Progressive states — selected key states
// ─────────────────────────────────────────────────────────────────────────────

describe("California — progressive brackets", () => {
  it("taxes $500,000 single at ~9.3%+ effective rate", () => {
    const result = calculateStateTax({
      ...BASE,
      stateCode: "CA",
      ordinaryIncome: 500_000,
    });
    // CA marginal at $500k (single): 9.3% on 360,659–432,787, then 11.3%+
    expect(result.stateIncomeTax).toBeGreaterThan(40_000);
    expect(result.ltcgTreatment).toBe("ordinary");
  });

  it("CA taxes LTCG as ordinary income (no preferential treatment)", () => {
    const withGains = calculateStateTax({
      ...BASE,
      stateCode: "CA",
      ordinaryIncome: 200_000,
      longTermGains: 100_000,
    });
    const withoutGains = calculateStateTax({
      ...BASE,
      stateCode: "CA",
      ordinaryIncome: 200_000,
    });
    // LTCG taxed as ordinary — incremental CA tax on $100k at top bracket
    expect(withGains.stateIncomeTax).toBeGreaterThan(withoutGains.stateIncomeTax);
    const increment = withGains.stateIncomeTax - withoutGains.stateIncomeTax;
    // At $200k ordinary, marginal rate is 9.3%; $100k LTCG stays in 9.3% bracket (ceiling: 360,659)
    // increment = 100,000 × 9.3% = 9,300
    expect(increment).toBeCloseTo(9_300, 0);
  });

  it("CA millionaire: $1M income hits 13.3% top bracket", () => {
    const result = calculateStateTax({
      ...BASE,
      stateCode: "CA",
      ordinaryIncome: 1_100_000,
    });
    // Effective rate ~10.7% at $1.1M — marginal is 13.3% but effective is lower
    expect(result.effectiveRate).toBeGreaterThan(0.10);
    expect(result.stateIncomeTax).toBeGreaterThan(100_000);
  });
});

describe("New York — progressive brackets", () => {
  it("taxes $300,000 MFJ at correct effective rate", () => {
    const result = calculateStateTax({
      ...BASE,
      stateCode: "NY",
      ordinaryIncome: 300_000,
      filingStatus: "married_filing_jointly",
    });
    // Roughly 6% effective rate at this income level for MFJ
    expect(result.stateIncomeTax).toBeGreaterThan(15_000);
    expect(result.stateIncomeTax).toBeLessThan(30_000);
  });

  it("NY treats LTCG as ordinary income", () => {
    expect(getStateLtcgTreatment("NY").treatment).toBe("ordinary");
  });
});

describe("Texas vs California — no-tax vs high-tax comparison", () => {
  it("TX always returns zero regardless of income", () => {
    const result = calculateStateTax({
      ...BASE,
      stateCode: "TX",
      ordinaryIncome: 5_000_000,
      longTermGains: 2_000_000,
    });
    expect(result.stateIncomeTax).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LTCG preferential treatment states
// ─────────────────────────────────────────────────────────────────────────────

describe("States with preferential LTCG treatment", () => {
  it("SC excludes 44% of LTCG", () => {
    // $100k LTCG → taxable LTCG = 56,000 stacked on $200k ordinary
    const withGains = calculateStateTax({
      ...BASE,
      stateCode: "SC",
      ordinaryIncome: 200_000,
      longTermGains: 100_000,
    });
    const withoutGains = calculateStateTax({
      ...BASE,
      stateCode: "SC",
      ordinaryIncome: 200_000,
    });
    // increment should be ~56,000 × top rate, not 100,000 × top rate
    const increment = withGains.stateIncomeTax - withoutGains.stateIncomeTax;
    expect(increment).toBeLessThan(100_000 * 0.064); // less than if all taxable
    expect(increment).toBeGreaterThan(0);
  });

  it("AR excludes 50% of LTCG", () => {
    const withGains = calculateStateTax({
      ...BASE,
      stateCode: "AR",
      ordinaryIncome: 100_000,
      longTermGains: 100_000,
    });
    const withoutGains = calculateStateTax({
      ...BASE,
      stateCode: "AR",
      ordinaryIncome: 100_000,
    });
    const increment = withGains.stateIncomeTax - withoutGains.stateIncomeTax;
    // 50% excluded → taxable = 50,000 × top AR rate
    expect(increment).toBeCloseTo(50_000 * 0.044, 0);
  });

  it("ND excludes 40% of LTCG", () => {
    const withGains = calculateStateTax({
      ...BASE,
      stateCode: "ND",
      ordinaryIncome: 200_000,
      longTermGains: 100_000,
    });
    const withoutGains = calculateStateTax({
      ...BASE,
      stateCode: "ND",
      ordinaryIncome: 200_000,
    });
    const increment = withGains.stateIncomeTax - withoutGains.stateIncomeTax;
    // 40% excluded → 60,000 taxable LTCG stacks on $200k; crosses 2.45%→2.9% bracket
    // 225,975 - 200,000 = 25,975 × 2.45% + 34,025 × 2.9% ≈ 1,623
    expect(increment).toBeGreaterThan(0);
    expect(increment).toBeCloseTo(1_623, 0);
  });

  it("MA uses fixed 5% preferential LTCG rate", () => {
    const result = calculateStateTax({
      ...BASE,
      stateCode: "MA",
      ordinaryIncome: 0,
      longTermGains: 100_000,
    });
    // MA flat 5% on income; LTCG at 5% → $5,000
    expect(result.stateIncomeTax).toBeCloseTo(5_000, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("Edge cases", () => {
  it("unknown state code returns zero (graceful)", () => {
    const result = calculateStateTax({
      ...BASE,
      stateCode: "ZZ",
      ordinaryIncome: 100_000,
    });
    expect(result.stateIncomeTax).toBe(0);
  });

  it("zero income returns zero tax for all tested states", () => {
    const states = ["CA", "NY", "TX", "IL", "CO", "WA"];
    for (const state of states) {
      const result = calculateStateTax({
        ...BASE,
        stateCode: state,
        ordinaryIncome: 0,
      });
      expect(result.stateIncomeTax).toBe(0);
    }
  });

  it("handles negative income gracefully (no negative taxes)", () => {
    const result = calculateStateTax({
      ...BASE,
      stateCode: "CA",
      ordinaryIncome: -50_000,
    });
    expect(result.stateIncomeTax).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MA short-term capital gains (8.5% Part A rate)
// ─────────────────────────────────────────────────────────────────────────────

describe("MA short-term capital gains rate (8.5%)", () => {
  it("short-term gains taxed at 8.5%, not the ordinary 5% rate", () => {
    const result = calculateStateTax({
      ...BASE,
      stateCode: "MA",
      ordinaryIncome: 0,
      longTermGains: 0,
      shortTermGains: 100_000,
    });
    // 8.5% on 100k = 8,500
    expect(result.stateIncomeTax).toBeCloseTo(8_500, 0);
  });

  it("ordinary income taxed at 5%, short-term gains at 8.5% — both stack correctly", () => {
    const result = calculateStateTax({
      ...BASE,
      stateCode: "MA",
      ordinaryIncome: 100_000,
      longTermGains: 0,
      shortTermGains: 50_000,
    });
    // ordinary: 100k × 5% = 5,000; STG: 50k × 8.5% = 4,250; total = 9,250
    expect(result.stateIncomeTax).toBeCloseTo(9_250, 0);
  });

  it("LTCG still taxed at 5% (preferential rate, same as ordinary for MA)", () => {
    const result = calculateStateTax({
      ...BASE,
      stateCode: "MA",
      ordinaryIncome: 0,
      longTermGains: 100_000,
      shortTermGains: 0,
    });
    // 5% on 100k = 5,000
    expect(result.stateIncomeTax).toBeCloseTo(5_000, 0);
  });
});
