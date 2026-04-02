import type { AccountBase, Transaction } from "plaid";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import { expenditures, investmentAccounts } from "@/server/db/schema";
import type * as schema from "@/server/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractExpendituresResult {
  created: number;
  skipped: number;
}

export interface ExtractAccountsResult {
  created: number;
  skipped: number;
}

// ─── Category mapping ─────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  RENT_AND_UTILITIES: "housing",
  HOME_IMPROVEMENT: "housing",
  LOAN_PAYMENTS: "housing",
  TRANSPORTATION: "transportation",
  TRAVEL: "travel",
  FOOD_AND_DRINK: "food",
  GROCERIES: "food",
  MEDICAL: "healthcare",
  GENERAL_MERCHANDISE: "other",
  ENTERTAINMENT: "entertainment",
  PERSONAL_CARE: "personal_care",
  EDUCATION: "education",
  CLOTHING_AND_ACCESSORIES: "clothing",
  GOVERNMENT_AND_NON_PROFIT: "charitable",
  GENERAL_SERVICES: "other",
  TRANSFER_IN: "other",
  TRANSFER_OUT: "other",
  INCOME: "other",
  BANK_FEES: "other",
};

const CATEGORY_LABELS: Record<string, string> = {
  housing: "Housing",
  transportation: "Transportation",
  food: "Food & Dining",
  healthcare: "Healthcare",
  travel: "Travel",
  education: "Education",
  entertainment: "Entertainment",
  clothing: "Clothing",
  personal_care: "Personal Care",
  charitable: "Charitable Giving",
  other: "Other",
};

function mapPlaidCategoryToApp(primaryCategory: string | undefined): string {
  if (!primaryCategory) return "other";
  return CATEGORY_MAP[primaryCategory] ?? "other";
}

// ─── Account type mapping ─────────────────────────────────────────────────────

type AppAccountType =
  | "taxable"
  | "traditional_ira"
  | "roth_ira"
  | "traditional_401k"
  | "roth_401k"
  | "sep_ira"
  | "solo_401k";

const INVESTMENT_SUBTYPE_MAP: Record<string, AppAccountType> = {
  brokerage: "taxable",
  "401k": "traditional_401k",
  roth: "roth_ira",
  ira: "traditional_ira",
  "roth 401k": "roth_401k",
  sep_ira: "sep_ira",
  "simple ira": "traditional_ira",
};

function mapPlaidAccountTypeToApp(type: string, subtype: string | null): AppAccountType | null {
  if (type !== "investment") return null;
  const key = (subtype ?? "").toLowerCase();
  return INVESTMENT_SUBTYPE_MAP[key] ?? "taxable";
}

function buildAccountName(acct: AccountBase, institutionName: string | null): string {
  const base = acct.official_name ?? acct.name;
  if (institutionName) return `${institutionName} — ${base}`;
  return base;
}

// ─── Extraction functions ─────────────────────────────────────────────────────

export async function extractExpendituresFromTransactions(
  transactions: Transaction[],
  windowMonths: number,
  userId: string,
  db: PostgresJsDatabase<typeof schema>,
): Promise<ExtractExpendituresResult> {
  // Group transaction amounts by app category
  const totals: Record<string, number> = {};
  for (const tx of transactions) {
    // Only process debits (positive amount = money leaving account in Plaid convention)
    if (tx.amount <= 0) continue;
    const primary = tx.personal_finance_category?.primary;
    // Skip inter-account transfers — they are not real expenditures
    if (primary === "TRANSFER_IN" || primary === "TRANSFER_OUT") continue;
    const category = mapPlaidCategoryToApp(primary);
    // Skip income-like categories
    if (category === "other" && primary === "INCOME") continue;
    totals[category] = (totals[category] ?? 0) + tx.amount;
  }

  let created = 0;
  let skipped = 0;
  const safeWindow = windowMonths > 0 ? windowMonths : 12;

  // Pre-load all Plaid-synced categories for this user in one query (avoids N+1)
  const existingRows = await db
    .select({ category: expenditures.category })
    .from(expenditures)
    .where(and(eq(expenditures.userId, userId), eq(expenditures.isPlaidSynced, true)));
  const existingCategories = new Set(existingRows.map((r) => r.category));

  for (const [category, total] of Object.entries(totals)) {
    const annualAmount = Math.round((total / safeWindow) * 12 * 100) / 100;
    const label = CATEGORY_LABELS[category] ?? "Other";

    if (existingCategories.has(category)) {
      skipped++;
      continue;
    }

    await db.insert(expenditures).values({
      userId,
      description: `${label} (from Plaid)`,
      annualAmount,
      growthRate: 0.03,
      category,
      isPlaidSynced: true,
    });
    created++;
  }

  return { created, skipped };
}

export async function extractAccountsFromPlaid(
  accounts: AccountBase[],
  institutionName: string | null,
  userId: string,
  db: PostgresJsDatabase<typeof schema>,
): Promise<ExtractAccountsResult> {
  let created = 0;
  let skipped = 0;

  for (const acct of accounts) {
    const accountType = mapPlaidAccountTypeToApp(acct.type, acct.subtype ?? null);
    if (!accountType) continue; // skip depository, credit, loan

    const accountName = buildAccountName(acct, institutionName);

    // De-duplicate by userId + accountName
    const existing = await db
      .select({ id: investmentAccounts.id })
      .from(investmentAccounts)
      .where(
        and(
          eq(investmentAccounts.userId, userId),
          eq(investmentAccounts.accountName, accountName),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    const currentBalance = acct.balances.current ?? 0;

    await db.insert(investmentAccounts).values({
      userId,
      accountName,
      accountType,
      currentBalance,
      equityPct: 0.7,
      bondPct: 0.2,
      altPct: 0.1,
      equityReturnRate: 0.08,
      bondReturnRate: 0.04,
      altReturnRate: 0.07,
    });
    created++;
  }

  return { created, skipped };
}
