import { describe, it, expect } from "vitest";
import {
  calculateEstateTax,
  hasStateEstateTax,
  getStateEstateExemption,
  FEDERAL_EXEMPTION_2026,
} from "../estate-tax";
import type { EstateTaxInput } from "../types";

const BASE: EstateTaxInput = {
  grossEstate: 0,
  ilitDeathBenefit: 0,
  charitableDeductions: 0,
  maritalDeduction: 0,
  stateCode: "TX",
  filingStatus: "single",
  year: 2026,
};

// ─────────────────────────────────────────────────────────────────────────────
// Federal Estate Tax
// ─────────────────────────────────────────────────────────────────────────────

describe("Federal Estate Tax — 2026 post-TCJA-sunset", () => {
  it("no federal tax below single exemption (~$7.18M)", () => {
    const result = calculateEstateTax({
      ...BASE,
      grossEstate: 5_000_000,
      stateCode: "TX",
    });
    expect(result.federalEstateTax).toBe(0);
  });

  it("no federal tax exactly at exemption amount", () => {
    const result = calculateEstateTax({
      ...BASE,
      grossEstate: FEDERAL_EXEMPTION_2026,
      stateCode: "TX",
    });
    expect(result.federalEstateTax).toBe(0);
  });

  it("taxes estate above single exemption at 40%", () => {
    // $10M estate, single: taxable = 10M - 7.18M = 2.82M × 40% = $1,128,000
    const result = calculateEstateTax({
      ...BASE,
      grossEstate: 10_000_000,
      stateCode: "TX",
    });
    const expectedTax = (10_000_000 - FEDERAL_EXEMPTION_2026) * 0.40;
    expect(result.federalEstateTax).toBeCloseTo(expectedTax, 0);
  });

  it("MFJ doubles the federal exemption (portability)", () => {
    // $20M estate, MFJ: exemption = 7.18M × 2 = 14.36M; taxable = 5.64M
    const single = calculateEstateTax({
      ...BASE,
      grossEstate: 20_000_000,
      filingStatus: "single",
      stateCode: "TX",
    });
    const mfj = calculateEstateTax({
      ...BASE,
      grossEstate: 20_000_000,
      filingStatus: "married_filing_jointly",
      stateCode: "TX",
    });
    expect(mfj.federalEstateTax).toBeLessThan(single.federalEstateTax);
    // MFJ tax = (20M - 14.36M) × 40% = 5.64M × 40% = 2.256M
    expect(mfj.federalEstateTax).toBeCloseTo(
      (20_000_000 - FEDERAL_EXEMPTION_2026 * 2) * 0.40,
      0
    );
  });

  it("ILIT death benefit excluded from taxable estate", () => {
    // $15M estate, $5M in ILIT (excluded)
    // Net taxable = 10M - 7.18M = 2.82M × 40% = 1.128M
    const withIlit = calculateEstateTax({
      ...BASE,
      grossEstate: 15_000_000,
      ilitDeathBenefit: 5_000_000,
      stateCode: "TX",
    });
    const withoutIlit = calculateEstateTax({
      ...BASE,
      grossEstate: 10_000_000,
      stateCode: "TX",
    });
    expect(withIlit.federalEstateTax).toBeCloseTo(withoutIlit.federalEstateTax, 0);
  });

  it("charitable deductions reduce federal taxable estate", () => {
    const withCharity = calculateEstateTax({
      ...BASE,
      grossEstate: 15_000_000,
      charitableDeductions: 3_000_000,
      stateCode: "TX",
    });
    const withoutCharity = calculateEstateTax({
      ...BASE,
      grossEstate: 15_000_000,
      stateCode: "TX",
    });
    expect(withCharity.federalEstateTax).toBeLessThan(withoutCharity.federalEstateTax);
  });

  it("unlimited marital deduction eliminates federal estate tax", () => {
    const result = calculateEstateTax({
      ...BASE,
      grossEstate: 50_000_000,
      maritalDeduction: 50_000_000, // pass entire estate to spouse
      stateCode: "TX",
    });
    expect(result.federalEstateTax).toBe(0);
  });

  it("netEstate correctly computed", () => {
    const result = calculateEstateTax({
      ...BASE,
      grossEstate: 20_000_000,
      ilitDeathBenefit: 2_000_000,
      stateCode: "TX",
    });
    // netEstate = 20M - 2M ILIT - federal tax
    expect(result.netEstate).toBeCloseTo(
      20_000_000 - 2_000_000 - result.federalEstateTax,
      0
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// State Estate Tax
// ─────────────────────────────────────────────────────────────────────────────

describe("hasStateEstateTax", () => {
  const estateStates = ["MA", "OR", "WA", "NY", "MN", "IL", "ME", "MD", "CT", "HI", "RI", "VT", "DC"];
  const noEstateStates = ["TX", "FL", "CA", "AZ", "CO", "NV"];

  for (const state of estateStates) {
    it(`${state} has estate tax`, () => {
      expect(hasStateEstateTax(state)).toBe(true);
    });
  }

  for (const state of noEstateStates) {
    it(`${state} has NO estate tax`, () => {
      expect(hasStateEstateTax(state)).toBe(false);
    });
  }
});

describe("State estate tax — Massachusetts ($2M cliff)", () => {
  it("no MA estate tax below $2M exemption", () => {
    const result = calculateEstateTax({
      ...BASE,
      grossEstate: 1_900_000,
      stateCode: "MA",
    });
    expect(result.stateEstateTax).toBe(0);
  });

  it("MA cliff: estate above $2M taxes entire estate (not just excess)", () => {
    // $2.5M gross estate — MA taxes full $2.5M (cliff exemption)
    const result = calculateEstateTax({
      ...BASE,
      grossEstate: 2_500_000,
      stateCode: "MA",
    });
    // Full estate taxable at progressive MA rates
    // Bracket: $1M × 8% + $1M × 10% + $500k × 12% = 80k + 100k + 60k = 240k
    expect(result.stateEstateTax).toBeGreaterThan(0);
    // Just below exemption has no tax
    const below = calculateEstateTax({
      ...BASE,
      grossEstate: 1_999_999,
      stateCode: "MA",
    });
    expect(below.stateEstateTax).toBe(0);
  });
});

describe("State estate tax — Oregon ($1M low threshold)", () => {
  it("taxes estate above $1M", () => {
    const result = calculateEstateTax({
      ...BASE,
      grossEstate: 3_000_000,
      stateCode: "OR",
    });
    // Taxable = 3M - 1M = 2M at progressive OR rates
    expect(result.stateEstateTax).toBeGreaterThan(0);
  });

  it("no OR estate tax for $900k estate", () => {
    const result = calculateEstateTax({
      ...BASE,
      grossEstate: 900_000,
      stateCode: "OR",
    });
    expect(result.stateEstateTax).toBe(0);
  });
});

describe("State estate tax — Washington (20% top rate)", () => {
  it("taxes large estates up to 20%", () => {
    const result = calculateEstateTax({
      ...BASE,
      grossEstate: 20_000_000,
      stateCode: "WA",
    });
    expect(result.stateEstateTax).toBeGreaterThan(1_000_000);
  });

  it("WA exemption is ~$2.19M", () => {
    expect(getStateEstateExemption("WA")).toBeCloseTo(2_193_000, 0);
  });
});

describe("State estate tax — New York cliff", () => {
  it("NY estate within 105% of exemption gets normal treatment", () => {
    // NY exemption ≈ $7.16M; 105% = $7.518M
    const result = calculateEstateTax({
      ...BASE,
      grossEstate: 7_000_000,
      stateCode: "NY",
    });
    expect(result.stateEstateTax).toBe(0); // below exemption
  });

  it("NY estate above 105% of exemption taxes full estate (cliff)", () => {
    // $8M estate > 7.16M × 105% = 7.518M → full $8M taxable
    const result = calculateEstateTax({
      ...BASE,
      grossEstate: 8_000_000,
      stateCode: "NY",
    });
    expect(result.stateEstateTax).toBeGreaterThan(0);
  });
});

describe("Combined federal + state", () => {
  it("NY $15M estate has both federal and state tax", () => {
    const result = calculateEstateTax({
      ...BASE,
      grossEstate: 15_000_000,
      stateCode: "NY",
    });
    expect(result.federalEstateTax).toBeGreaterThan(0);
    expect(result.stateEstateTax).toBeGreaterThan(0);
    expect(result.totalEstateTax).toBe(
      result.federalEstateTax + result.stateEstateTax
    );
  });

  it("TX $15M estate has only federal estate tax", () => {
    const result = calculateEstateTax({
      ...BASE,
      grossEstate: 15_000_000,
      stateCode: "TX",
    });
    expect(result.federalEstateTax).toBeGreaterThan(0);
    expect(result.stateEstateTax).toBe(0);
  });
});
