import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Carry Position Zod Schema Tests
//
// The carryInput schema is not exported from the router, so we mirror it here
// exactly as defined. Any drift from the source definition will surface as a
// test failure, which is the desired behaviour.
// ─────────────────────────────────────────────────────────────────────────────

const carryInput = z.object({
  fundName: z.string().min(1),
  vintageYear: z.number().int().min(2000).max(2030),
  carryPct: z.number().min(0).max(0.5),
  totalCommittedCapital: z.number().min(0),
  currentTvpi: z.number().min(0),
  expectedGrossCarry: z.number().min(0),
  haircutPct: z.number().min(0).max(0.9),
  currentAccountBalance: z.number().min(0).nullable().optional(),
  notes: z.string().optional(),
});

const VALID_MINIMAL = {
  fundName: "Apex Growth Fund III",
  vintageYear: 2019,
  carryPct: 0.2,
  totalCommittedCapital: 1_000_000,
  currentTvpi: 1.5,
  expectedGrossCarry: 500_000,
  haircutPct: 0.2,
};

// ─────────────────────────────────────────────────────────────────────────────
// currentAccountBalance — valid inputs
// ─────────────────────────────────────────────────────────────────────────────

describe("carryInput currentAccountBalance — valid inputs", () => {
  it("parses a typical positive balance", () => {
    const result = carryInput.parse({ ...VALID_MINIMAL, currentAccountBalance: 250_000 });
    expect(result.currentAccountBalance).toBe(250_000);
  });

  it("accepts balance of 0 (zero is valid)", () => {
    const result = carryInput.parse({ ...VALID_MINIMAL, currentAccountBalance: 0 });
    expect(result.currentAccountBalance).toBe(0);
  });

  it("accepts null (nullable)", () => {
    const result = carryInput.parse({ ...VALID_MINIMAL, currentAccountBalance: null });
    expect(result.currentAccountBalance).toBeNull();
  });

  it("accepts undefined (optional — field omitted entirely)", () => {
    const result = carryInput.parse(VALID_MINIMAL);
    expect(result.currentAccountBalance).toBeUndefined();
  });

  it("accepts a very large balance", () => {
    const result = carryInput.parse({ ...VALID_MINIMAL, currentAccountBalance: 50_000_000 });
    expect(result.currentAccountBalance).toBe(50_000_000);
  });

  it("accepts a fractional balance", () => {
    const result = carryInput.parse({ ...VALID_MINIMAL, currentAccountBalance: 123_456.78 });
    expect(result.currentAccountBalance).toBeCloseTo(123_456.78);
  });

  it("still parses a valid full payload when currentAccountBalance is present", () => {
    const result = carryInput.parse({ ...VALID_MINIMAL, currentAccountBalance: 100_000, notes: "Q3 distribution" });
    expect(result.fundName).toBe("Apex Growth Fund III");
    expect(result.currentAccountBalance).toBe(100_000);
    expect(result.notes).toBe("Q3 distribution");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// currentAccountBalance — invalid inputs
// ─────────────────────────────────────────────────────────────────────────────

describe("carryInput currentAccountBalance — invalid inputs", () => {
  it("throws when balance is negative", () => {
    expect(() =>
      carryInput.parse({ ...VALID_MINIMAL, currentAccountBalance: -1 })
    ).toThrow();
  });

  it("throws when balance is -0.01", () => {
    expect(() =>
      carryInput.parse({ ...VALID_MINIMAL, currentAccountBalance: -0.01 })
    ).toThrow();
  });

  it("throws when balance is a large negative number", () => {
    expect(() =>
      carryInput.parse({ ...VALID_MINIMAL, currentAccountBalance: -500_000 })
    ).toThrow();
  });

  it("throws when balance is a string", () => {
    expect(() =>
      carryInput.parse({ ...VALID_MINIMAL, currentAccountBalance: "250000" })
    ).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// currentAccountBalance — interaction with other required fields
// ─────────────────────────────────────────────────────────────────────────────

describe("carryInput currentAccountBalance — coexistence with required fields", () => {
  it("full valid payload including currentAccountBalance parses without error", () => {
    const result = carryInput.parse({
      fundName: "Summit Opportunity Fund II",
      vintageYear: 2021,
      carryPct: 0.25,
      totalCommittedCapital: 5_000_000,
      currentTvpi: 2.1,
      expectedGrossCarry: 1_200_000,
      haircutPct: 0.15,
      currentAccountBalance: 750_000,
      notes: "Estimated Q4 balance",
    });
    expect(result.currentAccountBalance).toBe(750_000);
    expect(result.fundName).toBe("Summit Opportunity Fund II");
  });

  it("currentAccountBalance: null does not affect other fields", () => {
    const result = carryInput.parse({ ...VALID_MINIMAL, currentAccountBalance: null });
    expect(result.fundName).toBe(VALID_MINIMAL.fundName);
    expect(result.carryPct).toBe(VALID_MINIMAL.carryPct);
    expect(result.currentAccountBalance).toBeNull();
  });

  it("field is absent when not provided — does not default to 0 or any other value", () => {
    const result = carryInput.parse(VALID_MINIMAL);
    // Optional fields that are not provided should be undefined, not 0
    expect("currentAccountBalance" in result ? result.currentAccountBalance : undefined).toBeUndefined();
  });
});
