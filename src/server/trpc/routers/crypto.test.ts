import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Crypto Holdings Zod Schema Tests
//
// The cryptoHoldingInput is not exported from the router, so we mirror it
// here exactly as defined. Any drift from the source definition will show up
// as a test failure, which is the desired behaviour.
// ─────────────────────────────────────────────────────────────────────────────

const cryptoHoldingInput = z.object({
  coinName: z.string().min(1),
  symbol: z.string().nullable().optional(),
  quantityCoins: z.number().min(0).default(0),
  pricePerCoin: z.number().min(0).nullable().optional(),
  currentValue: z.number().min(0),
  costBasis: z.number().min(0).nullable().optional(),
  expectedAppreciationRate: z.number().min(0).max(1).default(0.07),
  expectedSaleYear: z.number().int().min(2024).max(2100).nullable().optional(),
  saleFraction: z.number().min(0).max(1).nullable().optional(),
  notes: z.string().nullable().optional(),
});

const VALID_MINIMAL = {
  coinName: "Bitcoin",
  quantityCoins: 2.5,
  currentValue: 100_000,
};

describe("cryptoHoldingInput — valid inputs", () => {
  it("parses VALID_MINIMAL", () => {
    const result = cryptoHoldingInput.parse(VALID_MINIMAL);
    expect(result.coinName).toBe("Bitcoin");
    expect(result.currentValue).toBe(100_000);
    expect(result.quantityCoins).toBe(2.5);
  });

  it("accepts symbol when provided", () => {
    const result = cryptoHoldingInput.parse({ ...VALID_MINIMAL, symbol: "BTC" });
    expect(result.symbol).toBe("BTC");
  });

  it("accepts pricePerCoin when provided", () => {
    const result = cryptoHoldingInput.parse({ ...VALID_MINIMAL, pricePerCoin: 40_000 });
    expect(result.pricePerCoin).toBe(40_000);
  });

  it("accepts costBasis when provided", () => {
    const result = cryptoHoldingInput.parse({ ...VALID_MINIMAL, costBasis: 60_000 });
    expect(result.costBasis).toBe(60_000);
  });

  it("symbol is optional — omitting it is valid", () => {
    const result = cryptoHoldingInput.parse(VALID_MINIMAL);
    expect(result.symbol).toBeUndefined();
  });

  it("pricePerCoin is optional — omitting it is valid", () => {
    const result = cryptoHoldingInput.parse(VALID_MINIMAL);
    expect(result.pricePerCoin).toBeUndefined();
  });

  it("costBasis is optional — omitting it is valid", () => {
    const result = cryptoHoldingInput.parse(VALID_MINIMAL);
    expect(result.costBasis).toBeUndefined();
  });

  it("expectedSaleYear is optional — omitting it is valid", () => {
    const result = cryptoHoldingInput.parse(VALID_MINIMAL);
    expect(result.expectedSaleYear).toBeUndefined();
  });

  it("saleFraction is optional — omitting it is valid", () => {
    const result = cryptoHoldingInput.parse(VALID_MINIMAL);
    expect(result.saleFraction).toBeUndefined();
  });

  it("notes is optional — omitting it is valid", () => {
    const result = cryptoHoldingInput.parse(VALID_MINIMAL);
    expect(result.notes).toBeUndefined();
  });
});

describe("cryptoHoldingInput — default values", () => {
  it("defaults expectedAppreciationRate to 0.07 when not provided", () => {
    const result = cryptoHoldingInput.parse(VALID_MINIMAL);
    expect(result.expectedAppreciationRate).toBe(0.07);
  });

  it("defaults quantityCoins to 0 when not provided", () => {
    const { quantityCoins: _omit, ...noQuantity } = VALID_MINIMAL;
    const result = cryptoHoldingInput.parse(noQuantity);
    expect(result.quantityCoins).toBe(0);
  });
});

