import { pgTable, text, real, integer, timestamp, index } from "drizzle-orm/pg-core";
import { userProfiles } from "./users";

export const equityGrants = pgTable("equity_grants", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  grantType: text("grant_type").notNull(), // "rsu" | "iso" | "nso" | "warrant" | "rsa"
  grantDate: text("grant_date").notNull(),
  totalShares: integer("total_shares").notNull(),
  strikePrice: real("strike_price"),
  currentFmv: real("current_fmv").notNull(),
  fmvGrowthRate: real("fmv_growth_rate").notNull().default(0.08),
  expirationDate: text("expiration_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("equity_grants_user_id_idx").on(t.userId)]);

export const equityVestingEvents = pgTable("equity_vesting_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  grantId: text("grant_id").notNull().references(() => equityGrants.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  quarter: text("quarter").notNull().default("Q1"), // "Q1"|"Q2"|"Q3"|"Q4"
  shares: integer("shares").notNull(),
  projectedFmvAtEvent: real("projected_fmv_at_event"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("equity_vesting_events_user_id_idx").on(t.userId),
  index("equity_vesting_events_grant_id_idx").on(t.grantId),
]);

export const equityShareLots = pgTable("equity_share_lots", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  grantId: text("grant_id").notNull().references(() => equityGrants.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  shares: integer("shares").notNull(),
  costBasisPerShare: real("cost_basis_per_share").notNull(),
  acquiredDate: text("acquired_date").notNull(),
  projectedSaleYear: integer("projected_sale_year"),
  projectedSaleQuarter: text("projected_sale_quarter"), // "Q1"|"Q2"|"Q3"|"Q4"
  isIsoQualifying: integer("is_iso_qualifying").notNull().default(0), // stored as 0/1 (Supabase compat)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("equity_share_lots_user_id_idx").on(t.userId),
  index("equity_share_lots_grant_id_idx").on(t.grantId),
]);
