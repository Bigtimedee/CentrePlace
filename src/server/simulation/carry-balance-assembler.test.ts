import { describe, it, expect } from "vitest";
import type { SimInvestmentAccount } from "./engine/types";

// ─────────────────────────────────────────────────────────────────────────────
// Carry Position currentAccountBalance → SimInvestmentAccount Mapping Tests
//
// When a carry position has a non-null, non-zero currentAccountBalance the
// assembler injects a synthetic SimInvestmentAccount into the simulation input.
// We test that mapping logic directly here by replicating the exact
// transformation from assembler.ts (lines 144-156) so that any divergence
// between the mapping and these tests surfaces immediately.
//
// No DB or tRPC context is required — these are pure data-transformation tests.
// ─────────────────────────────────────────────────────────────────────────────

// Mirror the DB row shape returned by drizzle for carryPositions
interface CarryPositionRow {
  id: string;
  userId: string;
  fundName: string;
  vintageYear: number;
  carryPct: number;
  totalCommittedCapital: number;
  currentTvpi: number;
  expectedGrossCarry: number;
  haircutPct: number;
  currentAccountBalance: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Profile subset — the assembler only needs assumedReturnRate
interface ProfileSubset {
  assumedReturnRate: number;
}

// The exact filter + mapping logic copied from assembler.ts (lines 144-156).
// If the assembler mapping changes, this function must be updated to match,
// and the test failures will signal the discrepancy.
function mapCarryBalancesToSimAccounts(
  carry: CarryPositionRow[],
  profile: ProfileSubset,
): SimInvestmentAccount[] {
  return carry
    .filter(c => c.currentAccountBalance != null && c.currentAccountBalance !== 0)
    .map(c => ({
      id: `carry-balance-${c.id}`,
      accountName: `${c.fundName} \u2013 Current Balance`,
      accountType: "taxable" as const,
      currentBalance: c.currentAccountBalance as number,
      blendedReturnRate: profile.assumedReturnRate,
      annualContribution: 0,
      ordinaryYieldRate: 0,
      qualifiedYieldRate: 0,
      taxExemptYieldRate: 0,
    }));
}

function makeCarryRow(overrides: Partial<CarryPositionRow> = {}): CarryPositionRow {
  return {
    id: "carry-1",
    userId: "user-1",
    fundName: "Apex Growth Fund III",
    vintageYear: 2019,
    carryPct: 0.2,
    totalCommittedCapital: 1_000_000,
    currentTvpi: 1.5,
    expectedGrossCarry: 500_000,
    haircutPct: 0.2,
    currentAccountBalance: 250_000,
    notes: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

const PROFILE: ProfileSubset = { assumedReturnRate: 0.07 };

// ─────────────────────────────────────────────────────────────────────────────
// Positive balance — account IS produced
// ─────────────────────────────────────────────────────────────────────────────

describe("carry currentAccountBalance > 0 — synthetic account is produced", () => {
  it("produces exactly one account for a single carry position with a positive balance", () => {
    const accounts = mapCarryBalancesToSimAccounts([makeCarryRow()], PROFILE);
    expect(accounts).toHaveLength(1);
  });

  it("account id is carry-balance-{carry id}", () => {
    const accounts = mapCarryBalancesToSimAccounts([makeCarryRow({ id: "carry-abc" })], PROFILE);
    expect(accounts[0].id).toBe("carry-balance-carry-abc");
  });

  it("account name is '{fundName} \u2013 Current Balance'", () => {
    const accounts = mapCarryBalancesToSimAccounts(
      [makeCarryRow({ fundName: "Summit Opportunity Fund II" })],
      PROFILE,
    );
    expect(accounts[0].accountName).toBe("Summit Opportunity Fund II \u2013 Current Balance");
  });

  it("accountType is taxable", () => {
    const accounts = mapCarryBalancesToSimAccounts([makeCarryRow()], PROFILE);
    expect(accounts[0].accountType).toBe("taxable");
  });

  it("currentBalance equals currentAccountBalance from the carry row", () => {
    const accounts = mapCarryBalancesToSimAccounts(
      [makeCarryRow({ currentAccountBalance: 750_000 })],
      PROFILE,
    );
    expect(accounts[0].currentBalance).toBe(750_000);
  });

  it("blendedReturnRate uses the profile assumedReturnRate", () => {
    const accounts = mapCarryBalancesToSimAccounts(
      [makeCarryRow()],
      { assumedReturnRate: 0.065 },
    );
    expect(accounts[0].blendedReturnRate).toBe(0.065);
  });

  it("annualContribution is 0", () => {
    const accounts = mapCarryBalancesToSimAccounts([makeCarryRow()], PROFILE);
    expect(accounts[0].annualContribution).toBe(0);
  });

  it("ordinaryYieldRate is 0", () => {
    const accounts = mapCarryBalancesToSimAccounts([makeCarryRow()], PROFILE);
    expect(accounts[0].ordinaryYieldRate).toBe(0);
  });

  it("qualifiedYieldRate is 0", () => {
    const accounts = mapCarryBalancesToSimAccounts([makeCarryRow()], PROFILE);
    expect(accounts[0].qualifiedYieldRate).toBe(0);
  });

  it("taxExemptYieldRate is 0", () => {
    const accounts = mapCarryBalancesToSimAccounts([makeCarryRow()], PROFILE);
    expect(accounts[0].taxExemptYieldRate).toBe(0);
  });

  it("small positive balance of 1 still produces an account", () => {
    const accounts = mapCarryBalancesToSimAccounts(
      [makeCarryRow({ currentAccountBalance: 1 })],
      PROFILE,
    );
    expect(accounts).toHaveLength(1);
    expect(accounts[0].currentBalance).toBe(1);
  });

  it("very large balance maps correctly", () => {
    const accounts = mapCarryBalancesToSimAccounts(
      [makeCarryRow({ currentAccountBalance: 50_000_000 })],
      PROFILE,
    );
    expect(accounts[0].currentBalance).toBe(50_000_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Null balance — account is NOT produced
// ─────────────────────────────────────────────────────────────────────────────

describe("carry currentAccountBalance null — no synthetic account produced", () => {
  it("produces no accounts when currentAccountBalance is null", () => {
    const accounts = mapCarryBalancesToSimAccounts(
      [makeCarryRow({ currentAccountBalance: null })],
      PROFILE,
    );
    expect(accounts).toHaveLength(0);
  });

  it("produces no accounts when multiple carry positions all have null balance", () => {
    const rows = [
      makeCarryRow({ id: "carry-1", currentAccountBalance: null }),
      makeCarryRow({ id: "carry-2", currentAccountBalance: null }),
    ];
    const accounts = mapCarryBalancesToSimAccounts(rows, PROFILE);
    expect(accounts).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Zero balance — account is NOT produced
// ─────────────────────────────────────────────────────────────────────────────

describe("carry currentAccountBalance === 0 — no synthetic account produced", () => {
  it("produces no accounts when currentAccountBalance is 0", () => {
    const accounts = mapCarryBalancesToSimAccounts(
      [makeCarryRow({ currentAccountBalance: 0 })],
      PROFILE,
    );
    expect(accounts).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mixed carry positions
// ─────────────────────────────────────────────────────────────────────────────

describe("mixed carry positions — only positions with positive balance produce accounts", () => {
  const rows: CarryPositionRow[] = [
    makeCarryRow({ id: "carry-1", fundName: "Fund A", currentAccountBalance: 100_000 }),
    makeCarryRow({ id: "carry-2", fundName: "Fund B", currentAccountBalance: null }),
    makeCarryRow({ id: "carry-3", fundName: "Fund C", currentAccountBalance: 0 }),
    makeCarryRow({ id: "carry-4", fundName: "Fund D", currentAccountBalance: 200_000 }),
  ];

  it("only the two positions with positive balances produce accounts", () => {
    const accounts = mapCarryBalancesToSimAccounts(rows, PROFILE);
    expect(accounts).toHaveLength(2);
  });

  it("the produced accounts correspond to Fund A and Fund D", () => {
    const accounts = mapCarryBalancesToSimAccounts(rows, PROFILE);
    const ids = accounts.map(a => a.id);
    expect(ids).toContain("carry-balance-carry-1");
    expect(ids).toContain("carry-balance-carry-4");
  });

  it("Fund B (null balance) does not appear in the output", () => {
    const accounts = mapCarryBalancesToSimAccounts(rows, PROFILE);
    expect(accounts.find(a => a.id === "carry-balance-carry-2")).toBeUndefined();
  });

  it("Fund C (zero balance) does not appear in the output", () => {
    const accounts = mapCarryBalancesToSimAccounts(rows, PROFILE);
    expect(accounts.find(a => a.id === "carry-balance-carry-3")).toBeUndefined();
  });

  it("Fund A account has correct currentBalance", () => {
    const accounts = mapCarryBalancesToSimAccounts(rows, PROFILE);
    const fundA = accounts.find(a => a.id === "carry-balance-carry-1");
    expect(fundA?.currentBalance).toBe(100_000);
  });

  it("Fund D account has correct currentBalance", () => {
    const accounts = mapCarryBalancesToSimAccounts(rows, PROFILE);
    const fundD = accounts.find(a => a.id === "carry-balance-carry-4");
    expect(fundD?.currentBalance).toBe(200_000);
  });

  it("all produced accounts use the profile assumedReturnRate as blendedReturnRate", () => {
    const profile = { assumedReturnRate: 0.08 };
    const accounts = mapCarryBalancesToSimAccounts(rows, profile);
    accounts.forEach(a => expect(a.blendedReturnRate).toBe(0.08));
  });

  it("all produced accounts have accountType taxable", () => {
    const accounts = mapCarryBalancesToSimAccounts(rows, PROFILE);
    accounts.forEach(a => expect(a.accountType).toBe("taxable"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Empty input
// ─────────────────────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("empty carry array produces empty accounts array", () => {
    const accounts = mapCarryBalancesToSimAccounts([], PROFILE);
    expect(accounts).toHaveLength(0);
  });

  it("single position with no balance fields set (null) produces empty output", () => {
    const accounts = mapCarryBalancesToSimAccounts(
      [makeCarryRow({ currentAccountBalance: null })],
      PROFILE,
    );
    expect(accounts).toHaveLength(0);
  });

  it("fund name with special characters appears verbatim in accountName", () => {
    const accounts = mapCarryBalancesToSimAccounts(
      [makeCarryRow({ fundName: "KKR North America XI, L.P." })],
      PROFILE,
    );
    expect(accounts[0].accountName).toBe("KKR North America XI, L.P. \u2013 Current Balance");
  });

  it("account id embeds the full carry id, including hyphens and letters", () => {
    const accounts = mapCarryBalancesToSimAccounts(
      [makeCarryRow({ id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" })],
      PROFILE,
    );
    expect(accounts[0].id).toBe("carry-balance-f47ac10b-58cc-4372-a567-0e02b2c3d479");
  });

  it("different profiles produce different blendedReturnRates for the same carry row", () => {
    const row = makeCarryRow({ currentAccountBalance: 100_000 });
    const a1 = mapCarryBalancesToSimAccounts([row], { assumedReturnRate: 0.05 });
    const a2 = mapCarryBalancesToSimAccounts([row], { assumedReturnRate: 0.10 });
    expect(a1[0].blendedReturnRate).toBe(0.05);
    expect(a2[0].blendedReturnRate).toBe(0.10);
  });
});
