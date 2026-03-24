import { vi, describe, it, expect, beforeEach } from "vitest";
import type { AccountBase, Transaction } from "plaid";

// ─── DB mock ─────────────────────────────────────────────────────────────────
//
// We build a minimal chainable Drizzle mock. The chain records the last call to
// `values()` and `select()` so individual tests can inspect what was written or
// control what the SELECT returns.
//

type ValuesCapture = Record<string, unknown>;

interface MockDb {
  _insertedValues: ValuesCapture[];
  _selectResult: unknown[];
  setSelectResult: (rows: unknown[]) => void;
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  _reset: () => void;
}

function makeMockDb(): MockDb {
  const state: { insertedValues: ValuesCapture[]; selectResult: unknown[] } = {
    insertedValues: [],
    selectResult: [],
  };

  // The SELECT chain: .select().from().where().limit() → resolves to selectResult
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve(state.selectResult)),
  };

  // The INSERT chain: .insert().values() → resolves immediately
  const insertChain = {
    values: vi.fn().mockImplementation((vals: ValuesCapture) => {
      state.insertedValues.push(vals);
      return Promise.resolve();
    }),
  };

  const mockDb = {
    get _insertedValues() {
      return state.insertedValues;
    },
    get _selectResult() {
      return state.selectResult;
    },
    setSelectResult(rows: unknown[]) {
      state.selectResult = rows;
    },
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue(insertChain),
    _reset() {
      state.insertedValues = [];
      state.selectResult = [];
      // re-wire return values after reset
      mockDb.select.mockReturnValue(selectChain);
      mockDb.insert.mockReturnValue(insertChain);
    },
  };

  return mockDb;
}

// ─── Helpers to build minimal Plaid objects ───────────────────────────────────

function makeTx(overrides: Partial<Transaction> & { primaryCategory?: string }): Transaction {
  const { primaryCategory, ...rest } = overrides;
  return {
    transaction_id: "tx_" + Math.random(),
    account_id: "acct_1",
    amount: 100,
    date: "2024-01-15",
    name: "Test Merchant",
    merchant_name: null,
    pending: false,
    iso_currency_code: "USD",
    unofficial_currency_code: null,
    category: null,
    category_id: null,
    location: {
      address: null,
      city: null,
      country: null,
      lat: null,
      lon: null,
      postal_code: null,
      region: null,
      store_number: null,
    },
    payment_meta: {
      by_order_of: null,
      payee: null,
      payer: null,
      payment_method: null,
      payment_processor: null,
      ppd_id: null,
      reason: null,
      reference_number: null,
    },
    authorized_date: null,
    transaction_type: "place",
    logo_url: null,
    website: null,
    authorized_datetime: null,
    datetime: null,
    payment_channel: "in store",
    transaction_code: null,
    check_number: null,
    personal_finance_category: primaryCategory
      ? ({ primary: primaryCategory } as unknown as Transaction["personal_finance_category"])
      : null,
    personal_finance_category_icon_url: "",
    counterparties: [],
    merchant_entity_id: null,
    ...rest,
  } as unknown as Transaction;
}

function makeAccount(
  type: string,
  subtype: string | null,
  overrides: Partial<AccountBase> = {},
): AccountBase {
  return {
    account_id: "acct_" + Math.random(),
    balances: {
      available: 1000,
      current: 5000,
      limit: null,
      iso_currency_code: "USD",
      unofficial_currency_code: null,
      last_updated_datetime: null,
    },
    mask: "1234",
    name: "My Account",
    official_name: null,
    type: type as AccountBase["type"],
    subtype: subtype as AccountBase["subtype"],
    verification_status: null,
    persistent_account_id: null,
    ...overrides,
  } as unknown as AccountBase;
}

// ─── Import the functions under test ─────────────────────────────────────────
//
// We import AFTER defining the mock db factory so that the module-level mock of
// drizzle operators (eq, and) does not need to be real — the functions receive
// `db` as a parameter, so we just pass our mockDb directly.
//

import {
  extractExpendituresFromTransactions,
  extractAccountsFromPlaid,
} from "./plaid-extraction";

