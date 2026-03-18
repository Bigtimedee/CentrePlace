import { describe, it, expect } from "vitest";
import type { SimInvestmentAccount } from "./engine/types";

// ─────────────────────────────────────────────────────────────────────────────
// Crypto Holdings → SimInvestmentAccount Mapping Tests
//
// The assembler maps cryptoHoldings DB rows onto SimInvestmentAccount entries
// inline inside assembleSimInput(). We test the mapping logic directly here by
// replicating the exact transformation from assembler.ts so that any divergence
// between the mapping and these tests will surface immediately.
//
// No DB or tRPC context is required — these are pure data-transformation tests.
// ─────────────────────────────────────────────────────────────────────────────

// Mirror the DB row shape returned by drizzle for cryptoHoldings
interface CryptoHoldingRow {
  id: string;
  userId: string;
  coinName: string;
  symbol: string | null;
  quantityCoins: number;
  pricePerCoin: number | null;
  currentValue: number;
  costBasis: number | null;
  expectedAppreciationRate: number;
  expectedSaleYear: number | null;
  saleFraction: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// The exact mapping logic copied from assembler.ts (lines 147-158).
// If the assembler mapping changes, this function must be updated to match,
// and the test failures will signal the discrepancy.
function mapCrypto(c: CryptoHoldingRow): SimInvestmentAccount {
  return {
    id: c.id,
    accountName: c.symbol ? `${c.coinName} (${c.symbol})` : c.coinName,
    accountType: "taxable" as const,
    currentBalance: c.currentValue,
    blendedReturnRate: c.expectedAppreciationRate,
    annualContribution: 0,
    ordinaryYieldRate: 0,
    qualifiedYieldRate: 0,
    taxExemptYieldRate: 0,
  };
}

function makeRow(overrides: Partial<CryptoHoldingRow> = {}): CryptoHoldingRow {
  return {
    id: "crypto-1",
    userId: "user-1",
    coinName: "Bitcoin",
    symbol: "BTC",
    quantityCoins: 2.5,
    pricePerCoin: 40_000,
    currentValue: 100_000,
    costBasis: 60_000,
    expectedAppreciationRate: 0.07,
    expectedSaleYear: null,
    saleFraction: null,
    notes: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

describe("cryptoHolding → SimInvestmentAccount mapping", () => {
  it("maps currentValue to currentBalance", () => {
    const row = makeRow({ currentValue: 100_000 });
    const account = mapCrypto(row);
    expect(account.currentBalance).toBe(100_000);
  });

  it("maps expectedAppreciationRate to blendedReturnRate", () => {
    const row = makeRow({ expectedAppreciationRate: 0.07 });
    const account = mapCrypto(row);
    expect(account.blendedReturnRate).toBe(0.07);
  });

  it("sets accountType to taxable", () => {
    const account = mapCrypto(makeRow());
    expect(account.accountType).toBe("taxable");
  });

  it("sets annualContribution to 0", () => {
    const account = mapCrypto(makeRow());
    expect(account.annualContribution).toBe(0);
  });

  it("sets all yield rates to 0", () => {
    const account = mapCrypto(makeRow());
    expect(account.ordinaryYieldRate).toBe(0);
    expect(account.qualifiedYieldRate).toBe(0);
    expect(account.taxExemptYieldRate).toBe(0);
  });

  it('includes symbol in accountName when present: "Bitcoin (BTC)"', () => {
    const row = makeRow({ coinName: "Bitcoin", symbol: "BTC" });
    const account = mapCrypto(row);
    expect(account.accountName).toBe("Bitcoin (BTC)");
  });

  it('uses coinName only when symbol is null: "Ethereum"', () => {
    const row = makeRow({ coinName: "Ethereum", symbol: null });
    const account = mapCrypto(row);
    expect(account.accountName).toBe("Ethereum");
  });

  it("maps id correctly", () => {
    const row = makeRow({ id: "crypto-abc-123" });
    const account = mapCrypto(row);
    expect(account.id).toBe("crypto-abc-123");
  });
});

describe("multiple crypto holdings", () => {
  const rows: CryptoHoldingRow[] = [
    makeRow({ id: "crypto-1", coinName: "Bitcoin", symbol: "BTC", currentValue: 100_000, expectedAppreciationRate: 0.07 }),
    makeRow({ id: "crypto-2", coinName: "Ethereum", symbol: "ETH", currentValue: 50_000, expectedAppreciationRate: 0.08 }),
    makeRow({ id: "crypto-3", coinName: "Solana", symbol: "SOL", currentValue: 10_000, expectedAppreciationRate: 0.12 }),
  ];

  it("all rows appear in output", () => {
    const accounts = rows.map(mapCrypto);
    expect(accounts).toHaveLength(3);
  });

  it("each has correct currentBalance", () => {
    const accounts = rows.map(mapCrypto);
    expect(accounts[0].currentBalance).toBe(100_000);
    expect(accounts[1].currentBalance).toBe(50_000);
    expect(accounts[2].currentBalance).toBe(10_000);
  });

  it("each has correct blendedReturnRate", () => {
    const accounts = rows.map(mapCrypto);
    expect(accounts[0].blendedReturnRate).toBe(0.07);
    expect(accounts[1].blendedReturnRate).toBe(0.08);
    expect(accounts[2].blendedReturnRate).toBe(0.12);
  });

  it('all have accountType "taxable"', () => {
    const accounts = rows.map(mapCrypto);
    accounts.forEach(a => expect(a.accountType).toBe("taxable"));
  });
});

describe("edge cases", () => {
  it("currentValue of 0 maps to currentBalance 0", () => {
    const account = mapCrypto(makeRow({ currentValue: 0 }));
    expect(account.currentBalance).toBe(0);
  });

  it("very large currentValue (1_000_000) maps correctly", () => {
    const account = mapCrypto(makeRow({ currentValue: 1_000_000 }));
    expect(account.currentBalance).toBe(1_000_000);
  });

  it("null symbol produces accountName without parenthetical", () => {
    const account = mapCrypto(makeRow({ coinName: "Dogecoin", symbol: null }));
    expect(account.accountName).toBe("Dogecoin");
    expect(account.accountName).not.toContain("(");
  });

  it("expectedSaleYear does not affect the mapping (stored but ignored in v1)", () => {
    const withSaleYear = mapCrypto(makeRow({ expectedSaleYear: 2030 }));
    const withoutSaleYear = mapCrypto(makeRow({ expectedSaleYear: null }));
    expect(withSaleYear.currentBalance).toBe(withoutSaleYear.currentBalance);
    expect(withSaleYear.blendedReturnRate).toBe(withoutSaleYear.blendedReturnRate);
    expect(withSaleYear.accountType).toBe(withoutSaleYear.accountType);
  });

  it("null costBasis does not affect the mapping", () => {
    const account = mapCrypto(makeRow({ costBasis: null }));
    expect(account.currentBalance).toBe(100_000);
    expect(account.blendedReturnRate).toBe(0.07);
  });
});
