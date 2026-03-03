import { pgTable, text, real, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { userProfiles } from "./users";

export const propertyTypeEnum = pgEnum("property_type", [
  "primary_residence",
  "rental",
  "vacation",
  "commercial",
  "llc_held",
]);

export const loanTypeEnum = pgEnum("loan_type", ["fixed", "arm"]);

export const realEstateProperties = pgTable("real_estate_properties", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  propertyName: text("property_name").notNull(),
  propertyType: propertyTypeEnum("property_type").notNull(),
  currentValue: real("current_value").notNull(),
  purchasePrice: real("purchase_price").notNull(),
  purchaseYear: integer("purchase_year").notNull(),
  appreciationRate: real("appreciation_rate").notNull().default(0.04),

  // LLC-specific
  ownershipPct: real("ownership_pct").notNull().default(1.0),
  llcValuationDiscountPct: real("llc_valuation_discount_pct").default(0),

  // Rental income / expenses (annual)
  annualRentalIncome: real("annual_rental_income").default(0),
  annualOperatingExpenses: real("annual_operating_expenses").default(0),
  // Personal use days for vacation/mixed-use
  personalUseDaysPerYear: integer("personal_use_days_per_year").default(0),

  // Future sale projection
  projectedSaleYear: integer("projected_sale_year"),
  projectedSaleQuarter: text("projected_sale_quarter").default("Q3"),
  is1031Exchange: boolean("is_1031_exchange").notNull().default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const mortgages = pgTable("mortgages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  propertyId: text("property_id").notNull().references(() => realEstateProperties.id, { onDelete: "cascade" }),
  outstandingBalance: real("outstanding_balance").notNull(),
  interestRate: real("interest_rate").notNull(),
  remainingTermMonths: integer("remaining_term_months").notNull(),
  loanType: loanTypeEnum("loan_type").notNull().default("fixed"),
  // ARM adjustment schedule stored as jsonb: [{adjustmentYear, newRate}]
  armAdjustmentSchedule: text("arm_adjustment_schedule"), // JSON string
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