// ─── Test suite ───────────────────────────────────────────────────────────────

const USER_ID = "user_abc";

describe("extractExpendituresFromTransactions", () => {
  let db: MockDb;

  beforeEach(() => {
    db = makeMockDb();
  });

  // 1. Empty transaction list
  it("returns { created: 0, skipped: 0 } and performs no insert when list is empty", async () => {
    const result = await extractExpendituresFromTransactions(
      [],
      12,
      USER_ID,
      db as never,
    );
    expect(result).toEqual({ created: 0, skipped: 0 });
    expect(db.insert).not.toHaveBeenCalled();
  });

  // 2. Category mapping — FOOD_AND_DRINK → "food"
  it("maps FOOD_AND_DRINK to the food category", async () => {
    const result = await extractExpendituresFromTransactions(
      [makeTx({ amount: 120, primaryCategory: "FOOD_AND_DRINK" })],
      12,
      USER_ID,
      db as never,
    );
    expect(result.created).toBe(1);
    const inserted = db._insertedValues[0];
    expect(inserted?.category).toBe("food");
  });

  // 3. Multiple transactions in the same category are summed before annualizing
  it("sums multiple transactions in the same category before annualizing", async () => {
    const txs = [
      makeTx({ amount: 300, primaryCategory: "FOOD_AND_DRINK" }),
      makeTx({ amount: 150, primaryCategory: "FOOD_AND_DRINK" }),
    ];
    await extractExpendituresFromTransactions(txs, 3, USER_ID, db as never);
    const inserted = db._insertedValues[0];
    // (300+150) / 3 * 12 = 1800
    expect(inserted?.annualAmount).toBe(1800);
  });

  // 4. Annualization formula: (sum / windowMonths) * 12, rounded to 2 decimal places
  it("annualizes correctly and rounds to 2 decimal places", async () => {
    const txs = [makeTx({ amount: 100, primaryCategory: "FOOD_AND_DRINK" })];
    await extractExpendituresFromTransactions(txs, 7, USER_ID, db as never);
    const inserted = db._insertedValues[0];
    // 100 / 7 * 12 = 171.428... → 171.43
    expect(inserted?.annualAmount).toBe(171.43);
  });

  // 5. Negative/zero-amount transactions (credits) are skipped
  it("skips transactions with amount <= 0", async () => {
    const txs = [
      makeTx({ amount: -50, primaryCategory: "FOOD_AND_DRINK" }),
      makeTx({ amount: 0, primaryCategory: "FOOD_AND_DRINK" }),
    ];
    const result = await extractExpendituresFromTransactions(txs, 12, USER_ID, db as never);
    expect(result).toEqual({ created: 0, skipped: 0 });
    expect(db.insert).not.toHaveBeenCalled();
  });

  // 6. Unknown primaryCategory maps to "other"
  it("maps an unknown primaryCategory to the other category", async () => {
    await extractExpendituresFromTransactions(
      [makeTx({ amount: 50, primaryCategory: "DEFINITELY_NOT_A_REAL_CATEGORY" })],
      12,
      USER_ID,
      db as never,
    );
    const inserted = db._insertedValues[0];
    expect(inserted?.category).toBe("other");
  });

  // 7. Missing personal_finance_category maps to "other"
  it("maps a transaction with no personal_finance_category to other", async () => {
    const tx = makeTx({ amount: 80 });
    // personal_finance_category is already null from makeTx default when no primaryCategory given
    await extractExpendituresFromTransactions([tx], 12, USER_ID, db as never);
    const inserted = db._insertedValues[0];
    expect(inserted?.category).toBe("other");
  });

  // 8. De-duplication: existing isPlaidSynced row → skipped, no insert
  it("increments skipped and does not insert when a Plaid-synced row already exists", async () => {
    db.setSelectResult([{ id: "existing-row-id" }]);
    const result = await extractExpendituresFromTransactions(
      [makeTx({ amount: 100, primaryCategory: "FOOD_AND_DRINK" })],
      12,
      USER_ID,
      db as never,
    );
    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(db.insert).not.toHaveBeenCalled();
  });

  // 9. Description format: label + " (from Plaid)"
  it("sets description to the category label followed by (from Plaid)", async () => {
    await extractExpendituresFromTransactions(
      [makeTx({ amount: 200, primaryCategory: "FOOD_AND_DRINK" })],
      12,
      USER_ID,
      db as never,
    );
    const inserted = db._insertedValues[0];
    expect(inserted?.description).toBe("Food & Dining (from Plaid)");
  });

  // 10. Inserted row has growthRate: 0.03 and isPlaidSynced: true
  it("inserts a row with growthRate 0.03 and isPlaidSynced true", async () => {
    await extractExpendituresFromTransactions(
      [makeTx({ amount: 100, primaryCategory: "TRANSPORTATION" })],
      12,
      USER_ID,
      db as never,
    );
    const inserted = db._insertedValues[0];
    expect(inserted?.growthRate).toBe(0.03);
    expect(inserted?.isPlaidSynced).toBe(true);
  });

  // 11. windowMonths = 0 does not divide by zero (uses 12 as safe fallback)
  it("uses 12 as a safe fallback when windowMonths is 0", async () => {
    await extractExpendituresFromTransactions(
      [makeTx({ amount: 600, primaryCategory: "FOOD_AND_DRINK" })],
      0,
      USER_ID,
      db as never,
    );
    const inserted = db._insertedValues[0];
    // 600 / 12 * 12 = 600
    expect(inserted?.annualAmount).toBe(600);
  });
});

