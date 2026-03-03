import { pgTable, text, real, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { userProfiles } from "./users";

export const policyTypeEnum = pgEnum("policy_type", ["term", "whole_life", "ppli"]);
export const ownershipStructureEnum = pgEnum("ownership_structure", ["personal", "ilit"]);

export const insurancePolicies = pgTable("insurance_policies", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  policyName: text("policy_name").notNull(),
  policyType: policyTypeEnum("policy_type").notNull(),
  ownershipStructure: ownershipStructureEnum("ownership_structure").notNull().default("personal"),
  insurer: text("insurer"),

  // Death benefit
  deathBenefit: real("death_benefit").notNull(),

  // Premium structure
  annualPremium: real("annual_premium").notNull().default(0),
  premiumYearsRemaining: integer("premium_years_remaining").notNull().default(0),

  // Cash value (whole life and PPLI only)
  currentCashValue: real("current_cash_value").default(0),
  assumedReturnRate: real("assumed_return_rate").default(0.05), // guaranteed + dividend for WL; investment return for PPLI

  // Loan details (whole life and PPLI only)
  outstandingLoanBalance: real("outstanding_loan_balance").default(0),
  maxLoanPct: real("max_loan_pct").default(0.9), // 90% of cash value

  // PPLI-specific: underlying investment allocation description
  ppliUnderlyingAllocation: text("ppli_underlying_allocation"),

  // Estate tax funding flag
  isEstateTaxFunding: boolean("is_estate_tax_funding").notNull().default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
