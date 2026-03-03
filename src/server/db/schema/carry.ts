import { pgTable, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { userProfiles } from "./users";

export const carryPositions = pgTable("carry_positions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  fundName: text("fund_name").notNull(),
  vintageYear: integer("vintage_year").notNull(),
  carryPct: real("carry_pct").notNull(), // e.g., 0.20 for 20%
  totalCommittedCapital: real("total_committed_capital").notNull(),
  currentTvpi: real("current_tvpi").notNull().default(1.0),
  expectedGrossCarry: real("expected_gross_carry").notNull().default(0), // user's estimate
  haircutPct: real("haircut_pct").notNull().default(0.2), // default 20% haircut
  expectedRealizationYear: integer("expected_realization_year").notNull(),
  expectedRealizationQuarter: text("expected_realization_quarter").notNull().default("Q3"), // Q1|Q2|Q3|Q4
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
