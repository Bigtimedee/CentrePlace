import { pgTable, text, real, timestamp } from "drizzle-orm/pg-core";
import { userProfiles } from "./users";

export const realizationPolicy = pgTable("realization_policy", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => userProfiles.id, { onDelete: "cascade" }),

  // Equity bucket (e.g. S&P 500)
  equityPct: real("equity_pct").notNull().default(0.50),
  equityAppreciationRate: real("equity_appreciation_rate").notNull().default(0.055),
  equityQualifiedYieldRate: real("equity_qualified_yield_rate").notNull().default(0.015),

  // Taxable fixed income (e.g. corporate/treasury bonds)
  taxableFixedIncomePct: real("taxable_fixed_income_pct").notNull().default(0.20),
  taxableFixedIncomeRate: real("taxable_fixed_income_rate").notNull().default(0.04),

  // Tax-exempt fixed income (e.g. municipal bonds)
  taxExemptFixedIncomePct: real("tax_exempt_fixed_income_pct").notNull().default(0.10),
  taxExemptFixedIncomeRate: real("tax_exempt_fixed_income_rate").notNull().default(0.03),

  // Real estate / hard assets
  realEstatePct: real("real_estate_pct").notNull().default(0.20),
  reAppreciationRate: real("re_appreciation_rate").notNull().default(0.04),
  reGrossYieldRate: real("re_gross_yield_rate").notNull().default(0.06),
  reCarryingCostRate: real("re_carrying_cost_rate").notNull().default(0.02),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
