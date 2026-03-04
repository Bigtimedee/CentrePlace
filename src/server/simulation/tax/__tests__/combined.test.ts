import { describe, it, expect } from "vitest";
import {
  calculateAnnualTax,
  safeHarborQuarterlyPayment,
} from "../index";

// ─────────────────────────────────────────────────────────────────────────────
// Combined Annual Tax Calculator
// ─────────────────────────────────────────────────────────────────────────────

describe("calculateAnnualTax — combined federal + state", () => {
  it("California GP partner: $400k ordinary + $500k carry", () => {
    const result = calculateAnnualTax({
      ordinaryIncome: 400_000,
      qualifiedDividends: 0,
      longTermGains: 500_000,  // GP carry at LTCG rate
      unrecaptured1250Gain: 0,
      agi: 900_000,
      filingStatus: "single",
      stateCode: "CA",
      year: 2026,
    });
    // Federal: ordinary at high bracket + 20% LTCG + NIIT
    expect(result.totalFederalTax).toBeGreaterThan(200_000);
    // CA taxes LTCG as ordinary (no preferential treatment)
    expect(result.stateIncomeTax).toBeGreaterThan(50_000);
    // Total effective rate should be substantial (CA + federal)
    expect(result.effectiveTotalRate).toBeGreaterThan(0.35);
  });

  it("Texas resident: same income has much lower total tax", () => {
    const resultCA = calculateAnnualTax({
      ordinaryIncome: 400_000,
      qualifiedDividends: 0,
      longTermGains: 500_000,
      unrecaptured1250Gain: 0,
      agi: 900_000,
      filingStatus: "single",
      stateCode: "CA",
      year: 2026,
    });
    const resultTX = calculateAnnualTax({
      ordinaryIncome: 400_000,
      qualifiedDividends: 0,
      longTermGains: 500_000,
      unrecaptured1250Gain: 0,
      agi: 900_000,
      filingStatus: "single",
      stateCode: "TX",
      year: 2026,
    });
    // TX has no state income tax
    expect(resultTX.stateIncomeTax).toBe(0);
    expect(resultTX.totalTax).toBeLessThan(resultCA.totalTax);
    // Federal tax is identical
    expect(resultTX.totalFederalTax).toBeCloseTo(resultCA.totalFederalTax, 0);
  });

  it("MFJ household with real estate income including depreciation recapture", () => {
    const result = calculateAnnualTax({
      ordinaryIncome: 250_000,
      qualifiedDividends: 30_000,
      longTermGains: 150_000,
      unrecaptured1250Gain: 80_000, // from property sale
      agi: 510_000,
      filingStatus: "married_filing_jointly",
      stateCode: "NY",
      year: 2026,
    });
    expect(result.federalDepreciationRecaptureTax).toBeGreaterThan(0);
    expect(result.federalNiit).toBeGreaterThan(0); // AGI > $250k threshold for MFJ
    expect(result.stateIncomeTax).toBeGreaterThan(0);
  });

  it("low income single with only LTCG pays 0% LTCG rate", () => {
    const result = calculateAnnualTax({
      ordinaryIncome: 0,
      qualifiedDividends: 0,
      longTermGains: 40_000,
      unrecaptured1250Gain: 0,
      agi: 40_000,
      filingStatus: "single",
      stateCode: "TX",
      year: 2026,
    });
    // LTCG stacked on 0 base; 40,000 < 48,350 → 0% federal LTCG
    // Texas has no state income tax
    expect(result.federalLtcgTax).toBe(0);
    expect(result.stateIncomeTax).toBe(0);
    // Only federal ordinary tax (but ordinary income is 0)
    expect(result.totalFederalTax).toBe(0);
  });

  it("all result fields sum correctly", () => {
    const result = calculateAnnualTax({
      ordinaryIncome: 300_000,
      qualifiedDividends: 20_000,
      longTermGains: 100_000,
      unrecaptured1250Gain: 50_000,
      agi: 470_000,
      filingStatus: "single",
      stateCode: "CO",
      year: 2026,
      w2Wages: 300_000,
    });
    const federalSum =
      result.federalOrdinaryTax +
      result.federalLtcgTax +
      result.federalNiit +
      result.federalDepreciationRecaptureTax;
    expect(federalSum).toBeCloseTo(result.totalFederalTax, 1);
    // totalFicaTax components should sum correctly
    expect(
      result.ficaSocialSecurityTax + result.ficaMedicareTax + result.ficaAdditionalMedicareTax
    ).toBeCloseTo(result.totalFicaTax, 1);
    expect(result.totalTax).toBeCloseTo(
      result.totalFederalTax + result.stateIncomeTax + result.sdiTax +
      result.cityIncomeTax + result.totalFicaTax,
      1
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Safe Harbor Quarterly Estimate
// ─────────────────────────────────────────────────────────────────────────────

describe("safeHarborQuarterlyPayment", () => {
  it("uses 100% of prior-year tax when AGI ≤ $150k", () => {
    const payment = safeHarborQuarterlyPayment(40_000, 100_000);
    expect(payment).toBeCloseTo(10_000, 0); // 40k / 4
  });

  it("uses 110% of prior-year tax when AGI > $150k", () => {
    const payment = safeHarborQuarterlyPayment(100_000, 200_000);
    expect(payment).toBeCloseTo(27_500, 0); // 100k × 1.10 / 4
  });

  it("AGI exactly at $150k uses 100% (not 110%)", () => {
    const payment = safeHarborQuarterlyPayment(60_000, 150_000);
    expect(payment).toBeCloseTo(15_000, 0); // 60k / 4
  });

  it("AGI of $150,001 uses 110%", () => {
    const payment = safeHarborQuarterlyPayment(60_000, 150_001);
    expect(payment).toBeCloseTo(16_500, 0); // 60k × 1.10 / 4
  });
});
