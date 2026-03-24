import { describe, it, expect } from "vitest";
import {
  allocationTargetToPolicyForm,
  REINVESTMENT_RATE_DEFAULTS,
} from "../reinvestment-policy-utils";

// ─── allocationTargetToPolicyForm ────────────────────────────────────────────

describe("allocationTargetToPolicyForm", () => {
  // ── Allocation glide-path profiles ──

  it("maps aggressive profile (80/15/5) correctly", () => {
    const result = allocationTargetToPolicyForm({ equity: 0.80, bond: 0.15, alt: 0.05 });
    expect(result.equityPct).toBe(80);
    expect(result.taxableFixedIncomePct).toBe(9);    // 0.15 * 0.6 * 100
    expect(result.taxExemptFixedIncomePct).toBe(6);  // 0.15 * 0.4 * 100
    expect(result.realEstatePct).toBe(5);
  });

  it("maps moderate profile (65/25/10) correctly", () => {
    const result = allocationTargetToPolicyForm({ equity: 0.65, bond: 0.25, alt: 0.10 });
    expect(result.equityPct).toBe(65);
    expect(result.taxableFixedIncomePct).toBe(15);   // 0.25 * 0.6 * 100
    expect(result.taxExemptFixedIncomePct).toBe(10); // 0.25 * 0.4 * 100
    expect(result.realEstatePct).toBe(10);
  });

  it("maps conservative profile (50/35/15) correctly", () => {
    const result = allocationTargetToPolicyForm({ equity: 0.50, bond: 0.35, alt: 0.15 });
    expect(result.equityPct).toBe(50);
    expect(result.taxableFixedIncomePct).toBe(21);   // 0.35 * 0.6 * 100
    expect(result.taxExemptFixedIncomePct).toBe(14); // 0.35 * 0.4 * 100
    expect(result.realEstatePct).toBe(15);
  });

  it("maps fi_achieved profile (40/45/15) correctly", () => {
    const result = allocationTargetToPolicyForm({ equity: 0.40, bond: 0.45, alt: 0.15 });
    expect(result.equityPct).toBe(40);
    expect(result.taxableFixedIncomePct).toBe(27);   // 0.45 * 0.6 * 100
    expect(result.taxExemptFixedIncomePct).toBe(18); // 0.45 * 0.4 * 100
    expect(result.realEstatePct).toBe(15);
  });

  // ── Bond split invariant ──

  it("taxable + tax-exempt always equals bond * 100", () => {
    for (const bond of [0, 0.10, 0.15, 0.25, 0.35, 0.45, 1.0]) {
      const r = allocationTargetToPolicyForm({ equity: 0, bond, alt: 0 });
      expect(r.taxableFixedIncomePct + r.taxExemptFixedIncomePct).toBeCloseTo(bond * 100, 5);
    }
  });

  it("taxable is 60% of total bond allocation", () => {
    const r = allocationTargetToPolicyForm({ equity: 0, bond: 0.30, alt: 0 });
    expect(r.taxableFixedIncomePct).toBeCloseTo(18, 5);   // 0.30 * 0.6 * 100
    expect(r.taxExemptFixedIncomePct).toBeCloseTo(12, 5); // 0.30 * 0.4 * 100
  });

  // ── Rate defaults ──

  it("preserves all REINVESTMENT_RATE_DEFAULTS", () => {
    const result = allocationTargetToPolicyForm({ equity: 0.65, bond: 0.25, alt: 0.10 });
    expect(result.equityAppreciationRate).toBe(REINVESTMENT_RATE_DEFAULTS.equityAppreciationRate);
    expect(result.equityQualifiedYieldRate).toBe(REINVESTMENT_RATE_DEFAULTS.equityQualifiedYieldRate);
    expect(result.taxableFixedIncomeRate).toBe(REINVESTMENT_RATE_DEFAULTS.taxableFixedIncomeRate);
    expect(result.taxExemptFixedIncomeRate).toBe(REINVESTMENT_RATE_DEFAULTS.taxExemptFixedIncomeRate);
    expect(result.reAppreciationRate).toBe(REINVESTMENT_RATE_DEFAULTS.reAppreciationRate);
    expect(result.reGrossYieldRate).toBe(REINVESTMENT_RATE_DEFAULTS.reGrossYieldRate);
    expect(result.reCarryingCostRate).toBe(REINVESTMENT_RATE_DEFAULTS.reCarryingCostRate);
  });

  // ── Rounding ──

  it("rounds to one decimal place", () => {
    // 0.333 * 100 = 33.3 exactly — verify no floating point drift
    const result = allocationTargetToPolicyForm({ equity: 0.333, bond: 0.334, alt: 0.333 });
    expect(result.equityPct).toBe(33.3);
    expect(result.realEstatePct).toBe(33.3);
    // bond 0.334: taxable = 0.334 * 0.6 * 100 = 20.04 → 20.0
    expect(result.taxableFixedIncomePct).toBe(20);
    // tax-exempt = 0.334 * 0.4 * 100 = 13.36 → 13.4
    expect(result.taxExemptFixedIncomePct).toBe(13.4);
  });

  it("handles zero allocations", () => {
    const result = allocationTargetToPolicyForm({ equity: 0, bond: 0, alt: 0 });
    expect(result.equityPct).toBe(0);
    expect(result.taxableFixedIncomePct).toBe(0);
    expect(result.taxExemptFixedIncomePct).toBe(0);
    expect(result.realEstatePct).toBe(0);
  });
});

// ─── REINVESTMENT_RATE_DEFAULTS ──────────────────────────────────────────────

describe("REINVESTMENT_RATE_DEFAULTS", () => {
  it("has the expected default rate values", () => {
    expect(REINVESTMENT_RATE_DEFAULTS.equityAppreciationRate).toBe(5.5);
    expect(REINVESTMENT_RATE_DEFAULTS.equityQualifiedYieldRate).toBe(1.5);
    expect(REINVESTMENT_RATE_DEFAULTS.taxableFixedIncomeRate).toBe(4);
    expect(REINVESTMENT_RATE_DEFAULTS.taxExemptFixedIncomeRate).toBe(3);
    expect(REINVESTMENT_RATE_DEFAULTS.reAppreciationRate).toBe(4);
    expect(REINVESTMENT_RATE_DEFAULTS.reGrossYieldRate).toBe(6);
    expect(REINVESTMENT_RATE_DEFAULTS.reCarryingCostRate).toBe(2);
  });
});