describe("extractAccountsFromPlaid", () => {
  let db: MockDb;

  beforeEach(() => {
    db = makeMockDb();
  });

  // 12. depository account is skipped entirely (not even a DB call for dedup)
  it("skips depository accounts and returns { created: 0, skipped: 0 }", async () => {
    const acct = makeAccount("depository", "checking");
    const result = await extractAccountsFromPlaid([acct], "Chase", USER_ID, db as never);
    expect(result).toEqual({ created: 0, skipped: 0 });
    expect(db.insert).not.toHaveBeenCalled();
  });

  // 13. credit account is skipped
  it("skips credit accounts and returns { created: 0, skipped: 0 }", async () => {
    const acct = makeAccount("credit", "credit card");
    const result = await extractAccountsFromPlaid([acct], null, USER_ID, db as never);
    expect(result).toEqual({ created: 0, skipped: 0 });
    expect(db.insert).not.toHaveBeenCalled();
  });

  // 14. investment brokerage → accountType "taxable"
  it("maps investment/brokerage to accountType taxable", async () => {
    const acct = makeAccount("investment", "brokerage");
    const result = await extractAccountsFromPlaid([acct], "Fidelity", USER_ID, db as never);
    expect(result.created).toBe(1);
    const inserted = db._insertedValues[0];
    expect(inserted?.accountType).toBe("taxable");
  });

  // 15. investment 401k → accountType "traditional_401k"
  it("maps investment/401k to accountType traditional_401k", async () => {
    const acct = makeAccount("investment", "401k");
    await extractAccountsFromPlaid([acct], "Vanguard", USER_ID, db as never);
    const inserted = db._insertedValues[0];
    expect(inserted?.accountType).toBe("traditional_401k");
  });

  // 16. De-duplication: same accountName already exists → skipped, no insert
  it("increments skipped and does not insert when an account with the same name already exists", async () => {
    db.setSelectResult([{ id: "existing-acct-id" }]);
    const acct = makeAccount("investment", "brokerage", { name: "My Brokerage" });
    const result = await extractAccountsFromPlaid([acct], "Fidelity", USER_ID, db as never);
    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(db.insert).not.toHaveBeenCalled();
  });

  // 17. Inserted account has default allocations equityPct=0.7, bondPct=0.2, altPct=0.1
  it("inserts investment account with default allocation percentages", async () => {
    const acct = makeAccount("investment", "ira");
    await extractAccountsFromPlaid([acct], null, USER_ID, db as never);
    const inserted = db._insertedValues[0];
    expect(inserted?.equityPct).toBe(0.7);
    expect(inserted?.bondPct).toBe(0.2);
    expect(inserted?.altPct).toBe(0.1);
  });
});
