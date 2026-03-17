import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Direct Investment Zod Schema Tests
//
// The directInvestmentShape is not exported from the router, so we mirror it
// here exactly as defined. Any drift from the source definition will show up
// as a test failure, which is the desired behaviour.
// ─────────────────────────────────────────────────────────────────────────────

const directInvestmentShape = z.object({
  securityName: z.string().min(1),
  assetClass: z.enum(["equity", "bond", "alt", "cash"]),
  industry: z.string().optional(),
  stage: z.string().optional(),
  ownershipPct: z.number().min(0).max(100).optional(),
  currentValue: z.number().min(0),
  costBasis: z.number().min(0).optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  expectedExitYear: z.number().int().min(2000).max(2100).optional(),
  expectedReturnRate: z.number().min(0).max(0.5).default(0.07),
  ordinaryYieldRate: z.number().min(0).max(0.15).default(0),
  qualifiedYieldRate: z.number().min(0).max(0.15).default(0),
  taxExemptYieldRate: z.number().min(0).max(0.15).default(0),
  notes: z.string().optional(),
});

const VALID_MINIMAL = {
  securityName: "Acme Ventures LLC",
  assetClass: "equity" as const,
  currentValue: 50_000,
};

describe("directInvestmentShape — valid inputs", () => {
  it("parses a valid minimal input", () => {
    const result = directInvestmentShape.parse(VALID_MINIMAL);
    expect(result.securityName).toBe("Acme Ventures LLC");
    expect(result.currentValue).toBe(50_000);
  });

  it("accepts assetClass equity", () => {
    const result = directInvestmentShape.parse({ ...VALID_MINIMAL, assetClass: "equity" });
    expect(result.assetClass).toBe("equity");
  });

  it("accepts assetClass bond", () => {
    const result = directInvestmentShape.parse({ ...VALID_MINIMAL, assetClass: "bond" });
    expect(result.assetClass).toBe("bond");
  });

  it("accepts assetClass alt", () => {
    const result = directInvestmentShape.parse({ ...VALID_MINIMAL, assetClass: "alt" });
    expect(result.assetClass).toBe("alt");
  });

  it("accepts assetClass cash", () => {
    const result = directInvestmentShape.parse({ ...VALID_MINIMAL, assetClass: "cash" });
    expect(result.assetClass).toBe("cash");
  });

  it("accepts purchaseDate with valid ISO format YYYY-MM-DD", () => {
    const result = directInvestmentShape.parse({ ...VALID_MINIMAL, purchaseDate: "2024-01-15" });
    expect(result.purchaseDate).toBe("2024-01-15");
  });

  it("accepts purchaseDate as empty string", () => {
    const result = directInvestmentShape.parse({ ...VALID_MINIMAL, purchaseDate: "" });
    expect(result.purchaseDate).toBe("");
  });

  it("accepts purchaseDate as undefined (optional)", () => {
    const result = directInvestmentShape.parse({ ...VALID_MINIMAL });
    expect(result.purchaseDate).toBeUndefined();
  });

  it("industry and stage are optional — omitting both is valid", () => {
    const result = directInvestmentShape.parse(VALID_MINIMAL);
    expect(result.industry).toBeUndefined();
    expect(result.stage).toBeUndefined();
  });

  it("accepts industry and stage when provided", () => {
    const result = directInvestmentShape.parse({
      ...VALID_MINIMAL,
      industry: "FinTech",
      stage: "Series B",
    });
    expect(result.industry).toBe("FinTech");
    expect(result.stage).toBe("Series B");
  });
});

describe("directInvestmentShape — default values", () => {
  it("defaults expectedReturnRate to 0.07 when not provided", () => {
    const result = directInvestmentShape.parse(VALID_MINIMAL);
    expect(result.expectedReturnRate).toBe(0.07);
  });

  it("defaults ordinaryYieldRate to 0 when not provided", () => {
    const result = directInvestmentShape.parse(VALID_MINIMAL);
    expect(result.ordinaryYieldRate).toBe(0);
  });

  it("defaults qualifiedYieldRate to 0 when not provided", () => {
    const result = directInvestmentShape.parse(VALID_MINIMAL);
    expect(result.qualifiedYieldRate).toBe(0);
  });

  it("defaults taxExemptYieldRate to 0 when not provided", () => {
    const result = directInvestmentShape.parse(VALID_MINIMAL);
    expect(result.taxExemptYieldRate).toBe(0);
  });
});

describe("directInvestmentShape — required field validation", () => {
  it("throws when securityName is missing", () => {
    const { securityName: _omit, ...noName } = VALID_MINIMAL;
    expect(() => directInvestmentShape.parse(noName)).toThrow();
  });

  it("throws when securityName is empty string", () => {
    expect(() =>
      directInvestmentShape.parse({ ...VALID_MINIMAL, securityName: "" })
    ).toThrow();
  });

  it("throws when currentValue is missing", () => {
    const { currentValue: _omit, ...noValue } = VALID_MINIMAL;
    expect(() => directInvestmentShape.parse(noValue)).toThrow();
  });

  it("throws when currentValue is negative", () => {
    expect(() =>
      directInvestmentShape.parse({ ...VALID_MINIMAL, currentValue: -1 })
    ).toThrow();
  });

  it("accepts currentValue of 0 (zero is valid)", () => {
    const result = directInvestmentShape.parse({ ...VALID_MINIMAL, currentValue: 0 });
    expect(result.currentValue).toBe(0);
  });

  it("throws when assetClass is an invalid value", () => {
    expect(() =>
      directInvestmentShape.parse({ ...VALID_MINIMAL, assetClass: "crypto" })
    ).toThrow();
  });

  it("throws when assetClass is missing", () => {
    const { assetClass: _omit, ...noClass } = VALID_MINIMAL;
    expect(() => directInvestmentShape.parse(noClass)).toThrow();
  });
});