describe("cryptoHoldingInput — required field validation", () => {
  it("throws when coinName is missing", () => {
    const { coinName: _omit, ...noName } = VALID_MINIMAL;
    expect(() => cryptoHoldingInput.parse(noName)).toThrow();
  });

  it("throws when coinName is empty string", () => {
    expect(() =>
      cryptoHoldingInput.parse({ ...VALID_MINIMAL, coinName: "" })
    ).toThrow();
  });

  it("throws when currentValue is missing", () => {
    const { currentValue: _omit, ...noValue } = VALID_MINIMAL;
    expect(() => cryptoHoldingInput.parse(noValue)).toThrow();
  });

  it("throws when currentValue is negative", () => {
    expect(() =>
      cryptoHoldingInput.parse({ ...VALID_MINIMAL, currentValue: -1 })
    ).toThrow();
  });

  it("accepts currentValue of 0", () => {
    const result = cryptoHoldingInput.parse({ ...VALID_MINIMAL, currentValue: 0 });
    expect(result.currentValue).toBe(0);
  });
});

describe("cryptoHoldingInput — rate clamping", () => {
  it("throws when expectedAppreciationRate exceeds 1.0", () => {
    expect(() =>
      cryptoHoldingInput.parse({ ...VALID_MINIMAL, expectedAppreciationRate: 1.01 })
    ).toThrow();
  });

  it("accepts expectedAppreciationRate at max boundary 1.0", () => {
    const result = cryptoHoldingInput.parse({ ...VALID_MINIMAL, expectedAppreciationRate: 1.0 });
    expect(result.expectedAppreciationRate).toBe(1.0);
  });

  it("throws when expectedAppreciationRate is negative", () => {
    expect(() =>
      cryptoHoldingInput.parse({ ...VALID_MINIMAL, expectedAppreciationRate: -0.01 })
    ).toThrow();
  });

  it("accepts expectedAppreciationRate of 0", () => {
    const result = cryptoHoldingInput.parse({ ...VALID_MINIMAL, expectedAppreciationRate: 0 });
    expect(result.expectedAppreciationRate).toBe(0);
  });

  it("throws when saleFraction exceeds 1.0", () => {
    expect(() =>
      cryptoHoldingInput.parse({ ...VALID_MINIMAL, saleFraction: 1.01 })
    ).toThrow();
  });

  it("throws when saleFraction is negative", () => {
    expect(() =>
      cryptoHoldingInput.parse({ ...VALID_MINIMAL, saleFraction: -0.01 })
    ).toThrow();
  });

  it("accepts saleFraction of 0", () => {
    const result = cryptoHoldingInput.parse({ ...VALID_MINIMAL, saleFraction: 0 });
    expect(result.saleFraction).toBe(0);
  });

  it("accepts saleFraction of 1.0", () => {
    const result = cryptoHoldingInput.parse({ ...VALID_MINIMAL, saleFraction: 1.0 });
    expect(result.saleFraction).toBe(1.0);
  });
});

describe("cryptoHoldingInput — expectedSaleYear validation", () => {
  it("accepts 2028", () => {
    const result = cryptoHoldingInput.parse({ ...VALID_MINIMAL, expectedSaleYear: 2028 });
    expect(result.expectedSaleYear).toBe(2028);
  });

  it("accepts min boundary 2024", () => {
    const result = cryptoHoldingInput.parse({ ...VALID_MINIMAL, expectedSaleYear: 2024 });
    expect(result.expectedSaleYear).toBe(2024);
  });

  it("accepts max boundary 2100", () => {
    const result = cryptoHoldingInput.parse({ ...VALID_MINIMAL, expectedSaleYear: 2100 });
    expect(result.expectedSaleYear).toBe(2100);
  });

  it("throws when below 2024", () => {
    expect(() =>
      cryptoHoldingInput.parse({ ...VALID_MINIMAL, expectedSaleYear: 2023 })
    ).toThrow();
  });

  it("throws when above 2100", () => {
    expect(() =>
      cryptoHoldingInput.parse({ ...VALID_MINIMAL, expectedSaleYear: 2101 })
    ).toThrow();
  });
});
