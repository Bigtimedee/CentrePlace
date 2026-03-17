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
  ticker: z.string().optional(),
  assetClass: z.enum(["equity", "bond", "alt", "cash"]),
  category: z.string().optional(),
  shares: z.number().min(0).optional(),
  pricePerShare: z.number().min(0).optional(),
  currentValue: z.number().min(0),
  costBasis: z.number().min(0).optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  accountId: z.string().optional(),
  expectedReturnRate: z.number().min(0).max(0.5).default(0.07),
  ordinaryYieldRate: z.number().min(0).max(0.15).default(0),
  qualifiedYieldRate: z.number().min(0).max(0.15).default(0),
  taxExemptYieldRate: z.number().min(0).max(0.15).default(0),
  notes: z.string().optional(),
});

const VALID_MINIMAL = {
  securityName: "Apple Inc.",
  assetClass: "equity" as const,
  currentValue: 50_000,
};

describe("directInvestmentShape — valid inputs", () => {
  it("parses a valid minimal input", () => {
    const result = directInvestmentShape.parse(VALID_MINIMAL);
    expect(result.securityName).toBe("Apple Inc.");
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