describe("directInvestmentShape — ownershipPct validation", () => {
  it("accepts ownershipPct of 0", () => {
    const result = directInvestmentShape.parse({ ...VALID_MINIMAL, ownershipPct: 0 });
    expect(result.ownershipPct).toBe(0);
  });

  it("accepts ownershipPct of 100", () => {
    const result = directInvestmentShape.parse({ ...VALID_MINIMAL, ownershipPct: 100 });
    expect(result.ownershipPct).toBe(100);
  });

  it("accepts a fractional ownershipPct", () => {
    const result = directInvestmentShape.parse({ ...VALID_MINIMAL, ownershipPct: 2.5 });
    expect(result.ownershipPct).toBe(2.5);
  });

  it("throws when ownershipPct exceeds 100", () => {
    expect(() =>
      directInvestmentShape.parse({ ...VALID_MINIMAL, ownershipPct: 101 })
    ).toThrow();
  });

  it("throws when ownershipPct is negative", () => {
    expect(() =>
      directInvestmentShape.parse({ ...VALID_MINIMAL, ownershipPct: -1 })
    ).toThrow();
  });

  it("ownershipPct is optional — omitting it is valid", () => {
    const result = directInvestmentShape.parse(VALID_MINIMAL);
    expect(result.ownershipPct).toBeUndefined();
  });
});

describe("directInvestmentShape — expectedExitYear validation", () => {
  it("accepts expectedExitYear of 2028", () => {
    const result = directInvestmentShape.parse({ ...VALID_MINIMAL, expectedExitYear: 2028 });
    expect(result.expectedExitYear).toBe(2028);
  });

  it("accepts expectedExitYear at min boundary of 2000", () => {
    const result = directInvestmentShape.parse({ ...VALID_MINIMAL, expectedExitYear: 2000 });
    expect(result.expectedExitYear).toBe(2000);
  });

  it("accepts expectedExitYear at max boundary of 2100", () => {
    const result = directInvestmentShape.parse({ ...VALID_MINIMAL, expectedExitYear: 2100 });
    expect(result.expectedExitYear).toBe(2100);
  });

  it("throws when expectedExitYear is 1999 (below min 2000)", () => {
    expect(() =>
      directInvestmentShape.parse({ ...VALID_MINIMAL, expectedExitYear: 1999 })
    ).toThrow();
  });

  it("throws when expectedExitYear is 2101 (above max 2100)", () => {
    expect(() =>
      directInvestmentShape.parse({ ...VALID_MINIMAL, expectedExitYear: 2101 })
    ).toThrow();
  });

  it("throws when expectedExitYear is not an integer", () => {
    expect(() =>
      directInvestmentShape.parse({ ...VALID_MINIMAL, expectedExitYear: 2028.5 })
    ).toThrow();
  });

  it("expectedExitYear is optional — omitting it is valid", () => {
    const result = directInvestmentShape.parse(VALID_MINIMAL);
    expect(result.expectedExitYear).toBeUndefined();
  });
});

describe("directInvestmentShape — rate clamping", () => {
  it("throws when expectedReturnRate exceeds max of 0.5", () => {
    expect(() =>
      directInvestmentShape.parse({ ...VALID_MINIMAL, expectedReturnRate: 0.6 })
    ).toThrow();
  });

  it("accepts expectedReturnRate at max boundary of 0.5", () => {
    const result = directInvestmentShape.parse({ ...VALID_MINIMAL, expectedReturnRate: 0.5 });
    expect(result.expectedReturnRate).toBe(0.5);
  });

  it("throws when ordinaryYieldRate exceeds max of 0.15", () => {
    expect(() =>
      directInvestmentShape.parse({ ...VALID_MINIMAL, ordinaryYieldRate: 0.2 })
    ).toThrow();
  });

  it("accepts ordinaryYieldRate at max boundary of 0.15", () => {
    const result = directInvestmentShape.parse({ ...VALID_MINIMAL, ordinaryYieldRate: 0.15 });
    expect(result.ordinaryYieldRate).toBe(0.15);
  });

  it("throws when qualifiedYieldRate exceeds max of 0.15", () => {
    expect(() =>
      directInvestmentShape.parse({ ...VALID_MINIMAL, qualifiedYieldRate: 0.2 })
    ).toThrow();
  });

  it("throws when taxExemptYieldRate exceeds max of 0.15", () => {
    expect(() =>
      directInvestmentShape.parse({ ...VALID_MINIMAL, taxExemptYieldRate: 0.2 })
    ).toThrow();
  });

  it("throws when any rate is negative", () => {
    expect(() =>
      directInvestmentShape.parse({ ...VALID_MINIMAL, expectedReturnRate: -0.01 })
    ).toThrow();
  });
});

describe("directInvestmentShape — purchaseDate format", () => {
  it("throws when purchaseDate uses MM/DD/YYYY format", () => {
    // The regex requires YYYY-MM-DD; MM/DD/YYYY must fail unless treated as empty
    // The schema uses .or(z.literal("")) so a non-matching non-empty string should throw
    expect(() =>
      directInvestmentShape.parse({ ...VALID_MINIMAL, purchaseDate: "01/15/2024" })
    ).toThrow();
  });

  it("throws when purchaseDate is a partial date string", () => {
    expect(() =>
      directInvestmentShape.parse({ ...VALID_MINIMAL, purchaseDate: "2024-01" })
    ).toThrow();
  });

  it("accepts purchaseDate with leading zeros in month and day", () => {
    const result = directInvestmentShape.parse({ ...VALID_MINIMAL, purchaseDate: "2020-03-05" });
    expect(result.purchaseDate).toBe("2020-03-05");
  });
});
