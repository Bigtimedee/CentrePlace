import { pgTable, text, real, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { userProfiles } from "./users";
import { investmentAccounts } from "./portfolios";

export const directInvestments = pgTable(
  "direct_investments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => investmentAccounts.id, { onDelete: "set null" }),
    securityName: text("security_name").notNull(),
    ticker: text("ticker"),
    assetClass: text("asset_class").notNull().default("equity"),
    category: text("category"),
    shares: real("shares"),
    pricePerShare: real("price_per_share"),
    currentValue: real("current_value").notNull(),
    costBasis: real("cost_basis"),
    purchaseDate: text("purchase_date"),
    expectedReturnRate: real("expected_return_rate").notNull().default(0.07),
    ordinaryYieldRate: real("ordinary_yield_rate").notNull().default(0),
    qualifiedYieldRate: real("qualified_yield_rate").notNull().default(0),
    taxExemptYieldRate: real("tax_exempt_yield_rate").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().default(sql`now()`),
    updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  },
  (t) => [
    index("direct_investments_user_id_idx").on(t.userId),
    index("direct_investments_account_id_idx").on(t.accountId),
  ]
);
