import { pgTable, text, real, integer, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { userProfiles } from "./users";

export const directInvestments = pgTable(
  "direct_investments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
    securityName: text("security_name").notNull(),
    assetClass: text("asset_class").notNull().default("equity"),
    industry: text("industry"),
    stage: text("stage"),
    ownershipPct: real("ownership_pct"),
    currentValue: real("current_value").notNull(),
    costBasis: real("cost_basis"),
    purchaseDate: text("purchase_date"),
    expectedExitYear: integer("expected_exit_year"),
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
  ]
);
