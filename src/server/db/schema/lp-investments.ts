import { pgTable, text, real, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { userProfiles } from "./users";

// Each distribution event in the jsonb array
export type LPDistribution = {
  year: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  amount: number;
  taxCharacter: "ltcg" | "ordinary" | "return_of_capital";
};

export const lpInvestments = pgTable("lp_investments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  fundName: text("fund_name").notNull(),
  vintageYear: integer("vintage_year").notNull(),
  commitmentAmount: real("commitment_amount").notNull(),
  currentNav: real("current_nav").notNull().default(0),
  // Array of distribution events: [{year, quarter, amount, taxCharacter}]
  expectedDistributions: jsonb("expected_distributions").$type<LPDistribution[]>().notNull().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("lp_investments_user_id_idx").on(t.userId),
]);
