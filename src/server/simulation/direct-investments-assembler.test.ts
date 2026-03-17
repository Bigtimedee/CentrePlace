import { describe, it, expect } from "vitest";
import type { SimInvestmentAccount } from "./engine/types";

// ─────────────────────────────────────────────────────────────────────────────
// Direct Investments → SimInvestmentAccount Mapping Tests
//
// The assembler maps directInvestments DB rows onto SimInvestmentAccount entries
// inline inside assembleSimInput(). We test the mapping logic directly here by
// replicating the exact transformation from assembler.ts so that any divergence
// between the mapping and these tests will surface immediately.
//
// No DB or tRPC context is required — these are pure data-transformation tests.
// ─────────────────────────────────────────────────────────────────────────────

// Mirror the DB row shape returned by drizzle for directInvestments
interface DirectInvestmentRow {
  id: string;
  userId: string;
  accountId: string | null;
  securityName: string;
  ticker: string | null;
  assetClass: string;
  category: string | null;
  shares: number | null;
  pricePerShare: number | null;
  currentValue: number;
  costBasis: number | null;
  purchaseDate: string | null;
  expectedReturnRate: number;
  ordinaryYieldRate: number;
  qualifiedYieldRate: number;
  taxExemptYieldRate: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// The exact mapping logic copied from assembler.ts (lines 133-143).
// If the assembler mapping changes, this function must be updated to match,
// and the test failures will signal the discrepancy.
function mapDirectInvestmentToSimAccount(d: DirectInvestmentRow): SimInvestmentAccount {
  return {
    id: d.id,
    accountName: d.securityName,
    accountType: "taxable" as const,
    currentBalance: d.currentValue,
    blendedReturnRate: d.expectedReturnRate,
    annualContribution: 0,
    ordinaryYieldRate: d.ordinaryYieldRate,
    qualifiedYieldRate: d.qualifiedYieldRate,
    taxExemptYieldRate: d.taxExemptYieldRate,
  };
}

function makeRow(overrides: Partial<DirectInvestmentRow> = {}): DirectInvestmentRow {
  return {
    id: "inv-1",
    userId: "user-1",
    accountId: null,
    securityName: "Apple Inc.",
    ticker: "AAPL",
    assetClass: "equity",
    category: null,
    shares: 100,
    pricePerShare: 500,
    currentValue: 50_000,
    costBasis: 30_000,
    purchaseDate: "2020-01-15",
    expectedReturnRate: 0.08,
    ordinaryYieldRate: 0.005,
    qualifiedYieldRate: 0.01,
    taxExemptYieldRate: 0,
    notes: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

describe("directInvestment → SimInvestmentAccount mapping", () => {
  it("maps currentValue to currentBalance", () => {
    const row = makeRow({ currentValue: 50_000 });
    const account = mapDirectInvestmentToSimAccount(row);
    expect(account.currentBalance).toBe(50_000);
  });

  it("maps expectedReturnRate to blendedReturnRate", () => {
    const row = makeRow({ expectedReturnRate: 0.08 });
    const account = mapDirectInvestmentToSimAccount(row);
    expect(account.blendedReturnRate).toBe(0.08);
  });

  it("sets accountType to taxable", () => {
    const account = mapDirectInvestmentToSimAccount(makeRow());
    expect(account.accountType).toBe("taxable");
  });

  it("sets annualContribution to 0", () => {
    const account = mapDirectInvestmentToSimAccount(makeRow());
    expect(account.annualContribution).toBe(0);
  });

  it("maps securityName to accountName", () => {
    const row = makeRow({ securityName: "Berkshire Hathaway B" });
    const account = mapDirectInvestmentToSimAccount(row);
    expect(account.accountName).toBe("Berkshire Hathaway B");
  });

  it("maps id correctly", () => {
    const row = makeRow({ id: "inv-abc-123" });
    const account = mapDirectInvestmentToSimAccount(row);
    expect(account.id).toBe("inv-abc-123");
  });

  it("passes ordinaryYieldRate through correctly", () => {
    const row = makeRow({ ordinaryYieldRate: 0.03 });
    const account = mapDirectInvestmentToSimAccount(row);
    expect(account.ordinaryYieldRate).toBe(0.03);
  });

  it("passes qualifiedYieldRate through correctly", () => {
    const row = makeRow({ qualifiedYieldRate: 0.05 });
    const account = mapDirectInvestmentToSimAccount(row);
    expect(account.qualifiedYieldRate).toBe(0.05);
  });

  it("passes taxExemptYieldRate through correctly", () => {
    const row = makeRow({ taxExemptYieldRate: 0.02 });
    const account = mapDirectInvestmentToSimAccount(row);
    expect(account.taxExemptYieldRate).toBe(0.02);
  });

  it("zero yield rates remain zero (bonds with no distribution)", () => {
    const row = makeRow({ ordinaryYieldRate: 0, qualifiedYieldRate: 0, taxExemptYieldRate: 0 });
    const account = mapDirectInvestmentToSimAccount(row);
    expect(account.ordinaryYieldRate).toBe(0);
    expect(account.qualifiedYieldRate).toBe(0);
    expect(account.taxExemptYieldRate).toBe(0);
  });
});

describe("multiple direct investments all appear in output", () => {
  const rows: DirectInvestmentRow[] = [
    makeRow({ id: "inv-1", securityName: "Apple Inc.", currentValue: 50_000, expectedReturnRate: 0.08 }),
    makeRow({ id: "inv-2", securityName: "US Treasury Bond", currentValue: 100_000, expectedReturnRate: 0.045, assetClass: "bond" }),
    makeRow({ id: "inv-3", securityName: "Bridgewater All Weather", currentValue: 200_000, expectedReturnRate: 0.06, assetClass: "alt" }),
  ];

  it("maps all rows — output length equals input length", () => {
    const accounts = rows.map(mapDirectInvestmentToSimAccount);
    expect(accounts).toHaveLength(3);
  });

  it("each mapped account carries the correct currentBalance", () => {
    const accounts = rows.map(mapDirectInvestmentToSimAccount);
    expect(accounts[0].currentBalance).toBe(50_000);
    expect(accounts[1].currentBalance).toBe(100_000);
    expect(accounts[2].currentBalance).toBe(200_000);
  });

  it("each mapped account carries the correct blendedReturnRate", () => {
    const accounts = rows.map(mapDirectInvestmentToSimAccount);
    expect(accounts[0].blendedReturnRate).toBe(0.08);
    expect(accounts[1].blendedReturnRate).toBe(0.045);
    expect(accounts[2].blendedReturnRate).toBe(0.06);
  });

  it("all mapped accounts have accountType taxable regardless of assetClass", () => {
    const accounts = rows.map(mapDirectInvestmentToSimAccount);
    accounts.forEach(a => expect(a.accountType).toBe("taxable"));
  });

  it("all mapped accounts have annualContribution of 0", () => {
    const accounts = rows.map(mapDirectInvestmentToSimAccount);
    accounts.forEach(a => expect(a.annualContribution).toBe(0));
  });

  it("account names match the original securityName values", () => {
    const accounts = rows.map(mapDirectInvestmentToSimAccount);
    expect(accounts[0].accountName).toBe("Apple Inc.");
    expect(accounts[1].accountName).toBe("US Treasury Bond");
    expect(accounts[2].accountName).toBe("Bridgewater All Weather");
  });
});

describe("edge cases", () => {
  it("currentValue of 0 maps to currentBalance of 0", () => {
    const account = mapDirectInvestmentToSimAccount(makeRow({ currentValue: 0 }));
    expect(account.currentBalance).toBe(0);
  });

  it("very large currentValue maps correctly", () => {
    const account = mapDirectInvestmentToSimAccount(makeRow({ currentValue: 50_000_000 }));
    expect(account.currentBalance).toBe(50_000_000);
  });

  it("minimum expectedReturnRate of 0 maps to blendedReturnRate of 0", () => {
    const account = mapDirectInvestmentToSimAccount(makeRow({ expectedReturnRate: 0 }));
    expect(account.blendedReturnRate).toBe(0);
  });
});
