import { pgTable, text, real, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { userProfiles } from "./users";

export const expenditures = pgTable("expenditures", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  annualAmount: real("annual_amount").notNull(),
  growthRate: real("growth_rate").notNull().default(0.03), // inflation assumption
  category: text("category").notNull().default("other"),
  isPlaidSynced: boolean("is_plaid_synced").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const oneTimeExpenditures = pgTable("one_time_expenditures", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  projectedYear: integer("projected_year").notNull(),
  projectedQuarter: text("projected_quarter").notNull().default("Q2"), // Q1|Q2|Q3|Q4
  category: text("category").notNull().default("other"),
  isChildEducation: boolean("is_child_education").notNull().default(false),
  childId: text("child_id"), // link to children table for auto-projected education costs
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Stores Plaid access tokens per connected account
export const plaidConnections = pgTable("plaid_connections", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(), // encrypted at rest via Supabase
  itemId: text("item_id").notNull(),
  institutionName: text("institution_name"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
