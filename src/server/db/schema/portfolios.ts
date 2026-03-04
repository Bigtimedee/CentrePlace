import { pgTable, text, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { userProfiles } from "./users";

export const accountTypeEnum = pgEnum("account_type", [
  "taxable",
  "traditional_ira",
  "roth_ira",
  "traditional_401k",
  "roth_401k",
  "sep_ira",
  "solo_401k",
]);

export const investmentAccounts = pgTable("investment_accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  accountName: text("account_name").notNull(),
  accountType: accountTypeEnum("account_type").notNull(),
  currentBalance: real("current_balance").notNull().default(0),

  // Asset allocation (must sum to 1.0)
  equityPct: real("equity_pct").notNull().default(0.7),
  bondPct: real("bond_pct").notNull().default(0.2),
  altPct: real("alt_pct").notNull().default(0.1),

  // Return rate assumptions per asset class
  equityReturnRate: real("equity_return_rate").notNull().default(0.08),
  bondReturnRate: real("bond_return_rate").notNull().default(0.04),
  altReturnRate: real("alt_return_rate").notNull().default(0.07),

  // Annual contribution (pre-FI accumulation)
  annualContribution: real("annual_contribution").notNull().default(0),

  // Income yield decomposition (% of balance/yr; default 0 = backwards compatible)
  ordinaryYieldRate: real("ordinary_yield_rate").notNull().default(0),
  qualifiedYieldRate: real("qualified_yield_rate").notNull().default(0),
  taxExemptYieldRate: real("tax_exempt_yield_rate").notNull().default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
